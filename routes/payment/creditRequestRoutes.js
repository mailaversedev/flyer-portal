const express = require("express");

const { authenticateToken } = require("../auth");
const { db } = require("./helpers");

const router = express.Router();

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

    return res.status(201).json({
      success: true,
      message: "Credit request submitted successfully",
      data: { id: docRef.id, ...requestData },
    });
  } catch (error) {
    console.error("Error creating credit request:", error);
    return res.status(500).json({ success: false, message: "Internal server error during credit request", error: error.message });
  }
});

module.exports = router;