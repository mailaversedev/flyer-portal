const express = require("express");
const admin = require("firebase-admin");

const { authenticateToken } = require("./auth");

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