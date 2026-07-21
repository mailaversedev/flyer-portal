const express = require("express");

const { authenticateToken } = require("../auth");
const {
  buildAssignedVoucherNumber,
  db,
  generateTransactionId,
  getWalletByUserId,
} = require("./helpers");

const router = express.Router();

router.post("/redeem-voucher", authenticateToken, async (req, res) => {
  try {
    const { voucherId, idempotencyKey, description } = req.body || {};
    const userId = req.user.userId;

    if (!voucherId || !idempotencyKey) {
      return res.status(400).json({ success: false, message: "voucherId and idempotencyKey are required" });
    }

    const timestamp = new Date().toISOString();
    const redemptionRef = db.collection("voucherRedemptions").doc(`${userId}_${idempotencyKey}`);
    const result = await db.runTransaction(async (transaction) => {
      const existingRedemption = await transaction.get(redemptionRef);

      if (existingRedemption.exists) {
        return (existingRedemption.data() || {}).result;
      }

      const voucherRef = db.collection("vouchers").doc(voucherId);
      const voucherDoc = await transaction.get(voucherRef);

      if (!voucherDoc.exists) throw new Error("__VOUCHER_NOT_FOUND__");

      const voucherData = voucherDoc.data() || {};
      const voucherCost = Number(voucherData.cost);
      if (!Number.isFinite(voucherCost) || voucherCost <= 0) throw new Error("__VOUCHER_COST_INVALID__");
      if (voucherData.isActive === false) throw new Error("__VOUCHER_INACTIVE__");

      if (voucherData.expiryDate) {
        const expiryDate = new Date(voucherData.expiryDate);
        if (Number.isNaN(expiryDate.getTime()) || expiryDate.getTime() < Date.now()) {
          throw new Error("__VOUCHER_EXPIRED__");
        }
      }

      const totalNumber = Number.parseInt(voucherData.totalNumber, 10);
      const redeemedCount = Number.parseInt(voucherData.redeemedCount || 0, 10);
      if (!Number.isFinite(totalNumber) || totalNumber <= 0 || !Number.isFinite(redeemedCount) || redeemedCount < 0) {
        throw new Error("__VOUCHER_STOCK_INVALID__");
      }
      if (redeemedCount >= totalNumber) throw new Error("__VOUCHER_SOLD_OUT__");

      const voucherType = `${voucherData.voucherType || "static"}`.trim() || "static";
      const assignedVoucherNumber = voucherType === "numbered"
        ? buildAssignedVoucherNumber({
            prefix: voucherData.voucherPrefix,
            startSequence: voucherData.voucherStartSequence,
            endSequence: voucherData.voucherEndSequence,
            redeemedCount,
            startCode: voucherData.voucherNumberStart,
          })
        : "";

      const wallet = await getWalletByUserId(userId);
      const walletRef = db.collection("wallets").doc(wallet.doc.id);
      const walletSnapshot = await transaction.get(walletRef);
      if (!walletSnapshot.exists) throw new Error("__WALLET_NOT_FOUND__");

      const walletData = walletSnapshot.data() || {};
      const previousBalance = Number(walletData.balance) || 0;
      if (previousBalance < voucherCost) throw new Error("__INSUFFICIENT_BALANCE__");

      const newBalance = previousBalance - voucherCost;
      transaction.update(walletRef, {
        balance: newBalance,
        updatedAt: timestamp,
        version: (Number(walletData.version) || 0) + 1,
      });

      const transactionId = generateTransactionId();
      transaction.set(db.collection("transactions").doc(), {
        transactionId,
        userId,
        walletId: wallet.doc.id,
        type: "DEDUCT",
        amount: voucherCost,
        previousBalance,
        newBalance,
        description: description || `Redeemed ${voucherData.value || ""} ${voucherData.merchant || ""} Voucher`,
        status: "COMPLETED",
        idempotencyKey,
        createdAt: timestamp,
        updatedAt: timestamp,
        metadata: { source: "voucher_redeem", voucherId, assignedVoucherNumber },
      });

      const nextRedeemedCount = redeemedCount + 1;
      transaction.set(voucherRef, { redeemedCount: nextRedeemedCount, updatedAt: timestamp }, { merge: true });

      const resultData = {
        transactionId, amount: voucherCost, previousBalance, newBalance, status: "COMPLETED", assignedVoucherNumber,
        voucher: {
          id: voucherDoc.id, value: voucherData.value || "", cost: voucherCost, merchant: voucherData.merchant || "",
          merchantIcon: voucherData.merchantIcon || "", voucherImage: voucherData.voucherImage || "", voucherType,
          expiryDate: voucherData.expiryDate || "", totalNumber, redeemedCount: nextRedeemedCount,
          remainingCount: Math.max(0, totalNumber - nextRedeemedCount),
          qrCode: voucherType === "numbered" ? assignedVoucherNumber : (voucherData.qrCode || ""),
          promotionCode: voucherType === "numbered" ? assignedVoucherNumber : (voucherData.promotionCode || ""),
          claimedVoucherNumber: assignedVoucherNumber, colors: Array.isArray(voucherData.colors) ? voucherData.colors : [],
          terms: voucherData.terms || "", isActive: voucherData.isActive !== false,
        },
      };

      transaction.set(redemptionRef, { userId, voucherId, idempotencyKey, assignedVoucherNumber, createdAt: timestamp, updatedAt: timestamp, result: resultData });
      return resultData;
    });

    return res.status(200).json({ success: true, message: "Voucher redeemed successfully", data: result });
  } catch (error) {
    const responses = {
      __VOUCHER_NOT_FOUND__: [404, "Voucher not found"],
      __WALLET_NOT_FOUND__: [404, "Wallet not found"],
      __INSUFFICIENT_BALANCE__: [400, "Insufficient balance in wallet"],
      __VOUCHER_SOLD_OUT__: [409, "Voucher is sold out"],
      __VOUCHER_EXPIRED__: [409, "Voucher is expired"],
      __VOUCHER_INACTIVE__: [409, "Voucher is inactive"],
    };
    const invalidConfigurationErrors = new Set(["__VOUCHER_PREFIX_MISSING__", "__VOUCHER_RANGE_INVALID__", "__VOUCHER_STOCK_INVALID__", "__VOUCHER_COST_INVALID__"]);
    const response = responses[error.message] || (invalidConfigurationErrors.has(error.message) ? [400, "Voucher configuration is invalid"] : null);

    if (response) return res.status(response[0]).json({ success: false, message: response[1] });

    console.error("Error redeeming voucher:", error);
    return res.status(500).json({ success: false, message: "Internal server error during voucher redemption", error: error.message });
  }
});

module.exports = router;