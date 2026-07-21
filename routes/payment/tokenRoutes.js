const express = require("express");

const { authenticateToken } = require("../auth");
const { db, generateTransactionId, getWalletByUserId } = require("./helpers");

const router = express.Router();

const createTokenRoute = (type) => async (req, res) => {
  try {
    const { amount, description, idempotencyKey } = req.body;
    const userId = req.user.userId;

    if (!amount || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: "Amount and idempotencyKey are required",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be positive",
      });
    }

    const existingTxQuery = await db
      .collection("transactions")
      .where("idempotencyKey", "==", idempotencyKey)
      .where("userId", "==", userId)
      .limit(1)
      .get();

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
      const wallet = await getWalletByUserId(userId);
      const walletRef = db.collection("wallets").doc(wallet.doc.id);
      const currentWallet = await transaction.get(walletRef);

      if (!currentWallet.exists) {
        throw new Error("Wallet not found");
      }

      const walletData = currentWallet.data();

      if (type === "DEDUCT" && walletData.balance < amount) {
        throw new Error("Insufficient balance");
      }

      const newBalance =
        type === "ADD" ? walletData.balance + amount : walletData.balance - amount;
      const newVersion = walletData.version + 1;

      transaction.update(walletRef, {
        balance: newBalance,
        updatedAt: timestamp,
        version: newVersion,
      });

      transaction.set(db.collection("transactions").doc(), {
        transactionId,
        userId,
        walletId: wallet.doc.id,
        type,
        amount,
        previousBalance: walletData.balance,
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
        amount,
        previousBalance: walletData.balance,
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