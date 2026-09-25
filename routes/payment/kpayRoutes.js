const crypto = require("crypto");
const express = require("express");

const { createCompanyWalletTransaction, ensureCompanyWalletInTransaction } = require("../../services/companyWalletService");
const { buildCheckoutUrl, createManagedOrder } = require("../../services/kpayService");
const { db } = require("./helpers");

const router = express.Router();
const MAX_HKD_AMOUNT = 99999999.99;

const normalizeAmount = (value) => {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(`${value ?? ""}`.trim());
  if (!match) {
    return null;
  }

  const cents = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > Math.round(MAX_HKD_AMOUNT * 100)) {
    return null;
  }

  return { amount: cents / 100, cents };
};

const buildManagedOutTradeNo = () =>
  `KP${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(8).toString("hex").toUpperCase()}`;

const buildIdempotencyHash = ({ companyId, idempotencyKey }) =>
  crypto.createHash("sha256").update(`${companyId}:${idempotencyKey}`).digest("hex");

const serializePayment = (payment) => ({
  paymentId: payment.paymentId,
  amount: payment.amount,
  currency: payment.currency,
  status: payment.status,
  managedOrderNo: payment.managedOrderNo || null,
  managedOutTradeNo: payment.managedOutTradeNo,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
  paidAt: payment.paidAt || null,
  failureReason: payment.failureReason || null,
});

router.post("/kpay/orders", async (req, res) => {
  try {
    const companyId = `${req.user?.companyId || ""}`.trim();
    const userId = `${req.user?.userId || ""}`.trim();
    const amount = normalizeAmount(req.body?.amount);
    const idempotencyKey = `${req.body?.idempotencyKey || ""}`.trim();
    const language = `${req.body?.language || "zh-HK"}`.trim();
    const description = `${req.body?.description || "Flyer Portal HKD credit top-up"}`.trim();

    if (!companyId) {
      return res.status(403).json({ success: false, message: "Company wallet access is required" });
    }

    if (!amount) {
      return res.status(400).json({ success: false, message: "amount must be a positive HKD value with no more than two decimal places" });
    }

    if (!idempotencyKey || idempotencyKey.length > 128) {
      return res.status(400).json({ success: false, message: "idempotencyKey is required and must not exceed 128 characters" });
    }

    if (!/^[A-Za-z]{2,8}(?:-[A-Za-z]{2,8})?$/.test(language)) {
      return res.status(400).json({ success: false, message: "language must be a valid language tag" });
    }

    if (!description || description.length > 255) {
      return res.status(400).json({ success: false, message: "description is required and must not exceed 255 characters" });
    }

    const paymentRef = db.collection("kpayPayments").doc(buildIdempotencyHash({ companyId, idempotencyKey }));
    const timestamp = new Date().toISOString();
    const initialPayment = {
      paymentId: paymentRef.id,
      provider: "KPAY",
      companyId,
      userId,
      idempotencyKey,
      amount: amount.amount,
      amountCents: amount.cents,
      currency: "HKD",
      language,
      description,
      managedOutTradeNo: buildManagedOutTradeNo(),
      status: "CREATING",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const reservation = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(paymentRef);

      if (existing.exists) {
        return { created: false, payment: existing.data() || {} };
      }

      transaction.set(paymentRef, initialPayment);
      return { created: true, payment: initialPayment };
    });

    if (!reservation.created) {
      const existingPayment = reservation.payment;

      if (existingPayment.status === "PENDING" && existingPayment.managedOrderNo) {
        const checkoutUrl = buildCheckoutUrl({
          managedOrderNo: existingPayment.managedOrderNo,
          language: existingPayment.language || "zh-HK",
        });
        return res.status(200).json({
          success: true,
          message: "Existing KPay payment returned",
          data: { ...serializePayment(existingPayment), checkoutUrl },
        });
      }

      return res.status(409).json({
        success: false,
        message: "A KPay payment already exists for this idempotencyKey",
        data: serializePayment(existingPayment),
      });
    }

    let managedOrder;
    try {
      managedOrder = await createManagedOrder({
        managedOutTradeNo: initialPayment.managedOutTradeNo,
        amount: initialPayment.amount,
        orderRemark: initialPayment.description,
        itemName: "Flyer Portal HKD credit",
      });
    } catch (error) {
      await paymentRef.update({
        status: "CREATION_FAILED",
        failureReason: error.message || "KPay order creation failed",
        kpayCode: error.gatewayCode || null,
        updatedAt: new Date().toISOString(),
      });
      throw error;
    }

    const payment = {
      ...initialPayment,
      managedOrderNo: managedOrder.managedOrderNo,
      status: "PENDING",
      updatedAt: new Date().toISOString(),
    };
    await paymentRef.update({
      managedOrderNo: payment.managedOrderNo,
      status: payment.status,
      updatedAt: payment.updatedAt,
    });

    return res.status(201).json({
      success: true,
      message: "KPay payment created",
      data: { ...serializePayment(payment), checkoutUrl: managedOrder.checkoutUrl },
    });
  } catch (error) {
    if (error.code === "KPAY_CONFIGURATION_ERROR") {
      return res.status(503).json({ success: false, message: error.message });
    }

    if (error.code === "KPAY_GATEWAY_ERROR") {
      return res.status(502).json({
        success: false,
        message: "KPay could not create the payment order",
        errorCode: error.gatewayCode || null,
      });
    }

    console.error("Error creating KPay payment:", error);
    return res.status(500).json({ success: false, message: "Internal server error creating KPay payment" });
  }
});

router.get("/kpay/orders/:paymentId", async (req, res) => {
  try {
    const companyId = `${req.user?.companyId || ""}`.trim();
    const paymentId = `${req.params.paymentId || ""}`.trim();

    if (!companyId) {
      return res.status(403).json({ success: false, message: "Company wallet access is required" });
    }

    if (!/^[a-f0-9]{64}$/.test(paymentId)) {
      return res.status(400).json({ success: false, message: "Invalid payment ID" });
    }

    const paymentDoc = await db.collection("kpayPayments").doc(paymentId).get();
    if (!paymentDoc.exists || paymentDoc.data()?.companyId !== companyId) {
      return res.status(404).json({ success: false, message: "KPay payment not found" });
    }

    return res.status(200).json({ success: true, data: serializePayment(paymentDoc.data() || {}) });
  } catch (error) {
    console.error("Error retrieving KPay payment:", error);
    return res.status(500).json({ success: false, message: "Internal server error retrieving KPay payment" });
  }
});

module.exports = router;