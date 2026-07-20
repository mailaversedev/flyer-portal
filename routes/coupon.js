const express = require("express");
const admin = require("firebase-admin");

const router = express.Router();
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

    // Check if coupon has quantity limit and if it's available
    if (coupon.quantity) {
      const currentDownloadCount = coupon.downloadCount || 0;
      if (currentDownloadCount >= coupon.quantity) {
        return res.status(400).json({
          success: false,
          message: "This coupon is no longer available",
        });
      }
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
      promotionCode: coupon.promotionCode || "",

      status: "active", // active, used, expired
      claimedAt: new Date().toISOString(),
      isUsed: false,
      usedAmount: null,
      receiptImageUrl: null,
    };

    await db.runTransaction(async (transaction) => {
      // Re-check flyer data within transaction
      const flyerDoc = await transaction.get(flyerRef);
      if (!flyerDoc.exists) {
        throw new Error("Flyer not found");
      }

      const flyerData = flyerDoc.data();
      const coupon = flyerData?.coupon;

      // Check quantity again within transaction to ensure consistency
      if (coupon && coupon.quantity) {
        const currentDownloadCount = coupon.downloadCount || 0;
        if (currentDownloadCount >= coupon.quantity) {
          throw new Error("__QUANTITY_EXCEEDED__");
        }
      }

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

      // Update flyer with incremented download count
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
    
    if (error.message === "__QUANTITY_EXCEEDED__") {
      return res.status(400).json({
        success: false,
        message: "This coupon is no longer available",
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

// POST /use - User uses a coupon
router.post("/use", async (req, res) => {
  try {
    const { couponId, usedAmount, receiptImageUrl } = req.body;
    const userId = req.user.userId;

    if (!couponId) {
      return res.status(400).json({
        success: false,
        message: "Coupon ID is required",
      });
    }

    const parsedUsedAmount = Number(usedAmount);
    if (!Number.isFinite(parsedUsedAmount) || parsedUsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid used amount is required",
      });
    }

    const couponRef = db
      .collection("users")
      .doc(userId)
      .collection("coupons")
      .doc(couponId);

    const couponDoc = await couponRef.get();

    if (!couponDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    if (couponDoc.data().isUsed) {
      return res.status(400).json({
        success: false,
        message: "Coupon has already been used",
      });
    }

    const updateData = {
      isUsed: true,
      usedAt: new Date().toISOString(),
      status: "used",
      usedAmount: parsedUsedAmount,
    };

    if (typeof receiptImageUrl === "string" && receiptImageUrl.trim()) {
      updateData.receiptImageUrl = receiptImageUrl.trim();
    }

    await couponRef.update(updateData);

    res.status(200).json({
      success: true,
      message: "Coupon used successfully",
    });
  } catch (error) {
    console.error("Error using coupon:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
