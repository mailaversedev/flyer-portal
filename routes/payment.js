const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const admin = require("firebase-admin");
const db = admin.firestore();
const { authenticateToken } = require("./auth");

// Helper function to generate transaction ID
const generateTransactionId = () => {
  return uuidv4();
};

// Helper function to get wallet by user ID
const getWalletByUserId = async (userId) => {
  const walletQuery = await db
    .collection("wallets")
    .where("userId", "==", userId)
    .where("isActive", "==", true)
    .limit(1)
    .get();

  if (walletQuery.empty) {
    throw new Error("Wallet not found for user");
  }

  return {
    doc: walletQuery.docs[0],
    data: walletQuery.docs[0].data(),
  };
};

// POST /api/payment/add-tokens - Add tokens to wallet (idempotent)
router.post("/add-tokens", authenticateToken, async (req, res) => {
  try {
    const { amount, description, idempotencyKey } = req.body;
    const userId = req.user.userId;

    // Validate required fields
    if (!amount || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: "Amount and idempotencyKey are required",
      });
    }

    // Validate amount is positive
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be positive",
      });
    }

    // Check for existing transaction with same idempotency key
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

    // Execute transaction
    const result = await db.runTransaction(async (transaction) => {
      // Get current wallet
      const wallet = await getWalletByUserId(userId);
      const walletRef = db.collection("wallets").doc(wallet.doc.id);
      const currentWallet = await transaction.get(walletRef);

      if (!currentWallet.exists) {
        throw new Error("Wallet not found");
      }

      const walletData = currentWallet.data();
      const newBalance = walletData.balance + amount;
      const newVersion = walletData.version + 1;

      // Update wallet balance
      transaction.update(walletRef, {
        balance: newBalance,
        updatedAt: timestamp,
        version: newVersion,
      });

      // Create transaction record
      const transactionData = {
        transactionId: transactionId,
        userId: userId,
        walletId: wallet.doc.id,
        type: "ADD",
        amount: amount,
        previousBalance: walletData.balance,
        newBalance: newBalance,
        description: description || "Add tokens to wallet",
        status: "COMPLETED",
        idempotencyKey: idempotencyKey,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const txRef = db.collection("transactions").doc();
      transaction.set(txRef, transactionData);

      return {
        transactionId,
        amount,
        previousBalance: walletData.balance,
        newBalance,
        status: "COMPLETED",
      };
    });

    res.status(200).json({
      success: true,
      message: "Tokens added successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error adding tokens:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during token addition",
      error: error.message,
    });
  }
});

// POST /api/payment/deduct-tokens - Deduct tokens from wallet (idempotent)
router.post("/deduct-tokens", authenticateToken, async (req, res) => {
  try {
    const { amount, description, idempotencyKey } = req.body;
    const userId = req.user.userId;

    // Validate required fields
    if (!amount || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: "Amount and idempotencyKey are required",
      });
    }

    // Validate amount is positive
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be positive",
      });
    }

    // Check for existing transaction with same idempotency key
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

    // Execute transaction
    const result = await db.runTransaction(async (transaction) => {
      // Get current wallet
      const wallet = await getWalletByUserId(userId);
      const walletRef = db.collection("wallets").doc(wallet.doc.id);
      const currentWallet = await transaction.get(walletRef);

      if (!currentWallet.exists) {
        throw new Error("Wallet not found");
      }

      const walletData = currentWallet.data();

      // Check if sufficient balance
      if (walletData.balance < amount) {
        throw new Error("Insufficient balance");
      }

      const newBalance = walletData.balance - amount;
      const newVersion = walletData.version + 1;

      // Update wallet balance
      transaction.update(walletRef, {
        balance: newBalance,
        updatedAt: timestamp,
        version: newVersion,
      });

      // Create transaction record
      const transactionData = {
        transactionId: transactionId,
        userId: userId,
        walletId: wallet.doc.id,
        type: "DEDUCT",
        amount: amount,
        previousBalance: walletData.balance,
        newBalance: newBalance,
        description: description || "Deduct tokens from wallet",
        status: "COMPLETED",
        idempotencyKey: idempotencyKey,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const txRef = db.collection("transactions").doc();
      transaction.set(txRef, transactionData);

      return {
        transactionId,
        amount,
        previousBalance: walletData.balance,
        newBalance,
        status: "COMPLETED",
      };
    });

    res.status(200).json({
      success: true,
      message: "Tokens deducted successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error deducting tokens:", error);

    if (error.message === "Insufficient balance") {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance in wallet",
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error during token deduction",
      error: error.message,
    });
  }
});

// GET /api/payment/wallet - Get wallet balance and details
router.get("/wallet", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const wallet = await getWalletByUserId(userId);

    res.status(200).json({
      success: true,
      data: {
        walletId: wallet.doc.id,
        userId: wallet.data.userId,
        balance: wallet.data.balance,
        currency: wallet.data.currency,
        createdAt: wallet.data.createdAt,
        updatedAt: wallet.data.updatedAt,
        isActive: wallet.data.isActive,
      },
    });
  } catch (error) {
    console.error("Error fetching wallet:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching wallet",
      error: error.message,
    });
  }
});

// GET /api/payment/transactions - Get transaction history
router.get("/transactions", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 50, offset = 0, type } = req.query;

    let query = db
      .collection("transactions")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc");

    // Filter by transaction type if specified
    if (type && (type === "ADD" || type === "DEDUCT")) {
      query = query.where("type", "==", type);
    }

    // Apply pagination
    query = query.limit(parseInt(limit)).offset(parseInt(offset));

    const snapshot = await query.get();
    const transactions = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      transactions.push({
        id: doc.id,
        transactionId: data.transactionId,
        type: data.type,
        amount: data.amount,
        previousBalance: data.previousBalance,
        newBalance: data.newBalance,
        description: data.description,
        status: data.status,
        createdAt: data.createdAt,
      });
    });

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: transactions.length,
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching transactions",
      error: error.message,
    });
  }
});

// GET /api/payment/transaction/:transactionId - Get specific transaction details
router.get(
  "/transaction/:transactionId",
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.userId;
      const { transactionId } = req.params;

      const txQuery = await db
        .collection("transactions")
        .where("transactionId", "==", transactionId)
        .where("userId", "==", userId)
        .limit(1)
        .get();

      if (txQuery.empty) {
        return res.status(404).json({
          success: false,
          message: "Transaction not found",
        });
      }

      const txData = txQuery.docs[0].data();

      res.status(200).json({
        success: true,
        data: {
          id: txQuery.docs[0].id,
          transactionId: txData.transactionId,
          userId: txData.userId,
          walletId: txData.walletId,
          type: txData.type,
          amount: txData.amount,
          previousBalance: txData.previousBalance,
          newBalance: txData.newBalance,
          description: txData.description,
          status: txData.status,
          idempotencyKey: txData.idempotencyKey,
          createdAt: txData.createdAt,
          updatedAt: txData.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error fetching transaction:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error fetching transaction",
        error: error.message,
      });
    }
  }
);

module.exports = router;
