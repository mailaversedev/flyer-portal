const express = require("express");

const { serializeVoucher } = require("../voucher");

module.exports = function createVouchersRouter(context) {
  const { db, normalizeLimit } = context;

  const router = express.Router();

  router.get("/vouchers", async (req, res) => {
    try {
      const limit = normalizeLimit(req.query.limit);
      const direction = req.query.direction === "asc" ? "asc" : "desc";

      const snapshot = await db
        .collection("vouchers")
        .orderBy("createdAt", direction)
        .limit(limit)
        .get();

      res.status(200).json({
        success: true,
        data: snapshot.docs.map((doc) => serializeVoucher(doc)),
      });
    } catch (error) {
      console.error("Error fetching admin voucher list:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch vouchers",
        error: error.message,
      });
    }
  });

  router.post("/vouchers", async (req, res) => {
    try {
      const {
        value,
        cost,
        merchant,
        merchantIcon,
        expiryDate,
        totalNumber,
        qrCode,
        promotionCode,
        colors,
        terms,
      } = req.body || {};

      const normalizedValue = `${value || ""}`.trim();
      const normalizedMerchant = `${merchant || ""}`.trim();
      const normalizedMerchantIcon = `${merchantIcon || ""}`.trim();
      const normalizedPromotionCode = `${promotionCode || ""}`.trim();
      const normalizedTerms = `${terms || ""}`.trim();
      const normalizedQrCode = `${qrCode || ""}`.trim();
      const normalizedCost = Number.parseInt(cost, 10);
      const normalizedTotalNumber = Number.parseInt(totalNumber, 10);
      const normalizedExpiryDate = `${expiryDate || ""}`.trim();
      const normalizedColors = Array.isArray(colors)
        ? colors
            .map((color) => `${color || ""}`.trim())
            .filter((color) => color.length > 0)
            .slice(0, 4)
        : [];

      if (!normalizedValue || !normalizedMerchant || !normalizedTerms) {
        return res.status(400).json({
          success: false,
          message: "Value, merchant, and terms are required",
        });
      }

      if (!Number.isFinite(normalizedCost) || normalizedCost <= 0) {
        return res.status(400).json({
          success: false,
          message: "Cost must be a positive integer",
        });
      }

      if (!Number.isFinite(normalizedTotalNumber) || normalizedTotalNumber <= 0) {
        return res.status(400).json({
          success: false,
          message: "Total number must be a positive integer",
        });
      }

      if (normalizedExpiryDate) {
        const parsedExpiryDate = new Date(normalizedExpiryDate);

        if (Number.isNaN(parsedExpiryDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Expiry date is invalid",
          });
        }
      }

      const timestamp = new Date().toISOString();
      const voucherRef = db.collection("vouchers").doc();
      const voucherData = {
        value: normalizedValue,
        cost: normalizedCost,
        merchant: normalizedMerchant,
        merchantIcon: normalizedMerchantIcon,
        expiryDate: normalizedExpiryDate,
        totalNumber: normalizedTotalNumber,
        qrCode: normalizedQrCode,
        promotionCode: normalizedPromotionCode,
        colors:
          normalizedColors.length > 0
            ? normalizedColors
            : ["#EF3239", "#F76B1C"],
        terms: normalizedTerms,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await voucherRef.set(voucherData);

      const createdVoucher = await voucherRef.get();

      res.status(201).json({
        success: true,
        message: "Voucher created successfully",
        data: serializeVoucher(createdVoucher),
      });
    } catch (error) {
      console.error("Error creating voucher:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create voucher",
        error: error.message,
      });
    }
  });

  return router;
};
