const express = require("express");

const { ensureCompanyWalletInTransaction } = require("../../services/companyWalletService");

module.exports = function createCreditRequestsRouter(context) {
  const { admin, db } = context;

  const router = express.Router();

  router.get("/credit-requests", async (req, res) => {
    try {
      const { status } = req.query;
      let query = db.collection("creditRequests");

      if (status) {
        query = query.where("status", "==", status);
      }

      query = query.orderBy("createdAt", "desc");
      const snapshot = await query.get();

      const requests = [];
      snapshot.forEach((doc) => {
        requests.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      res.status(200).json({
        success: true,
        data: requests,
      });
    } catch (error) {
      console.error("Error fetching credit requests:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch credit requests",
        error: error.message,
      });
    }
  });

  router.post("/credit-requests/:id/grant", async (req, res) => {
    try {
      const { id } = req.params;
      const adminId = req.user.userId;
      const timestamp = new Date().toISOString();

      const result = await db.runTransaction(async (transaction) => {
        const requestRef = db.collection("creditRequests").doc(id);
        const requestDoc = await transaction.get(requestRef);

        if (!requestDoc.exists) {
          throw new Error("Credit request not found");
        }

        const requestData = requestDoc.data();

        if (requestData.status === "granted") {
          return {
            alreadyGranted: true,
            id,
            amount: requestData.amount,
          };
        }

        if (requestData.status !== "pending") {
          throw new Error(`Credit request is already ${requestData.status}`);
        }

        const companyId = requestData.companyId;
        const companyDoc = await db.collection("companies").doc(companyId).get();
        const companyData = companyDoc.exists ? companyDoc.data() || {} : {};

        const companyWallet = await ensureCompanyWalletInTransaction({
          transaction,
          companyId,
          companyName: companyData?.name || "",
          companyDisplayName: companyData?.companyDisplayName || "",
          initialBalance: 0,
          timestamp,
        });

        const walletRef = companyWallet.ref || companyWallet.doc.ref;
        const walletData = companyWallet.data;
        const walletOwnerType = "company";

        const currentCreditBalanceHkd = Number(walletData.creditBalanceHkd) || 0;
        const newCreditBalanceHkd =
          currentCreditBalanceHkd + Number(requestData.amount);

        transaction.update(walletRef, {
          creditBalanceHkd: newCreditBalanceHkd,
          updatedAt: timestamp,
          version: (walletData.version || 0) + 1,
        });

        const txRef = db.collection("transactions").doc();
        transaction.set(txRef, {
          transactionId: admin.firestore.AutoId ? admin.firestore.AutoId() : txRef.id,
          userId: requestData.userId,
          walletId: walletRef.id,
          companyId: companyId || null,
          ownerType: walletOwnerType,
          type: "ADD",
          amount: requestData.amount,
          unit: "HKD",
          previousBalance: currentCreditBalanceHkd,
          newBalance: newCreditBalanceHkd,
          description: `Credit granted via request ${id}`,
          status: "COMPLETED",
          createdAt: timestamp,
          updatedAt: timestamp,
          metadata: {
            source: "credit_request_grant",
            requestId: id,
            grantedBy: adminId,
          },
        });

        transaction.update(requestRef, {
          status: "granted",
          grantedAt: timestamp,
          grantedBy: adminId,
          grantedWalletId: walletRef.id,
          grantedCompanyId: companyId || null,
          grantedOwnerType: walletOwnerType,
          updatedAt: timestamp,
        });

        return {
          id,
          amount: requestData.amount,
          newCreditBalanceHkd,
        };
      });

      if (result.alreadyGranted) {
        return res.status(200).json({
          success: true,
          message: "Credit request already granted",
          data: result,
        });
      }

      res.status(200).json({
        success: true,
        message: "Credit request granted successfully",
        data: result,
      });
    } catch (error) {
      console.error("Error granting credit request:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Failed to grant credit request",
      });
    }
  });

  return router;
};
