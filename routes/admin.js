const express = require("express");
const admin = require("firebase-admin");

const { authenticateToken } = require("./auth");
const { serializeVoucher } = require("./voucher");

const router = express.Router();
const db = admin.firestore();

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "super-admin") {
    return res.status(403).json({
      success: false,
      message: "Super admin access is required",
    });
  }

  next();
};

const normalizeLimit = (value) => {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
};

router.use(authenticateToken, requireSuperAdmin);

router.get("/users", async (req, res) => {
  try {
    const limit = normalizeLimit(req.query.limit);
    const direction = req.query.direction === "asc" ? "asc" : "desc";

    const snapshot = await db
      .collection("users")
      .orderBy("createdAt", direction)
      .limit(limit)
      .get();

    const users = snapshot.docs.map((doc) => {
      const data = doc.data() || {};

      return {
        id: doc.id,
        username: data.username || "",
        displayName: data.displayName || "",
        createdAt: data.createdAt || null,
        lastLoginAt: data.lastLoginAt || null,
        isActive: data.isActive !== false,
        location: data.location || null,
      };
    });

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching admin user list:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
});

router.get("/companies", async (req, res) => {
  try {
    const limit = normalizeLimit(req.query.limit);
    const direction = req.query.direction === "asc" ? "asc" : "desc";

    const snapshot = await db
      .collection("companies")
      .orderBy("createdAt", direction)
      .limit(limit)
      .get();

    const companies = snapshot.docs.map((doc) => {
      const data = doc.data() || {};

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

    if (
      !normalizedValue ||
      !normalizedMerchant ||
      !normalizedTerms
    ) {
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

router.get("/flyers", async (req, res) => {
  try {
    const limit = normalizeLimit(req.query.limit);
    const direction = req.query.direction === "asc" ? "asc" : "desc";

    const snapshot = await db
      .collection("flyers")
      .orderBy("createdAt", direction)
      .limit(limit)
      .get();

    const flyers = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (flyers.length > 0) {
      try {
        const lotteryRefs = flyers.map((flyer) => db.collection("lottery").doc(flyer.id));
        const lotterySnapshots = await db.getAll(...lotteryRefs);

        lotterySnapshots.forEach((lotteryDoc, index) => {
          if (lotteryDoc.exists) {
            flyers[index].lottery = lotteryDoc.data();
          }
        });
      } catch (lotteryError) {
        console.warn("Error fetching admin flyer lottery metadata:", lotteryError);
      }
    }

    res.status(200).json({
      success: true,
      data: flyers,
    });
  } catch (error) {
    console.error("Error fetching admin flyer list:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch flyers",
      error: error.message,
    });
  }
});

module.exports = router;