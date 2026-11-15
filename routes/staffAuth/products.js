const express = require("express");

const PAGE_SIZE = 10;
const CURRENCY_CODES = new Set(Intl.supportedValuesOf("currency"));

const validateProduct = (body) => {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const currency =
    typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
  const price = typeof body.price === "string" ? body.price.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const image = typeof body.image === "string" ? body.image.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  if (!name || name.length > 120) {
    return { error: "Product name is required and must be 120 characters or fewer." };
  }
  if (!CURRENCY_CODES.has(currency)) {
    return { error: "Currency must be a supported ISO 4217 currency code." };
  }
  if (!/^\d{1,12}(?:\.\d{1,4})?$/.test(price)) {
    return { error: "Price must be a non-negative amount with up to four decimal places." };
  }
  if (typeof body.active !== "boolean") {
    return { error: "Product status must be active or inactive." };
  }
  if (description.length > 2000) {
    return { error: "Product description must be 2,000 characters or fewer." };
  }

  const isHttpUrl = (value) => {
    try {
      const parsed = new URL(value);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  };
  if (url.length > 2048 || !isHttpUrl(url)) {
    return { error: "Product URL must be a valid HTTP or HTTPS URL." };
  }
  if (image.length > 2048 || !isHttpUrl(image)) {
    return { error: "Product image must be a valid HTTP or HTTPS URL." };
  }

  return {
    data: {
      name,
      currency,
      price,
      active: body.active,
      url,
      image,
      description,
    },
  };
};

module.exports = function createProductsRouter({ db, authenticateToken }) {
  const router = express.Router();

  const getProductsRef = async (userId) => {
    const staffDoc = await db.collection("staffs").doc(userId).get();
    const companyId = staffDoc.exists ? staffDoc.data()?.companyId : null;
    if (!companyId) return null;
    return db.collection("companies").doc(companyId).collection("products");
  };

  router.get("/products", authenticateToken, async (req, res) => {
    try {
      const productsRef = await getProductsRef(req.user?.userId);
      if (!productsRef) {
        return res.status(404).json({
          success: false,
          message: "No company is associated with this staff account.",
        });
      }

      const after = typeof req.query.after === "string" ? req.query.after : "";
      let query = productsRef.orderBy("createdAt", "desc");
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

      const snapshot = await query.limit(PAGE_SIZE + 1).get();
      const docs = snapshot.docs.slice(0, PAGE_SIZE);
      return res.status(200).json({
        success: true,
        data: docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        pagination: {
          nextCursor: snapshot.docs.length > PAGE_SIZE ? docs.at(-1).id : null,
        },
      });
    } catch (error) {
      console.error("Error listing company products:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load products.",
      });
    }
  });

  router.post("/products", authenticateToken, async (req, res) => {
    try {
      const productsRef = await getProductsRef(req.user?.userId);
      if (!productsRef) {
        return res.status(404).json({
          success: false,
          message: "No company is associated with this staff account.",
        });
      }

      const validated = validateProduct(req.body || {});
      if (validated.error) {
        return res.status(400).json({
          success: false,
          message: validated.error,
        });
      }

      const now = new Date().toISOString();
      const docRef = await productsRef.add({
        ...validated.data,
        createdAt: now,
        updatedAt: now,
      });
      return res.status(201).json({
        success: true,
        data: { id: docRef.id, ...validated.data, createdAt: now, updatedAt: now },
      });
    } catch (error) {
      console.error("Error creating company product:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create product.",
      });
    }
  });

  router.put("/products/:productId", authenticateToken, async (req, res) => {
    try {
      const productsRef = await getProductsRef(req.user?.userId);
      if (!productsRef) {
        return res.status(404).json({
          success: false,
          message: "No company is associated with this staff account.",
        });
      }

      const validated = validateProduct(req.body || {});
      if (validated.error) {
        return res.status(400).json({
          success: false,
          message: validated.error,
        });
      }

      const productRef = productsRef.doc(req.params.productId);
      const productDoc = await productRef.get();
      if (!productDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Product not found.",
        });
      }

      const updatedAt = new Date().toISOString();
      await productRef.update({ ...validated.data, updatedAt });
      return res.status(200).json({
        success: true,
        data: {
          id: productDoc.id,
          ...validated.data,
          createdAt: productDoc.data()?.createdAt || updatedAt,
          updatedAt,
        },
      });
    } catch (error) {
      console.error("Error updating company product:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update product.",
      });
    }
  });

  return router;
};
