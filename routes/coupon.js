const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();

// POST /claim - User claims a coupon from a flyer
router.post("/claim", async (req, res) => {
  try {
    const { flyerId } = req.body;
    const userId = req.user.userId;

    if (!flyerId) {
      return res.status(400).json({
        success: false,
        message: "Flyer ID is required",
      });
    }

    // 1. Check if flyer exists and has a coupon
    const flyerDoc = await db.collection("flyers").doc(flyerId).get();
    if (!flyerDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Flyer not found",
      });
    }

    const flyerData = flyerDoc.data();
    if (!flyerData || !flyerData.couponType) {
      return res.status(400).json({
        success: false,
        message: "This flyer does not have a coupon",
      });
    }

    // 2. Check if user already claimed this specific coupon
    const existingClaimQuery = await db.collection("users")
      .doc(userId)
      .collection("coupons")
      .where("flyerId", "==", flyerId)
      .get();

    if (!existingClaimQuery.empty) {
      return res.status(400).json({
        success: false,
        message: "You have already claimed this coupon",
      });
    }

    // 3. Create Coupon/Claim record
    const couponData = {
      userId,
      flyerId,
      companyIcon: flyerData.companyIcon || "",
      
      // Coupon Details from Flyer Data
      couponType: flyerData.couponType,
      couponFile: flyerData.couponFile || null,
      termsConditions: flyerData.termsConditions || "",
      expiredDate: flyerData.expiredDate || "",
      discountValue: flyerData.discountValue || "",
      itemDescription: flyerData.itemDescription || "",
      
      status: "active", // active, used, expired
      claimedAt: new Date().toISOString(),
      isUsed: false,
    };

    const newClaimRef = await db.collection("users")
      .doc(userId)
      .collection("coupons")
      .add(couponData);

    res.status(201).json({
      success: true,
      message: "Coupon claimed successfully",
      data: {
        id: newClaimRef.id,
        ...couponData
      },
    });

  } catch (error) {
    console.error("Error claiming coupon:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// GET /my-coupons - Get all coupons claimed by the user
router.get("/my-coupons", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status } = req.query; // Optional filter by status

    let query = db.collection("users")
      .doc(userId)
      .collection("coupons")
      .orderBy("claimedAt", "desc");

    if (status) {
      query = query.where("status", "==", status);
    }

    const snapshot = await query.get();

    const coupons = [];
    snapshot.forEach((doc) => {
      coupons.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    res.status(200).json({
      success: true,
      data: coupons,
    });

  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
