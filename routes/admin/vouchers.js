const express = require("express");
const admin = require("firebase-admin");
const crypto = require("crypto");
const multer = require("multer");

const { serializeVoucher } = require("../voucher");
const {
  MAX_IMAGES, MAX_IMAGE_BYTES, commitImport, encryptImage, itemId, prepareImport, resolveImportKind,
} = require("../../services/importedVouchers");

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_IMAGES, fieldSize: 1024 * 1024 },
}).array("images", MAX_IMAGES);

const NUMERIC_SEGMENT_REGEX = /^\d+$/;

const parseVoucherSequence = ({ voucherCode }) => {
  const normalizedCode = `${voucherCode || ""}`.trim();

  if (!normalizedCode || !NUMERIC_SEGMENT_REGEX.test(normalizedCode)) {
    return {
      error: "Voucher code must be numeric",
    };
  }

  const sequence = Number.parseInt(normalizedCode, 10);

  if (!Number.isFinite(sequence)) {
    return { error: "Voucher number is invalid" };
  }

  return {
    sequence,
  };
};

const normalizeVoucherPayload = (body = {}) => {
  const {
    value,
    cost,
    merchant,
    merchantIcon,
    voucherImage,
    voucherType,
    voucherPrefix,
    voucherNumberStart,
    voucherNumberEnd,
    expiryDate,
    totalNumber,
    qrCode,
    promotionCode,
    colors,
    terms,
  } = body;
  const normalizedValue = `${value || ""}`.trim();
  const normalizedMerchant = `${merchant || ""}`.trim();
  const normalizedMerchantIcon = `${merchantIcon || ""}`.trim();
  const normalizedVoucherImage = `${voucherImage || ""}`.trim();
  const normalizedVoucherType = `${voucherType || "static"}`.trim() || "static";
  const normalizedVoucherPrefix = `${voucherPrefix || ""}`.trim();
  const normalizedVoucherNumberStart = `${voucherNumberStart || ""}`.trim();
  const normalizedVoucherNumberEnd = `${voucherNumberEnd || ""}`.trim();
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
    return {
      error: "Value, merchant, and terms are required",
    };
  }

  if (!Number.isFinite(normalizedCost) || normalizedCost <= 0) {
    return {
      error: "Cost must be a positive integer",
    };
  }

  if (!["static", "numbered", "imported"].includes(normalizedVoucherType)) {
    return { error: "Voucher type is invalid" };
  }

  if (normalizedVoucherType !== "imported" && (!Number.isFinite(normalizedTotalNumber) || normalizedTotalNumber <= 0)) {
    return {
      error: "Total number must be a positive integer",
    };
  }

  let parsedStartSequence = null;
  let parsedEndSequence = null;

  if (
    normalizedVoucherPrefix &&
    normalizedVoucherNumberStart &&
    normalizedVoucherNumberEnd
  ) {
    const startSequenceResult = parseVoucherSequence({
      voucherCode: normalizedVoucherNumberStart,
    });
    const endSequenceResult = parseVoucherSequence({
      voucherCode: normalizedVoucherNumberEnd,
    });

    if (!startSequenceResult.error && !endSequenceResult.error) {
      parsedStartSequence = startSequenceResult.sequence;
      parsedEndSequence = endSequenceResult.sequence;
    }
  }

  if (normalizedExpiryDate) {
    const parsedExpiryDate = new Date(normalizedExpiryDate);

    if (Number.isNaN(parsedExpiryDate.getTime())) {
      return {
        error: "Expiry date is invalid",
      };
    }
  }

  return {
    data: {
      value: normalizedValue,
      cost: normalizedCost,
      merchant: normalizedMerchant,
      merchantIcon: normalizedMerchantIcon,
      voucherImage: normalizedVoucherImage,
      voucherType: normalizedVoucherType,
      voucherPrefix: normalizedVoucherPrefix,
      voucherNumberStart: normalizedVoucherNumberStart,
      voucherNumberEnd: normalizedVoucherNumberEnd,
      voucherStartSequence: parsedStartSequence,
      voucherEndSequence: parsedEndSequence,
      expiryDate: normalizedExpiryDate,
      totalNumber: normalizedVoucherType === "imported" ? 0 : normalizedTotalNumber,
      qrCode: normalizedVoucherType === "imported" ? "" : normalizedQrCode,
      promotionCode: normalizedVoucherType === "imported" ? "" : normalizedPromotionCode,
      colors:
        normalizedColors.length > 0
          ? normalizedColors
          : ["#EF3239", "#F76B1C"],
      terms: normalizedTerms,
    },
  };
};

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
        data: snapshot.docs.filter((doc) => doc.data().deleted !== true).map((doc) => serializeVoucher(doc)),
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

  router.get("/vouchers/:voucherId", async (req, res) => {
    try {
      const { voucherId } = req.params;

      if (!voucherId) {
        return res.status(400).json({
          success: false,
          message: "Voucher ID is required",
        });
      }

      const voucherDoc = await db.collection("vouchers").doc(voucherId).get();

      if (!voucherDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Voucher not found",
        });
      }

      const data = voucherDoc.data();
      let importKind = null;
      if (data.voucherType === "imported") {
        const firstItem = data.totalNumber > 0 && data.importKind == null
          ? await db.collection("vouchers").doc(voucherId).collection("inventory").doc(itemId(0)).get()
          : null;
        importKind = resolveImportKind(data, firstItem?.data());
      }

      res.status(200).json({
        success: true,
        data: { ...serializeVoucher(voucherDoc), importKind },
      });
    } catch (error) {
      if (error.message === "__VOUCHER_IMPORT_KIND_INVALID__") {
        return res.status(409).json({ success: false, message: "Voucher inventory type is invalid; review existing inventory" });
      }
      console.error("Error fetching admin voucher:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch voucher",
        error: error.message,
      });
    }
  });

  router.post("/vouchers", async (req, res) => {
    try {
      const normalizedVoucher = normalizeVoucherPayload(req.body);

      if (normalizedVoucher.error) {
        return res.status(400).json({
          success: false,
          message: normalizedVoucher.error,
        });
      }

      const timestamp = new Date().toISOString();
      const voucherRef = db.collection("vouchers").doc();
      const voucherData = {
        ...normalizedVoucher.data,
        redeemedCount: 0,
        isActive: normalizedVoucher.data.voucherType !== "imported",
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

  router.post("/vouchers/:voucherId/import", (req, res, next) => {
    importUpload(req, res, (error) => {
      if (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      return next();
    });
  }, async (req, res) => {
    let uploadedPaths = [];
    try {
      const prepared = prepareImport(req.body.codes, req.files || [], req.body.importKey);
      const voucherRef = db.collection("vouchers").doc(req.params.voucherId);
      const bucket = admin.storage().bucket();
      const attemptId = crypto.randomUUID();
      const imagePaths = [];
      for (let index = 0; index < prepared.images.length; index += 1) {
        const image = prepared.images[index];
        const storagePath = `private-voucher-items/${voucherRef.id}/${attemptId}/${index}`;
        uploadedPaths.push(storagePath);
        await bucket.file(storagePath).save(encryptImage(image.buffer), {
          resumable: false,
          contentType: "application/octet-stream",
          metadata: { cacheControl: "private, no-store" },
        });
        imagePaths.push({ storagePath, contentType: image.type });
      }
      const result = await commitImport(db, voucherRef, prepared, imagePaths, new Date().toISOString());
      if (result.alreadyImported && uploadedPaths.length) {
        try {
          await Promise.all(uploadedPaths.map((path) => bucket.file(path).delete()));
          uploadedPaths = [];
        } catch (cleanupError) {
          console.error("Could not clean up duplicate private voucher uploads:", uploadedPaths, cleanupError);
        }
      }
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      const knownErrors = {
        __VOUCHER_NOT_FOUND__: [404, "Voucher not found"],
        __VOUCHER_TYPE_INVALID__: [400, "Voucher is not an imported voucher"],
        __VOUCHER_STOCK_INVALID__: [409, "Voucher stock is invalid"],
        __VOUCHER_IMPORT_KIND_INVALID__: [409, "Voucher inventory type is invalid; review existing inventory"],
        __VOUCHER_IMPORT_KIND_MISMATCH__: [409, "All imports for a voucher must use the same inventory type"],
        __DUPLICATE_CODE__: [409, "One or more codes already exist in this voucher"],
        __IMPORT_KEY_CONFLICT__: [409, "Import key already used for different items"],
        __VOUCHER_IMAGE_KEY_MISSING__: [503, "Voucher image encryption is not configured"],
      };
      const known = knownErrors[error.message];
      if (known && uploadedPaths.length) {
        try {
          await Promise.all(uploadedPaths.map((path) => admin.storage().bucket().file(path).delete()));
          uploadedPaths = [];
        } catch (cleanupError) {
          console.error("Could not clean up rejected private voucher uploads:", uploadedPaths, cleanupError);
        }
      } else if (uploadedPaths.length) {
        console.error("Private voucher upload requires cleanup review:", uploadedPaths);
      }
      if (known) return res.status(known[0]).json({ success: false, message: known[1] });
      if (["Invalid import key", "Codes must be a JSON array", "Codes must be a JSON array of strings",
        "Each code must contain between 1 and 512 bytes", "Duplicate codes in import",
        "Import must contain at least one item", "Import must contain either codes or images, not both",
        "Import exceeds item or image limit",
        "Images must be PNG, JPEG, GIF or WebP and at most 5 MB each", "Combined images exceed 20 MB"].includes(error.message)) {
        return res.status(400).json({ success: false, message: error.message });
      }
      console.error("Error importing voucher inventory:", error);
      return res.status(500).json({ success: false, message: "Failed to import voucher inventory" });
    }
  });

  router.patch("/vouchers/:voucherId", async (req, res) => {
    try {
      const { voucherId } = req.params;

      if (!voucherId) {
        return res.status(400).json({
          success: false,
          message: "Voucher ID is required",
        });
      }

      const voucherRef = db.collection("vouchers").doc(voucherId);
      const voucherDoc = await voucherRef.get();

      if (!voucherDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Voucher not found",
        });
      }

      const normalizedVoucher = normalizeVoucherPayload(req.body);

      if (normalizedVoucher.error) {
        return res.status(400).json({
          success: false,
          message: normalizedVoucher.error,
        });
      }

      const redeemedCount = Number(voucherDoc.data()?.redeemedCount) || 0;
      const currentType = voucherDoc.data()?.voucherType || "static";
      if (currentType !== normalizedVoucher.data.voucherType &&
          (currentType === "imported" || normalizedVoucher.data.voucherType === "imported")) {
        return res.status(400).json({ success: false, message: "Imported voucher type cannot be changed" });
      }

      if (currentType !== "imported" && normalizedVoucher.data.totalNumber < redeemedCount) {
        return res.status(400).json({
          success: false,
          message: "Total number cannot be less than redeemed count",
        });
      }

      const update = { ...normalizedVoucher.data };
      if (currentType === "imported") delete update.totalNumber;
      await voucherRef.update({
        ...update,
        updatedAt: new Date().toISOString(),
      });

      const updatedVoucher = await voucherRef.get();

      res.status(200).json({
        success: true,
        message: "Voucher updated successfully",
        data: serializeVoucher(updatedVoucher),
      });
    } catch (error) {
      console.error("Error updating voucher:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update voucher",
        error: error.message,
      });
    }
  });

  router.delete("/vouchers/:voucherId", async (req, res) => {
    try {
      const { voucherId } = req.params;

      if (!voucherId) {
        return res.status(400).json({
          success: false,
          message: "Voucher ID is required",
        });
      }

      const voucherRef = db.collection("vouchers").doc(voucherId);
      const voucherDoc = await voucherRef.get();

      if (!voucherDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Voucher not found",
        });
      }

      if ((voucherDoc.data()?.voucherType || "static") === "imported") {
        await voucherRef.update({ deleted: true, isActive: false, updatedAt: new Date().toISOString() });
      } else {
        await voucherRef.delete();
      }

      res.status(200).json({
        success: true,
        message: "Voucher deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting voucher:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete voucher",
        error: error.message,
      });
    }
  });

  return router;
};
