const express = require("express");

const { authenticateToken } = require("../auth");
const { TOKEN_BUNDLES } = require("../../config/billingConfig");
const { createCompanyWalletTransaction, ensureCompanyWalletInTransaction } = require("../../services/companyWalletService");
const { db, roundMoneyAmount } = require("./helpers");

const router = express.Router();

router.post("/purchase-bundle", authenticateToken, async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const bundleCode = `${req.body?.bundleCode || ""}`.trim();
    if (!companyId) return res.status(403).json({ success: false, message: "Company wallet access is required" });
    if (!bundleCode) return res.status(400).json({ success: false, message: "Bundle code is required" });

    const bundle = TOKEN_BUNDLES.find((entry) => entry.code === bundleCode);
    if (!bundle) return res.status(404).json({ success: false, message: "Bundle not found" });

    const timestamp = new Date().toISOString();
    const result = await db.runTransaction(async (transaction) => {
      const wallet = await ensureCompanyWalletInTransaction({ transaction, companyId, companyName: "", companyDisplayName: "", initialBalance: 0, timestamp });
      const walletRef = wallet.ref || wallet.doc.ref;
      const walletSnapshot = await transaction.get(walletRef);
      if (!walletSnapshot.exists) throw new Error("__WALLET_NOT_FOUND__");

      const walletData = walletSnapshot.data() || {};
      const previousBalance = Number(walletData.balance) || 0;
      const previousCreditBalanceHkd = Number(walletData.creditBalanceHkd) || 0;
      const priceHkd = roundMoneyAmount(bundle.priceHkd);
      if (previousCreditBalanceHkd < priceHkd) throw new Error("__INSUFFICIENT_CREDIT__");

      const newBalance = previousBalance + bundle.tokens;
      const newCreditBalanceHkd = roundMoneyAmount(previousCreditBalanceHkd - priceHkd);
      transaction.set(walletRef, { balance: newBalance, creditBalanceHkd: newCreditBalanceHkd, updatedAt: timestamp, version: (Number(walletData.version) || 0) + 1 }, { merge: true });
      createCompanyWalletTransaction({
        transaction, walletId: walletRef.id, companyId, type: "DEDUCT", amount: priceHkd,
        previousBalance: previousCreditBalanceHkd, newBalance: newCreditBalanceHkd, balanceField: "creditBalanceHkd", unit: "HKD",
        description: `${bundle.title} purchase (+${bundle.tokens} tokens)`, timestamp,
        metadata: { source: "bundle_purchase", bundleCode: bundle.code, bundleTitle: bundle.title, tokenAmount: bundle.tokens, tokenBalanceBefore: previousBalance, tokenBalanceAfter: newBalance, priceHkd },
      });
      return { bundle, previousBalance, newBalance, previousCreditBalanceHkd, newCreditBalanceHkd };
    });

    return res.status(200).json({ success: true, message: "Bundle purchased successfully", data: result });
  } catch (error) {
    if (error.message === "__WALLET_NOT_FOUND__") return res.status(404).json({ success: false, message: "Wallet not found" });
    if (error.message === "__INSUFFICIENT_CREDIT__") return res.status(400).json({ success: false, message: "Insufficient HKD credit" });
    console.error("Error purchasing bundle:", error);
    return res.status(500).json({ success: false, message: "Internal server error purchasing bundle", error: error.message });
  }
});

module.exports = router;