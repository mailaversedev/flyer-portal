const express = require("express");
const { v4: uuidv4 } = require("uuid");
const admin = require("firebase-admin");

const { authenticateToken } = require("./auth");
const {
  DAILY_FREE_GENERATIONS_PER_COMPANY,
  TOKEN_BUNDLES,
  TOKEN_PRICING,
} = require("../config/billingConfig");
const {
  createCompanyWalletTransaction,
  createCompanyWalletIfMissing,
  ensureCompanyWalletInTransaction,
  getCompanyDailyUsage,
  serializeCompanyWallet,
} = require("../services/companyWalletService");

const router = express.Router();
const db = admin.firestore();

const roundMoneyAmount = (value) => Math.round(Number(value) * 100) / 100;
const NUMERIC_SEGMENT_REGEX = /^\d+$/;

// Helper function to generate transaction ID
const generateTransactionId = () => {
  return uuidv4();
};

const buildAssignedVoucherNumber = ({
  prefix,
  startSequence,
  endSequence,
  redeemedCount,
  startCode,
}) => {
  const normalizedPrefix = `${prefix || ""}`.trim();

  if (!normalizedPrefix) {
    throw new Error("__VOUCHER_PREFIX_MISSING__");
  }

  const normalizedStartCode = `${startCode || ""}`.trim();
  const suffixWidth = normalizedStartCode.length > 0 ? normalizedStartCode.length : 1;

  const start = Number.parseInt(startSequence, 10);
  const end = Number.parseInt(endSequence, 10);
  const redeemed = Number.parseInt(redeemedCount, 10);

  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(redeemed)) {
    throw new Error("__VOUCHER_RANGE_INVALID__");
  }

  const assignedSequence = start + redeemed;

  if (assignedSequence > end) {
    throw new Error("__VOUCHER_SOLD_OUT__");
  }

  const suffix = `${assignedSequence}`.padStart(suffixWidth, "0");

  if (!NUMERIC_SEGMENT_REGEX.test(suffix)) {
    throw new Error("__VOUCHER_RANGE_INVALID__");
  }

  return `${normalizedPrefix}${suffix}`;
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
        metadata: {
          source: "manual_topup",
        },
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

// POST /api/payment/redeem-voucher - Deduct tokens and assign a specific voucher number (idempotent)
router.post("/redeem-voucher", authenticateToken, async (req, res) => {
  try {
    const { voucherId, idempotencyKey, description } = req.body || {};
    const userId = req.user.userId;

    if (!voucherId || !idempotencyKey) {
      return res.status(400).json({
        success: false,
        message: "voucherId and idempotencyKey are required",
      });
    }

    const timestamp = new Date().toISOString();
    const redemptionRef = db
      .collection("voucherRedemptions")
      .doc(`${userId}_${idempotencyKey}`);

    const result = await db.runTransaction(async (transaction) => {
      const existingRedemption = await transaction.get(redemptionRef);

      if (existingRedemption.exists) {
        const existingData = existingRedemption.data() || {};
        return existingData.result;
      }

      const voucherRef = db.collection("vouchers").doc(voucherId);
      const voucherDoc = await transaction.get(voucherRef);

      if (!voucherDoc.exists) {
        throw new Error("__VOUCHER_NOT_FOUND__");
      }

      const voucherData = voucherDoc.data() || {};
      const voucherCost = Number(voucherData.cost);

      if (!Number.isFinite(voucherCost) || voucherCost <= 0) {
        throw new Error("__VOUCHER_COST_INVALID__");
      }

      if (voucherData.isActive === false) {
        throw new Error("__VOUCHER_INACTIVE__");
      }

      if (voucherData.expiryDate) {
        const expiryDate = new Date(voucherData.expiryDate);

        if (Number.isNaN(expiryDate.getTime()) || expiryDate.getTime() < Date.now()) {
          throw new Error("__VOUCHER_EXPIRED__");
        }
      }

      const totalNumber = Number.parseInt(voucherData.totalNumber, 10);
      const redeemedCount = Number.parseInt(voucherData.redeemedCount || 0, 10);

      if (!Number.isFinite(totalNumber) || totalNumber <= 0) {
        throw new Error("__VOUCHER_STOCK_INVALID__");
      }

      if (!Number.isFinite(redeemedCount) || redeemedCount < 0) {
        throw new Error("__VOUCHER_STOCK_INVALID__");
      }

      if (redeemedCount >= totalNumber) {
        throw new Error("__VOUCHER_SOLD_OUT__");
      }

      const voucherType = `${voucherData.voucherType || "static"}`.trim() || "static";
      const assignedVoucherNumber =
        voucherType === "numbered"
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

      if (!walletSnapshot.exists) {
        throw new Error("__WALLET_NOT_FOUND__");
      }

      const walletData = walletSnapshot.data() || {};
      const previousBalance = Number(walletData.balance) || 0;

      if (previousBalance < voucherCost) {
        throw new Error("__INSUFFICIENT_BALANCE__");
      }

      const newBalance = previousBalance - voucherCost;
      const newVersion = (Number(walletData.version) || 0) + 1;

      transaction.update(walletRef, {
        balance: newBalance,
        updatedAt: timestamp,
        version: newVersion,
      });

      const transactionId = generateTransactionId();
      const walletTransactionData = {
        transactionId,
        userId,
        walletId: wallet.doc.id,
        type: "DEDUCT",
        amount: voucherCost,
        previousBalance,
        newBalance,
        description:
          description ||
          `Redeemed ${voucherData.value || ""} ${voucherData.merchant || ""} Voucher`,
        status: "COMPLETED",
        idempotencyKey,
        createdAt: timestamp,
        updatedAt: timestamp,
        metadata: {
          source: "voucher_redeem",
          voucherId,
          assignedVoucherNumber,
        },
      };

      transaction.set(db.collection("transactions").doc(), walletTransactionData);

      const nextRedeemedCount = redeemedCount + 1;
      transaction.set(
        voucherRef,
        {
          redeemedCount: nextRedeemedCount,
          updatedAt: timestamp,
        },
        { merge: true },
      );

      const resultData = {
        transactionId,
        amount: voucherCost,
        previousBalance,
        newBalance,
        status: "COMPLETED",
        assignedVoucherNumber,
        voucher: {
          id: voucherDoc.id,
          value: voucherData.value || "",
          cost: voucherCost,
          merchant: voucherData.merchant || "",
          merchantIcon: voucherData.merchantIcon || "",
          voucherImage: voucherData.voucherImage || "",
          voucherType,
          expiryDate: voucherData.expiryDate || "",
          totalNumber,
          redeemedCount: nextRedeemedCount,
          remainingCount: Math.max(0, totalNumber - nextRedeemedCount),
          qrCode:
            voucherType === "numbered"
              ? assignedVoucherNumber
              : (voucherData.qrCode || ""),
          promotionCode:
            voucherType === "numbered"
              ? assignedVoucherNumber
              : (voucherData.promotionCode || ""),
          claimedVoucherNumber: assignedVoucherNumber,
          colors: Array.isArray(voucherData.colors) ? voucherData.colors : [],
          terms: voucherData.terms || "",
          isActive: voucherData.isActive !== false,
        },
      };

      transaction.set(redemptionRef, {
        userId,
        voucherId,
        idempotencyKey,
        assignedVoucherNumber,
        createdAt: timestamp,
        updatedAt: timestamp,
        result: resultData,
      });

      return resultData;
    });

    return res.status(200).json({
      success: true,
      message: "Voucher redeemed successfully",
      data: result,
    });
  } catch (error) {
    if (error.message === "__VOUCHER_NOT_FOUND__") {
      return res.status(404).json({
        success: false,
        message: "Voucher not found",
      });
    }

    if (error.message === "__WALLET_NOT_FOUND__") {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    if (error.message === "__INSUFFICIENT_BALANCE__") {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance in wallet",
      });
    }

    if (error.message === "__VOUCHER_SOLD_OUT__") {
      return res.status(409).json({
        success: false,
        message: "Voucher is sold out",
      });
    }

    if (error.message === "__VOUCHER_EXPIRED__") {
      return res.status(409).json({
        success: false,
        message: "Voucher is expired",
      });
    }

    if (error.message === "__VOUCHER_INACTIVE__") {
      return res.status(409).json({
        success: false,
        message: "Voucher is inactive",
      });
    }

    if (
      error.message === "__VOUCHER_PREFIX_MISSING__" ||
      error.message === "__VOUCHER_RANGE_INVALID__" ||
      error.message === "__VOUCHER_STOCK_INVALID__" ||
      error.message === "__VOUCHER_COST_INVALID__"
    ) {
      return res.status(400).json({
        success: false,
        message: "Voucher configuration is invalid",
      });
    }

    console.error("Error redeeming voucher:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during voucher redemption",
      error: error.message,
    });
  }
});

// POST /api/payment/purchase-bundle - Exchange HKD credit for tokens
router.post("/purchase-bundle", authenticateToken, async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const bundleCode = `${req.body?.bundleCode || ""}`.trim();

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: "Company wallet access is required",
      });
    }

    if (!bundleCode) {
      return res.status(400).json({
        success: false,
        message: "Bundle code is required",
      });
    }

    const bundle = TOKEN_BUNDLES.find((entry) => entry.code === bundleCode);

    if (!bundle) {
      return res.status(404).json({
        success: false,
        message: "Bundle not found",
      });
    }

    const timestamp = new Date().toISOString();

    const result = await db.runTransaction(async (transaction) => {
      const wallet = await ensureCompanyWalletInTransaction({
        transaction,
        companyId,
        companyName: "",
        companyDisplayName: "",
        initialBalance: 0,
        timestamp,
      });
      const walletRef = wallet.ref || wallet.doc.ref;
      const walletSnapshot = await transaction.get(walletRef);

      if (!walletSnapshot.exists) {
        throw new Error("__WALLET_NOT_FOUND__");
      }

      const walletData = walletSnapshot.data() || {};
      const previousBalance = Number(walletData.balance) || 0;
      const previousCreditBalanceHkd = Number(walletData.creditBalanceHkd) || 0;
      const priceHkd = roundMoneyAmount(bundle.priceHkd);

      if (previousCreditBalanceHkd < priceHkd) {
        throw new Error("__INSUFFICIENT_CREDIT__");
      }

      const newBalance = previousBalance + bundle.tokens;
      const newCreditBalanceHkd = roundMoneyAmount(previousCreditBalanceHkd - priceHkd);

      transaction.set(
        walletRef,
        {
          balance: newBalance,
          creditBalanceHkd: newCreditBalanceHkd,
          updatedAt: timestamp,
          version: (Number(walletData.version) || 0) + 1,
        },
        { merge: true },
      );

      createCompanyWalletTransaction({
        transaction,
        walletId: walletRef.id,
        companyId,
        type: "DEDUCT",
        amount: priceHkd,
        previousBalance: previousCreditBalanceHkd,
        newBalance: newCreditBalanceHkd,
        balanceField: "creditBalanceHkd",
        unit: "HKD",
        description: `${bundle.title} purchase (+${bundle.tokens} tokens)`,
        timestamp,
        metadata: {
          source: "bundle_purchase",
          bundleCode: bundle.code,
          bundleTitle: bundle.title,
          tokenAmount: bundle.tokens,
          tokenBalanceBefore: previousBalance,
          tokenBalanceAfter: newBalance,
          priceHkd,
        },
      });

      return {
        bundle,
        previousBalance,
        newBalance,
        previousCreditBalanceHkd,
        newCreditBalanceHkd,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Bundle purchased successfully",
      data: result,
    });
  } catch (error) {
    if (error.message === "__WALLET_NOT_FOUND__") {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    if (error.message === "__INSUFFICIENT_CREDIT__") {
      return res.status(400).json({
        success: false,
        message: "Insufficient HKD credit",
      });
    }

    console.error("Error purchasing bundle:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error purchasing bundle",
      error: error.message,
    });
  }
});

// GET /api/payment/wallet - Get wallet balance and details
router.get("/wallet", authenticateToken, async (req, res) => {
  try {
    if (req.user?.companyId) {
      const wallet = await createCompanyWalletIfMissing({
        companyId: req.user.companyId,
        initialBalance: 0,
      });
      const dailyUsage = await getCompanyDailyUsage(req.user.companyId);
      const freeAttemptsUsed = Number(dailyUsage.data?.freeGenerationAttemptsUsed) || 0;
      const freeAttemptsRemaining = Math.max(
        0,
        DAILY_FREE_GENERATIONS_PER_COMPANY - freeAttemptsUsed,
      );

      return res.status(200).json({
        success: true,
        data: {
          ...serializeCompanyWallet(wallet),
          dailyFreeAttemptsDate: dailyUsage.dateKey,
          dailyFreeAttemptsLimit: DAILY_FREE_GENERATIONS_PER_COMPANY,
          dailyFreeAttemptsUsed: freeAttemptsUsed,
          dailyFreeAttemptsRemaining: freeAttemptsRemaining,
          bundles: TOKEN_BUNDLES,
          pricing: TOKEN_PRICING,
        },
      });
    }

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
    const { limit = 50, offset = 0, type } = req.query;

    let query = db.collection("transactions").orderBy("createdAt", "desc");

    if (req.user?.companyId) {
      query = query.where("companyId", "==", req.user.companyId);
    } else {
      query = query.where("userId", "==", req.user.userId);
    }

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
        balanceField: data.balanceField || data.metadata?.balanceField || "balance",
        unit: data.unit || data.metadata?.unit || "TOKEN",
        description: data.description,
        status: data.status,
        createdAt: data.createdAt,
        metadata: data.metadata,
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
      const { transactionId } = req.params;

      let txQuery = db
        .collection("transactions")
        .where("transactionId", "==", transactionId)
        .limit(1);

      if (req.user?.companyId) {
        txQuery = txQuery.where("companyId", "==", req.user.companyId);
      } else {
        txQuery = txQuery.where("userId", "==", req.user.userId);
      }

      const txSnapshot = await txQuery.get();

      if (txSnapshot.empty) {
        return res.status(404).json({
          success: false,
          message: "Transaction not found",
        });
      }

      const txData = txSnapshot.docs[0].data();

      res.status(200).json({
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
          balanceField:
            txData.balanceField || txData.metadata?.balanceField || "balance",
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
      res.status(500).json({
        success: false,
        message: "Internal server error fetching transaction",
        error: error.message,
      });
    }
  },
);

// POST /api/payment/credit-request - Submit a credit request
router.post("/credit-request", authenticateToken, async (req, res) => {
  try {
    const { amount, paymentMethod, receiptUrl } = req.body;
    const { userId, username, companyId } = req.user;

    if (!amount || amount <= 0 || !paymentMethod || !receiptUrl) {
      return res.status(400).json({
        success: false,
        message: "Amount, paymentMethod, and receiptUrl are required",
      });
    }

    const timestamp = new Date().toISOString();
    let companyName = "";
    let companyDisplayName = "";

    if (companyId) {
      const companyDoc = await db.collection("companies").doc(companyId).get();

      if (companyDoc.exists) {
        const companyData = companyDoc.data() || {};
        companyName = companyData.name || "";
        companyDisplayName = companyData.companyDisplayName || "";
      }
    }

    const requestData = {
      userId,
      username,
      companyId,
      companyName,
      companyDisplayName,
      amount: Number(amount),
      paymentMethod,
      receiptUrl,
      status: "pending",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await db.collection("creditRequests").add(requestData);

    res.status(201).json({
      success: true,
      message: "Credit request submitted successfully",
      data: {
        id: docRef.id,
        ...requestData,
      },
    });
  } catch (error) {
    console.error("Error creating credit request:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during credit request",
      error: error.message,
    });
  }
});

module.exports = router;
