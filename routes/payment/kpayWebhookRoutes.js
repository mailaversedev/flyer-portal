const express = require("express");

const { TOKEN_BUNDLES } = require("../../config/billingConfig");
const { createCompanyWalletTransaction, ensureCompanyWalletInTransaction } = require("../../services/companyWalletService");
const { getKPayConfig, verifyWebhook } = require("../../services/kpayService");
const { db } = require("./helpers");

const router = express.Router();
const CALLBACK_PATH = "/api/payment/kpay/notify";
const KPAY_PAYMENT_PURPOSES = {
  WALLET_TOP_UP: "wallet_topup",
  BUNDLE_PURCHASE: "bundle_purchase",
  TARGET_BUDGET_DIRECT: "target_budget_direct",
};

const toCents = (value) => {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(`${value ?? ""}`.trim());
  if (!match) {
    return null;
  }

  const cents = Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
};

const getReportedAmount = (payload) => payload.localPayAmount ?? payload.payAmount;
const getReportedCurrency = (payload) => `${payload.localPayCurrency || payload.payCurrency || ""}`.toUpperCase();

const roundToMoney = (value) => Math.round(Number(value) * 100) / 100;

router.post("/notify", async (req, res) => {
  const rawBody = req.rawBody || "";

  try {
    if (!verifyWebhook({ headers: req.headers, rawBody, callbackPath: CALLBACK_PATH })) {
      return res.status(401).json({ success: false, message: "Invalid KPay webhook signature" });
    }

    const payload = req.body || {};
  const config = getKPayConfig();
    const managedOrderNo = `${payload.managedOrderNo || ""}`.trim();
    const managedOutTradeNo = `${payload.managedMerchantOrderNo || payload.managedOutTradeNo || ""}`.trim();
    const reportedAmountCents = toCents(getReportedAmount(payload));
    const reportedCurrency = getReportedCurrency(payload);

    if (
      !managedOrderNo ||
      !managedOutTradeNo ||
      `${payload.merchantCode || ""}`.trim() !== config.merchantCode ||
      reportedAmountCents === null ||
      reportedCurrency !== "HKD"
    ) {
      return res.status(400).json({ success: false, message: "Invalid KPay payment notification" });
    }

    const paymentQuery = await db
      .collection("kpayPayments")
      .where("managedOrderNo", "==", managedOrderNo)
      .limit(1)
      .get();

    if (paymentQuery.empty) {
      return res.status(404).json({ success: false, message: "KPay payment not found" });
    }

    const paymentRef = paymentQuery.docs[0].ref;
    const callbackState = Number(payload.transactionState);
    const timestamp = new Date().toISOString();

    await db.runTransaction(async (transaction) => {
      const paymentSnapshot = await transaction.get(paymentRef);
      if (!paymentSnapshot.exists) {
        throw new Error("__PAYMENT_NOT_FOUND__");
      }

      const payment = paymentSnapshot.data() || {};
      if (
        payment.managedOrderNo !== managedOrderNo ||
        payment.managedOutTradeNo !== managedOutTradeNo ||
        payment.amountCents !== reportedAmountCents ||
        payment.currency !== reportedCurrency
      ) {
        throw new Error("__PAYMENT_MISMATCH__");
      }

      if (payment.status === "PAID") {
        return;
      }

      const callbackData = {
        eventType: `${payload.eventType || ""}`,
        orderNo: `${payload.orderNo || ""}`,
        transactionNo: `${payload.transactionNo || ""}`,
        transactionState: callbackState,
        transactionStateDesc: `${payload.transactionStateDesc || ""}`,
        transactionFinishTime: Number(payload.transactionFinishTime) || null,
      };

      if (callbackState !== 2) {
        transaction.update(paymentRef, {
          status: "FAILED",
          failureReason: callbackData.transactionStateDesc || "KPay reported an unsuccessful payment",
          kpayCallback: callbackData,
          updatedAt: timestamp,
        });
        return;
      }

      const purpose = `${payment.purpose || KPAY_PAYMENT_PURPOSES.WALLET_TOP_UP}`.trim();
      const purposeMeta = payment.purposeMeta || {};
      const wallet = await ensureCompanyWalletInTransaction({
        transaction,
        companyId: payment.companyId,
        initialBalance: 0,
        initialCreditBalanceHkd: 0,
        timestamp,
      });
      const walletRef = wallet.ref || wallet.doc?.ref;
      const walletData = wallet.doc
        ? (await transaction.get(walletRef)).data() || {}
        : wallet.data || {};
      const previousCreditBalanceHkd = Number(walletData.creditBalanceHkd) || 0;
      const previousTokenBalance = Number(walletData.balance) || 0;

      if (purpose === KPAY_PAYMENT_PURPOSES.BUNDLE_PURCHASE) {
        const bundleCode = `${purposeMeta.bundleCode || ""}`.trim();
        const bundle = TOKEN_BUNDLES.find((entry) => entry.code === bundleCode);

        if (!bundle) {
          throw new Error("__INVALID_BUNDLE_PURPOSE__");
        }

        const bundlePrice = roundToMoney(bundle.priceHkd);
        if (Math.round(bundlePrice * 100) !== payment.amountCents) {
          throw new Error("__PAYMENT_MISMATCH__");
        }

        const bundleTokens = Number(bundle.tokens) || 0;
        const newTokenBalance = previousTokenBalance + bundleTokens;
        transaction.set(
          walletRef,
          {
            balance: newTokenBalance,
            updatedAt: timestamp,
            version: (Number(walletData.version) || 0) + 1,
          },
          { merge: true },
        );

        createCompanyWalletTransaction({
          transaction,
          walletId: walletRef.id,
          companyId: payment.companyId,
          type: "ADD",
          amount: bundleTokens,
          previousBalance: previousTokenBalance,
          newBalance: newTokenBalance,
          balanceField: "balance",
          unit: "TOKEN",
          description: `${bundle.title} purchase via KPay (+${bundleTokens} tokens)`,
          timestamp,
          metadata: {
            source: "kpay_bundle_purchase",
            bundleCode: bundle.code,
            bundleTitle: bundle.title,
            bundlePriceHkd: bundlePrice,
            kpayPaymentId: payment.paymentId,
            managedOrderNo,
            managedOutTradeNo,
            orderNo: callbackData.orderNo,
            transactionNo: callbackData.transactionNo,
          },
        });
      } else {
        const newCreditBalanceHkd = roundToMoney(previousCreditBalanceHkd + payment.amount);
        transaction.set(
          walletRef,
          {
            creditBalanceHkd: newCreditBalanceHkd,
            updatedAt: timestamp,
            version: (Number(walletData.version) || 0) + 1,
          },
          { merge: true },
        );

        createCompanyWalletTransaction({
          transaction,
          walletId: walletRef.id,
          companyId: payment.companyId,
          type: "ADD",
          amount: payment.amount,
          previousBalance: previousCreditBalanceHkd,
          newBalance: newCreditBalanceHkd,
          balanceField: "creditBalanceHkd",
          unit: "HKD",
          description:
            purpose === KPAY_PAYMENT_PURPOSES.TARGET_BUDGET_DIRECT
              ? "KPay target budget payment"
              : "KPay Online credit top-up",
          timestamp,
          metadata: {
            source:
              purpose === KPAY_PAYMENT_PURPOSES.TARGET_BUDGET_DIRECT
                ? "kpay_target_budget"
                : "kpay_online",
            kpayPaymentId: payment.paymentId,
            managedOrderNo,
            managedOutTradeNo,
            orderNo: callbackData.orderNo,
            transactionNo: callbackData.transactionNo,
          },
        });
      }
      transaction.update(paymentRef, {
        status: "PAID",
        paidAt: timestamp,
        failureReason: null,
        kpayCallback: callbackData,
        updatedAt: timestamp,
      });
    });

    return res.status(200).end();
  } catch (error) {
    if (error.code === "KPAY_CONFIGURATION_ERROR") {
      console.error("KPay webhook configuration error:", error.message);
      return res.status(503).json({ success: false, message: "KPay webhook is not configured" });
    }

    if (["__PAYMENT_NOT_FOUND__", "__PAYMENT_MISMATCH__", "__INVALID_BUNDLE_PURPOSE__"].includes(error.message)) {
      console.error("Rejected KPay webhook:", error.message);
      return res.status(400).json({ success: false, message: "KPay payment does not match the payment record" });
    }

    console.error("Error processing KPay webhook:", error);
    return res.status(500).json({ success: false, message: "Unable to process KPay payment notification" });
  }
});

module.exports = router;