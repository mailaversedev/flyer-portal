const express = require("express");
const admin = require("firebase-admin");

const router = express.Router();
const db = admin.firestore();

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const normalizeLimit = (value) => {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
};

const serializeVoucher = (doc) => {
  const data = doc.data() || {};

  return {
    id: doc.id,
    value: data.value || "",
    cost: Number.isFinite(Number(data.cost)) ? Number(data.cost) : 0,
    merchant: data.merchant || "",
    merchantIcon: data.merchantIcon || "",
    expiryDate: data.expiryDate || "",
    totalNumber:
      Number.isFinite(Number(data.totalNumber)) ? Number(data.totalNumber) : 0,
    qrCode: data.qrCode || "",
    promotionCode: data.promotionCode || "",
    colors: Array.isArray(data.colors) ? data.colors : [],
    terms: data.terms || "",
    isActive: data.isActive !== false,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
};

const isVoucherAvailable = (voucher) => {
  if (!voucher.isActive) {
    return false;
  }

  if (voucher.totalNumber <= 0) {
    return false;
  }

  if (!voucher.expiryDate) {
    return true;
  }

  const expiryDate = new Date(voucher.expiryDate);

  if (Number.isNaN(expiryDate.getTime())) {
    return false;
  }

  return expiryDate.getTime() >= Date.now();
};

router.get("/vouchers", async (req, res) => {
  try {
    const limit = normalizeLimit(req.query.limit);
    const snapshot = await db
      .collection("vouchers")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const vouchers = snapshot.docs
      .map((doc) => serializeVoucher(doc))
      .filter((voucher) => isVoucherAvailable(voucher));

    res.status(200).json({
      success: true,
      data: vouchers,
    });
  } catch (error) {
    console.error("Error fetching vouchers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vouchers",
      error: error.message,
    });
  }
});

module.exports = {
  router,
  serializeVoucher,
};