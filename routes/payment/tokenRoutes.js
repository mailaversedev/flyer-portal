const express = require("express");

const { authenticateToken } = require("../auth");
const { db, generateTransactionId, getWalletByUserId } = require("./helpers");
const { ensureCompanyWalletInTransaction } = require("../../services/companyWalletService");

const router = express.Router();

const createTokenRoute = (type) => async (req, res) => {
  try {
    const { amount, description, idempotencyKey } = req.body;
    const userId = req.user.userId;
    const companyId = req.user?.companyId || "";
    const hasCompanyWalletScope = Boolean(companyId);
    const normalizedAmount = Number(amount);

    if (!Number.isFinite(normalizedAmount) || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: "Amount and idempotencyKey are required",
      });
    }

    if (normalizedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be positive",
      });
    }

    if (hasCompanyWalletScope && type === "ADD") {
      return res.status(403).json({
        success: false,
        message: "Adding tokens is not allowed via this route for company wallets",
      });
    }

    const idempotencyQuery = db
      .collection("transactions")
      .where("idempotencyKey", "==", idempotencyKey)
      .where(hasCompanyWalletScope ? "companyId" : "userId", "==", hasCompanyWalletScope ? companyId : userId)
      .limit(1);

    const existingTxQuery = await idempotencyQuery.get();

    if (!existingTxQuery.empty) {
      const existingTx = existingTxQuery.docs[0].data();
      return res.status(200).json({
        success: true,
        message: "Transaction already processed (idempotent)",
        data: {
          transactionId: existingTx.transactionId,
          amount: existingTx.amount,
          newBalance: existingTx.newBalance,
          status: existingTx.status,
        },
      });
    }

    const transactionId = generateTransactionId();
    const timestamp = new Date().toISOString();
    const result = await db.runTransaction(async (transaction) => {
      let wallet;
      let walletRef;

      if (hasCompanyWalletScope) {
        wallet = await ensureCompanyWalletInTransaction({
          transaction,
          companyId,
          initialBalance: 0,
          timestamp,
        });
        walletRef = wallet.ref || wallet.doc.ref;
      } else {
        wallet = await getWalletByUserId(userId);
        walletRef = db.collection("wallets").doc(wallet.doc.id);
      }

      const currentWallet = await transaction.get(walletRef);

      if (!currentWallet.exists) {
        throw new Error("Wallet not found");
      }

      const walletData = currentWallet.data();
      const currentBalance = Number(walletData.balance) || 0;

      if (type === "DEDUCT" && currentBalance < normalizedAmount) {
        throw new Error("Insufficient balance");
      }

      const newBalance =
        type === "ADD"
          ? currentBalance + normalizedAmount
          : currentBalance - normalizedAmount;
      const newVersion = (Number(walletData.version) || 0) + 1;

      transaction.update(walletRef, {
        balance: newBalance,
        updatedAt: timestamp,
        version: newVersion,
      });

      transaction.set(db.collection("transactions").doc(), {
        transactionId,
        ...(hasCompanyWalletScope ? { companyId, ownerType: "company" } : { userId }),
        walletId: walletRef.id,
        type,
        amount: normalizedAmount,
        previousBalance: currentBalance,
        newBalance,
        description: description || `${type === "ADD" ? "Add" : "Deduct"} tokens ${type === "ADD" ? "to" : "from"} wallet`,
        status: "COMPLETED",
        idempotencyKey,
        createdAt: timestamp,
        updatedAt: timestamp,
        ...(type === "ADD" ? { metadata: { source: "manual_topup" } } : {}),
      });

      return {
        transactionId,
        amount: normalizedAmount,
        previousBalance: currentBalance,
        newBalance,
        status: "COMPLETED",
      };
    });

    return res.status(200).json({
      success: true,
      message: `Tokens ${type === "ADD" ? "added" : "deducted"} successfully`,
      data: result,
    });
  } catch (error) {
    console.error(`Error ${type === "ADD" ? "adding" : "deducting"} tokens:`, error);

    if (error.message === "Insufficient balance") {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance in wallet",
        error: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: `Internal server error during token ${type === "ADD" ? "addition" : "deduction"}`,
      error: error.message,
    });
  }
};

router.post("/add-tokens", authenticateToken, createTokenRoute("ADD"));
router.post("/deduct-tokens", authenticateToken, createTokenRoute("DEDUCT"));

module.exports = router;