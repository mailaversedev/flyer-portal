const express = require("express");

const { authenticateToken } = require("../auth");
const {
  DAILY_FREE_GENERATIONS_PER_COMPANY,
  TOKEN_BUNDLES,
  TOKEN_PRICING,
} = require("../../config/billingConfig");
const {
  createCompanyWalletIfMissing,
  getCompanyDailyUsage,
  serializeCompanyWallet,
} = require("../../services/companyWalletService");
const { db, getWalletByUserId } = require("./helpers");

const router = express.Router();

router.get("/wallet", authenticateToken, async (req, res) => {
  try {
    if (req.user?.companyId) {
      const wallet = await createCompanyWalletIfMissing({ companyId: req.user.companyId, initialBalance: 0 });
      const dailyUsage = await getCompanyDailyUsage(req.user.companyId);
      const freeAttemptsUsed = Number(dailyUsage.data?.freeGenerationAttemptsUsed) || 0;

      return res.status(200).json({
        success: true,
        data: {
          ...serializeCompanyWallet(wallet),
          dailyFreeAttemptsDate: dailyUsage.dateKey,
          dailyFreeAttemptsLimit: DAILY_FREE_GENERATIONS_PER_COMPANY,
          dailyFreeAttemptsUsed: freeAttemptsUsed,
          dailyFreeAttemptsRemaining: Math.max(0, DAILY_FREE_GENERATIONS_PER_COMPANY - freeAttemptsUsed),
          bundles: TOKEN_BUNDLES,
          pricing: TOKEN_PRICING,
        },
      });
    }

    const wallet = await getWalletByUserId(req.user.userId);
    return res.status(200).json({
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
    return res.status(500).json({ success: false, message: "Internal server error fetching wallet", error: error.message });
  }
});

router.get("/transactions", authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, type } = req.query;
    let query = db.collection("transactions").orderBy("createdAt", "desc");
    query = req.user?.companyId
      ? query.where("companyId", "==", req.user.companyId)
      : query.where("userId", "==", req.user.userId);
    if (type && (type === "ADD" || type === "DEDUCT")) query = query.where("type", "==", type);
    query = query.limit(parseInt(limit)).offset(parseInt(offset));

    const snapshot = await query.get();
    const transactions = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        transactionId: data.transactionId,
        type: data.type,
        amount: data.amount,
        previousBalance: data.previousBalance,
        newBalance: data.newBalance,
        balanceField: data.balanceField || data.metadata?.balanceField || "balance",
        unit: data.unit || data.metadata?.unit || "TOKEN",
        description: data.description,
        status: data.status,
        createdAt: data.createdAt,
        metadata: data.metadata,
      };
    });

    return res.status(200).json({
      success: true,
      data: transactions,
      pagination: { limit: parseInt(limit), offset: parseInt(offset), count: transactions.length },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return res.status(500).json({ success: false, message: "Internal server error fetching transactions", error: error.message });
  }
});

router.get("/transaction/:transactionId", authenticateToken, async (req, res) => {
  try {
    let txQuery = db.collection("transactions").where("transactionId", "==", req.params.transactionId).limit(1);
    txQuery = req.user?.companyId
      ? txQuery.where("companyId", "==", req.user.companyId)
      : txQuery.where("userId", "==", req.user.userId);

    const txSnapshot = await txQuery.get();
    if (txSnapshot.empty) return res.status(404).json({ success: false, message: "Transaction not found" });

    const txData = txSnapshot.docs[0].data();
    return res.status(200).json({
      success: true,
      data: {
        id: txSnapshot.docs[0].id,
        transactionId: txData.transactionId,
        userId: txData.userId,
        companyId: txData.companyId,
        walletId: txData.walletId,
        type: txData.type,
        amount: txData.amount,
        previousBalance: txData.previousBalance,
        newBalance: txData.newBalance,
        balanceField: txData.balanceField || txData.metadata?.balanceField || "balance",
        unit: txData.unit || txData.metadata?.unit || "TOKEN",
        description: txData.description,
        status: txData.status,
        idempotencyKey: txData.idempotencyKey,
        createdAt: txData.createdAt,
        updatedAt: txData.updatedAt,
        metadata: txData.metadata,
      },
    });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return res.status(500).json({ success: false, message: "Internal server error fetching transaction", error: error.message });
  }
});

module.exports = router;