const express = require("express");

const { authenticateToken } = require("../auth");
const {
  isCompanyCouponAvailable,
  mapCompanyCouponDoc,
} = require("../../services/companyCouponLibrary");

module.exports = function createCompanyRouter(context) {
  const { db } = context;

  const router = express.Router();

  router.get("/company/:companyId", async (req, res) => {
    try {
      const { companyId } = req.params;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: "Missing companyId",
        });
      }

      const companyDoc = await db.collection("companies").doc(companyId).get();
      if (!companyDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      const company = companyDoc.data() || {};

      res.status(200).json({
        success: true,
        data: {
          id: companyDoc.id,
          companyDisplayName:
            typeof company.companyDisplayName === "string"
              ? company.companyDisplayName
              : typeof company.displayName === "string"
                ? company.displayName
                : null,
          name: company.name || "",
          icon: company.icon || null,
          address: company.address || null,
          contact: company.contact || null,
          nature: company.nature || null,
          coverPhotos: Array.isArray(company.coverPhotos)
            ? company.coverPhotos
                .filter((photo) => typeof photo === "string" && photo.trim())
                .slice(0, 5)
            : [],
          introduction:
            typeof company.introduction === "string"
              ? company.introduction
              : null,
          website: typeof company.website === "string" ? company.website : null,
          createdAt: company.createdAt || null,
          updatedAt: company.updatedAt || null,
          isActive:
            typeof company.isActive === "boolean" ? company.isActive : true,
        },
      });
    } catch (error) {
      console.error("Error fetching company by ID:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch company",
        error: error.message,
      });
    }
  });

  router.get("/company/:companyId/products", async (req, res) => {
    try {
      const { companyId } = req.params;
      const limit = Number(req.query.limit || 10);
      if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
        return res.status(400).json({
          success: false,
          message: "Invalid limit. Must be between 1 and 10.",
        });
      }

      const companyRef = db.collection("companies").doc(companyId);
      const companyDoc = await companyRef.get();
      if (!companyDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Company not found.",
        });
      }

      const productsRef = companyRef.collection("products");
      const after = typeof req.query.after === "string" ? req.query.after : "";
      let query = productsRef
        .where("active", "==", true)
        .orderBy("createdAt", "desc");
      if (after) {
        const cursor = await productsRef.doc(after).get();
        if (!cursor.exists) {
          return res.status(400).json({
            success: false,
            message: "Invalid product cursor.",
          });
        }
        query = query.startAfter(cursor);
      }

      const snapshot = await query.limit(limit + 1).get();
      const docs = snapshot.docs.slice(0, limit);
      res.set("Cache-Control", "public, max-age=300, s-maxage=900");
      return res.status(200).json({
        success: true,
        data: docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        pagination: {
          nextCursor: snapshot.docs.length > limit ? docs.at(-1).id : null,
        },
      });
    } catch (error) {
      console.error("Error fetching public company products:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch company products.",
      });
    }
  });

  router.get("/company/me/coupons", authenticateToken, async (req, res) => {
    try {
      const companyId = req.user.companyId;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: "Company ID is required",
        });
      }

      const snapshot = await db
        .collection("companies")
        .doc(companyId)
        .collection("coupons")
        .orderBy("updatedAt", "desc")
        .get();

      res.status(200).json({
        success: true,
        data: snapshot.docs.map((doc) => mapCompanyCouponDoc(doc)),
      });
    } catch (error) {
      console.error("Error fetching company coupons:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch company coupons",
        error: error.message,
      });
    }
  });

  router.get("/company/:companyId/coupons", async (req, res) => {
    try {
      const { companyId } = req.params;

      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: "Missing companyId",
        });
      }

      const companyDoc = await db.collection("companies").doc(companyId).get();
      if (!companyDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      const snapshot = await db
        .collection("companies")
        .doc(companyId)
        .collection("coupons")
        .orderBy("updatedAt", "desc")
        .get();

      const coupons = snapshot.docs
        .map((doc) => mapCompanyCouponDoc(doc))
        .filter((coupon) => isCompanyCouponAvailable(coupon));

      res.status(200).json({
        success: true,
        data: coupons,
      });
    } catch (error) {
      console.error("Error fetching company coupon library:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch company coupons",
        error: error.message,
      });
    }
  });

  return router;
};
