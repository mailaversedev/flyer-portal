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
    const coupon = flyerData?.coupon;

    if (!flyerData || !coupon.couponType) {
      return res.status(400).json({
        success: false,
        message: "This flyer does not have a coupon",
      });
    }

    // 2. Check if user already claimed this specific coupon
    const claimRef = db
      .collection("users")
      .doc(userId)
      .collection("coupons")
      .doc(flyerId);

    const existingClaim = await claimRef.get();

    if (existingClaim.exists) {
      return res.status(400).json({
        success: false,
        message: "You have already claimed this coupon",
      });
    }

    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const statsDocId = `${year}-${String(month).padStart(2, "0")}`;

    const userStatsRef = db
      .collection("users")
      .doc(userId)
      .collection("statistics")
      .doc(statsDocId);

    const companyStatsRef = flyerData.companyId
      ? db
          .collection("companies")
          .doc(flyerData.companyId)
          .collection("statistics")
          .doc(statsDocId)
      : null;

    const flyerRef = db.collection("flyers").doc(flyerId);

    // 3. Create Coupon/Claim record
    const couponData = {
      userId,
      flyerId,
      companyIcon: flyerData.companyIcon || "",

      // Coupon Details from Flyer Data
      couponType: coupon.couponType,
      couponFile: coupon.couponFile || null,
      qrCodeImage: coupon.qrCodeImage || null,
      barcodeImage: coupon.barcodeImage || null,
      termsConditions: coupon.termsConditions || "",
      expiredDate: coupon.expiredDate || "",
      discountValue: coupon.discountValue || "",
      itemDescription: coupon.itemDescription || "",

      status: "active", // active, used, expired
      claimedAt: new Date().toISOString(),
      isUsed: false,
    };

    await db.runTransaction(async (transaction) => {
      const claimDoc = await transaction.get(claimRef);
      if (claimDoc.exists) {
        throw new Error("__ALREADY_CLAIMED__");
      }

      const userStatsDoc = await transaction.get(userStatsRef);
      let companyStatsDoc = null;
      if (companyStatsRef) {
        companyStatsDoc = await transaction.get(companyStatsRef);
      }

      transaction.set(claimRef, couponData);

      if (userStatsDoc.exists) {
        transaction.update(userStatsRef, {
          couponDownloadCount: admin.firestore.FieldValue.increment(1),
          updatedAt: new Date().toISOString(),
        });
      } else {
        transaction.set(userStatsRef, {
          year,
          month,
          claimCount: 0,
          totalReward: 0,
          flyerTypes: {},
          couponDownloadCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      if (companyStatsRef) {
        if (companyStatsDoc && companyStatsDoc.exists) {
          transaction.update(companyStatsRef, {
            couponDownloadCount: admin.firestore.FieldValue.increment(1),
            updatedAt: new Date().toISOString(),
          });
        } else {
          transaction.set(companyStatsRef, {
            year,
            month,
            claimCount: 0,
            flyerCount: 0,
            totalReward: 0,
            totalEventMoney: 0,
            totalClaimCount: 0,
            couponDownloadCount: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      transaction.set(
        flyerRef,
        {
          coupon: {
            downloadCount: admin.firestore.FieldValue.increment(1),
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    });

    res.status(201).json({
      success: true,
      message: "Coupon claimed successfully",
      data: {
        id: flyerId,
        ...couponData,
      },
    });
  } catch (error) {
    if (error.message === "__ALREADY_CLAIMED__") {
      return res.status(400).json({
        success: false,
        message: "You have already claimed this coupon",
      });
    }

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

    let query = db
      .collection("users")
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
