const express = require("express");

const {
  createCompanyWalletTransaction,
  ensureCompanyWalletInTransaction,
} = require("../../services/companyWalletService");

module.exports = function createCompaniesRouter(context) {
  const { db, normalizeLimit, normalizeMoneyAmount, normalizeString } = context;

  const router = express.Router();

  router.get("/companies", async (req, res) => {
    try {
      const limit = normalizeLimit(req.query.limit);
      const direction = req.query.direction === "asc" ? "asc" : "desc";

      const snapshot = await db
        .collection("companies")
        .orderBy("createdAt", direction)
        .limit(limit)
        .get();

      const walletSnapshot = await db
        .collection("wallets")
        .where("ownerType", "==", "company")
        .where("isActive", "==", true)
        .get();

      const walletByCompanyId = new Map();
      walletSnapshot.docs.forEach((walletDoc) => {
        const walletData = walletDoc.data() || {};

        if (walletData.companyId && !walletByCompanyId.has(walletData.companyId)) {
          walletByCompanyId.set(walletData.companyId, {
            walletId: walletDoc.id,
            balance: Number(walletData.balance) || 0,
            creditBalanceHkd: Number(walletData.creditBalanceHkd) || 0,
            creditCurrency: walletData.creditCurrency || "HKD",
            updatedAt: walletData.updatedAt || null,
          });
        }
      });

      const companies = snapshot.docs.map((doc) => {
        const data = doc.data() || {};
        const wallet = walletByCompanyId.get(doc.id) || null;

        return {
          id: doc.id,
          companyDisplayName: data.companyDisplayName || "",
          name: data.name || "",
          nature: data.nature || "",
          contact: data.contact || "",
          address: data.address || "",
          website: data.website || "",
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
          isActive: data.isActive !== false,
          walletId: wallet?.walletId || null,
          walletBalance: wallet?.balance || 0,
          walletCreditBalanceHkd: wallet?.creditBalanceHkd || 0,
          walletCreditCurrency: wallet?.creditCurrency || "HKD",
          walletUpdatedAt: wallet?.updatedAt || null,
        };
      });

      res.status(200).json({
        success: true,
        data: companies,
      });
    } catch (error) {
      console.error("Error fetching admin company list:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch companies",
        error: error.message,
      });
    }
  });

  router.post("/companies/:companyId/manage-wallet", async (req, res) => {
    try {
      const { companyId } = req.params;
      const amountHkd = normalizeMoneyAmount(req.body?.amountHkd ?? req.body?.amount);
      const note = normalizeString(req.body?.note);
      const receiptImageUrl = normalizeString(req.body?.receiptImageUrl);

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: "Company ID is required",
        });
      }

      if (!amountHkd) {
        return res.status(400).json({
          success: false,
          message: "Grant amount must be a positive HKD value",
        });
      }

      if (!receiptImageUrl) {
        return res.status(400).json({
          success: false,
          message: "Receipt image is required",
        });
      }

      const companyDoc = await db.collection("companies").doc(companyId).get();

      if (!companyDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      const companyData = companyDoc.data() || {};
      const timestamp = new Date().toISOString();

      const result = await db.runTransaction(async (transaction) => {
        const wallet = await ensureCompanyWalletInTransaction({
          transaction,
          companyId,
          companyName: companyData.name || "",
          companyDisplayName: companyData.companyDisplayName || "",
          initialBalance: 0,
          timestamp,
        });
        const walletRef = wallet.ref || wallet.doc.ref;
        const previousBalance = Number(wallet.data.balance) || 0;
        const previousCreditBalanceHkd = Number(wallet.data.creditBalanceHkd) || 0;
        const newCreditBalanceHkd = previousCreditBalanceHkd + amountHkd;

        transaction.set(
          walletRef,
          {
            companyName: companyData.name || wallet.data.companyName || "",
            companyDisplayName:
              companyData.companyDisplayName ||
              wallet.data.companyDisplayName ||
              "",
            creditBalanceHkd: newCreditBalanceHkd,
            updatedAt: timestamp,
            version: (Number(wallet.data.version) || 0) + 1,
          },
          { merge: true },
        );

        createCompanyWalletTransaction({
          transaction,
          walletId: walletRef.id,
          companyId,
          type: "ADD",
          amount: amountHkd,
          previousBalance: previousCreditBalanceHkd,
          newBalance: newCreditBalanceHkd,
          balanceField: "creditBalanceHkd",
          unit: "HKD",
          description: note || "Offline wallet credit grant",
          timestamp,
          metadata: {
            source: "super_admin_credit_grant",
            grantedBy: req.user?.username || req.user?.userId || "",
            note,
            receiptImageUrl,
            tokenBalanceSnapshot: previousBalance,
          },
        });

        return {
          walletId: walletRef.id,
          previousBalance,
          newBalance: previousBalance,
          previousCreditBalanceHkd,
          newCreditBalanceHkd,
        };
      });

      return res.status(200).json({
        success: true,
        message: "Wallet credit updated successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error managing company wallet:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update company wallet",
        error: error.message,
      });
    }
  });

  return router;
};
