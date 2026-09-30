const crypto = require("crypto");
const express = require("express");

const { TOKEN_BUNDLES } = require("../../config/billingConfig");
const { buildCheckoutUrl, buildPublicReturnUrl, createManagedOrder } = require("../../services/kpayService");
const { db } = require("./helpers");

const router = express.Router();
const MAX_HKD_AMOUNT = 100000.00;
const MAX_RETURN_PATH_LENGTH = 255;

const KPAY_PAYMENT_PURPOSES = {
  WALLET_TOP_UP: "wallet_topup",
  BUNDLE_PURCHASE: "bundle_purchase",
  TARGET_BUDGET_DIRECT: "target_budget_direct",
};

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
  purpose: payment.purpose || KPAY_PAYMENT_PURPOSES.WALLET_TOP_UP,
  purposeMeta: payment.purposeMeta || {},
});

const resolvePurpose = (rawPurpose) => {
  const purpose = `${rawPurpose || KPAY_PAYMENT_PURPOSES.WALLET_TOP_UP}`.trim();

  if (Object.values(KPAY_PAYMENT_PURPOSES).includes(purpose)) {
    return purpose;
  }

  return null;
};

const resolveReturnPath = (rawReturnPath, fallbackPath) => {
  const value = `${rawReturnPath || ""}`.trim();
  const selectedPath = value || fallbackPath;

  if (
    !selectedPath ||
    selectedPath.length > MAX_RETURN_PATH_LENGTH ||
    !selectedPath.startsWith("/") ||
    selectedPath.startsWith("//") ||
    /^https?:\/\//i.test(selectedPath)
  ) {
    return null;
  }

  return selectedPath;
};

const resolveBundleByCode = (bundleCode) =>
  TOKEN_BUNDLES.find((entry) => entry.code === `${bundleCode || ""}`.trim()) || null;

const createPurposePayload = ({ purpose, amount, body }) => {
  if (purpose === KPAY_PAYMENT_PURPOSES.BUNDLE_PURCHASE) {
    const bundle = resolveBundleByCode(body?.bundleCode);
    if (!bundle) {
      return {
        ok: false,
        status: 404,
        message: "Bundle not found",
      };
    }

    if (Math.round(Number(bundle.priceHkd) * 100) !== amount.cents) {
      return {
        ok: false,
        status: 400,
        message: "amount must match the selected bundle price",
      };
    }

    return {
      ok: true,
      description: `${bundle.title} bundle purchase`,
      itemName: `${bundle.title} bundle`,
      returnPath: resolveReturnPath(body?.returnPath, "/wallet?kpayResult=success"),
      purposeMeta: {
        bundleCode: bundle.code,
        bundleTitle: bundle.title,
        bundleTokens: Number(bundle.tokens) || 0,
      },
    };
  }

  if (purpose === KPAY_PAYMENT_PURPOSES.TARGET_BUDGET_DIRECT) {
    return {
      ok: true,
      description: `${body?.description || "Leaflet target budget payment"}`.trim(),
      itemName: "Leaflet target budget",
      returnPath: resolveReturnPath(body?.returnPath, "/flyer/create/leaflet?kpayResult=success"),
      purposeMeta: {
        targetBudgetHkd: amount.amount,
      },
    };
  }

  return {
    ok: true,
    description: `${body?.description || "Flyer Portal HKD credit top-up"}`.trim(),
    itemName: "Flyer Portal HKD credit",
    returnPath: resolveReturnPath(body?.returnPath, "/wallet?kpayResult=success"),
    purposeMeta: {},
  };
};

router.post("/kpay/orders", async (req, res) => {
  try {
    const companyId = `${req.user?.companyId || ""}`.trim();
    const userId = `${req.user?.userId || ""}`.trim();
    const amount = normalizeAmount(req.body?.amount);
    const idempotencyKey = `${req.body?.idempotencyKey || ""}`.trim();
    const language = `${req.body?.language || "zh-HK"}`.trim();
    const purpose = resolvePurpose(req.body?.purpose);

    if (!companyId) {
      return res.status(403).json({ success: false, message: "Company wallet access is required" });
    }

    if (!amount) {
      return res.status(400).json({ success: false, message: "amount must be a positive HKD value with no more than two decimal places" });
    }

    if (!purpose) {
      return res.status(400).json({ success: false, message: "Invalid KPay payment purpose" });
    }

    if (!idempotencyKey || idempotencyKey.length > 128) {
      return res.status(400).json({ success: false, message: "idempotencyKey is required and must not exceed 128 characters" });
    }

    if (!/^[A-Za-z]{2,8}(?:-[A-Za-z]{2,8})?$/.test(language)) {
      return res.status(400).json({ success: false, message: "language must be a valid language tag" });
    }

    const purposePayload = createPurposePayload({ purpose, amount, body: req.body || {} });
    if (!purposePayload.ok) {
      return res.status(purposePayload.status).json({ success: false, message: purposePayload.message });
    }

    const description = `${purposePayload.description || ""}`.trim();
    if (!description || description.length > 255) {
      return res.status(400).json({ success: false, message: "description is required and must not exceed 255 characters" });
    }

    if (!purposePayload.returnPath) {
      return res.status(400).json({ success: false, message: "returnPath must be a valid relative path" });
    }

    const paymentRef = db.collection("kpayPayments").doc(buildIdempotencyHash({ companyId, idempotencyKey }));
    const returnUrl = new URL(buildPublicReturnUrl(purposePayload.returnPath));
    returnUrl.searchParams.set("kpayPaymentId", paymentRef.id);
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
      purpose,
      purposeMeta: purposePayload.purposeMeta,
      returnPath: purposePayload.returnPath,
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
        itemName: purposePayload.itemName,
        returnUrl: returnUrl.toString(),
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

    res.set("Cache-Control", "no-store");
    return res.status(200).json({ success: true, data: serializePayment(paymentDoc.data() || {}) });
  } catch (error) {
    console.error("Error retrieving KPay payment:", error);
    return res.status(500).json({ success: false, message: "Internal server error retrieving KPay payment" });
  }
});

module.exports = router;