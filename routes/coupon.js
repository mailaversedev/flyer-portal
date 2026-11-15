const express = require("express");
const admin = require("firebase-admin");
const {
  encodeCursor,
  getCursorSnapshot,
  getDocumentsByIds,
  getUserLookup,
  normalizePageLimit,
} = require("./admin/engagementHelpers");

const router = express.Router();
const db = admin.firestore();
const { getFlyerCoupons, claimDocumentId, couponAvailability, getClaimFlyerCoupon } = require("../services/flyerCoupons");
const { normalizeCompanyCouponEntry } = require("../services/companyCouponLibrary");

router.post("/claim-all", async (req, res) => {
  const { flyerId } = req.body || {};
  if (typeof flyerId !== "string" || !flyerId.trim() || flyerId.includes("/")) {
    return res.status(400).json({ success: false, message: "Valid flyer ID is required" });
  }
  const userId = req.user.userId;
  const flyerRef = db.collection("flyers").doc(flyerId);
  const now = new Date();
  const timestamp = now.toISOString();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const statsId = `${year}-${String(month).padStart(2, "0")}`;
  const userRef = db.collection("users").doc(userId);
  const userStatsRef = userRef.collection("statistics").doc(statsId);

  try {
    const result = await db.runTransaction(async (transaction) => {
      const flyerDoc = await transaction.get(flyerRef);
      if (!flyerDoc.exists) throw new Error("__FLYER_NOT_FOUND__");
      const flyer = flyerDoc.data();
      const coupons = getFlyerCoupons(flyer);
      if (!["leaflet", "qr"].includes(flyer.type) || !coupons.length) {
        throw new Error("__NO_COUPONS__");
      }
      if (String(flyer.status || "").trim().toLowerCase() !== "active" ||
          (flyer.scheduledAt && new Date(flyer.scheduledAt).getTime() > now.getTime())) {
        throw new Error("__FLYER_UNAVAILABLE__");
      }
      const claimRefs = coupons.map((coupon, index) =>
        userRef.collection("coupons").doc(claimDocumentId(flyerId, coupon, index)));
      const claimDocs = await Promise.all(claimRefs.map((ref) => transaction.get(ref)));
      const companyStatsRef = flyer.companyId
        ? db.collection("companies").doc(flyer.companyId).collection("statistics").doc(statsId)
        : null;
      const userStats = await transaction.get(userStatsRef);
      const companyStats = companyStatsRef ? await transaction.get(companyStatsRef) : null;
      const claimed = [];
      const skipped = [];
      const updatedCoupons = coupons.map((coupon, index) => {
        const reason = claimDocs[index].exists
          ? "already_claimed" : couponAvailability(coupon, timestamp.slice(0, 10));
        if (reason) {
          skipped.push({ couponId: coupon.id, reason, downloadCount: Number(coupon.downloadCount || 0) });
          return coupon;
        }
        const claim = {
          userId, flyerId, flyerCouponId: coupon.id, companyId: flyer.companyId || null,
          companyIcon: flyer.companyIcon || "",
          couponType: coupon.couponType,
          couponFile: coupon.couponFile || null, qrCodeImage: coupon.qrCodeImage || null,
          barcodeImage: coupon.barcodeImage || null, termsConditions: coupon.termsConditions || "",
          expiredDate: coupon.expiredDate || "", discountValue: coupon.discountValue || "",
          itemDescription: coupon.itemDescription || "", promotionCode: coupon.promotionCode || "",
          status: "active", claimedAt: timestamp, isUsed: false, usedAmount: null, receiptImageUrl: null,
        };
        transaction.set(claimRefs[index], claim);
        const downloadCount = Number(coupon.downloadCount || 0) + 1;
        claimed.push({ couponId: coupon.id, id: claimRefs[index].id, downloadCount });
        return { ...coupon, downloadCount };
      });
      if (claimed.length) {
        const count = claimed.length;
        const statsUpdate = { couponDownloadCount: admin.firestore.FieldValue.increment(count), updatedAt: timestamp };
        if (userStats.exists) transaction.update(userStatsRef, statsUpdate);
        else transaction.set(userStatsRef, { year, month, claimCount: 0, totalReward: 0, flyerTypes: {}, couponDownloadCount: count, createdAt: timestamp, updatedAt: timestamp });
        if (companyStatsRef) {
          if (companyStats.exists) transaction.update(companyStatsRef, statsUpdate);
          else transaction.set(companyStatsRef, { year, month, claimCount: 0, flyerCount: 0, totalReward: 0, totalEventMoney: 0, totalClaimCount: 0, couponDownloadCount: count, createdAt: timestamp, updatedAt: timestamp });
        }
        const update = { coupon: updatedCoupons[0], updatedAt: timestamp };
        if (Array.isArray(flyer.coupons)) update.coupons = updatedCoupons;
        transaction.update(flyerRef, update);
        if (flyer.companyId) {
          updatedCoupons.forEach((coupon, index) => {
            if (claimDocs[index].exists || !claimed.some((item) => item.couponId === coupon.id)) return;
            const ref = db.collection("companies").doc(flyer.companyId).collection("coupons")
              .doc(claimDocumentId(flyerId, coupon, index));
            transaction.set(ref, normalizeCompanyCouponEntry({ flyerId, companyId: flyer.companyId, flyerData: flyer, coupon }), { merge: true });
          });
        }
      }
      return { claimed, skipped };
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.message === "__FLYER_NOT_FOUND__") return res.status(404).json({ success: false, message: "Flyer not found" });
    if (error.message === "__NO_COUPONS__") return res.status(400).json({ success: false, message: "This flyer does not have claimable coupons" });
    if (error.message === "__FLYER_UNAVAILABLE__") return res.status(400).json({ success: false, message: "This flyer is not available" });
    console.error("Error claiming coupons:", error);
    return res.status(500).json({ success: false, message: "Failed to claim coupons" });
  }
});

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

    if (!flyerData || !coupon?.couponType) {
      return res.status(400).json({
        success: false,
        message: "This flyer does not have a coupon",
      });
    }

    if (couponAvailability(coupon, new Date().toISOString().slice(0, 10)) === "expired") {
      return res.status(400).json({ success: false, message: "This coupon has expired" });
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
      companyId: flyerData.companyId || null,
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

      if (!coupon?.couponType) throw new Error("__NO_COUPON__");
      if (couponAvailability(coupon, new Date().toISOString().slice(0, 10)) === "expired") {
        throw new Error("__EXPIRED__");
      }

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
      const flyerUpdate = {
        coupon: { ...coupon, downloadCount: Number(coupon.downloadCount || 0) + 1 },
        updatedAt: new Date().toISOString(),
      };
      if (Array.isArray(flyerData.coupons) && flyerData.coupons.length) {
        flyerUpdate.coupons = [
          { ...flyerData.coupons[0], downloadCount: flyerUpdate.coupon.downloadCount },
          ...flyerData.coupons.slice(1),
        ];
      }
      transaction.set(
        flyerRef,
        flyerUpdate,
        { merge: true },
      );
      if (flyerData.companyId) {
        const libraryRef = db.collection("companies").doc(flyerData.companyId).collection("coupons").doc(flyerId);
        transaction.set(libraryRef, normalizeCompanyCouponEntry({
          flyerId, companyId: flyerData.companyId, flyerData, coupon: flyerUpdate.coupon,
        }), { merge: true });
      }
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
    if (error.message === "__EXPIRED__" || error.message === "__NO_COUPON__") {
      return res.status(400).json({ success: false, message: error.message === "__EXPIRED__" ? "This coupon has expired" : "This flyer does not have a coupon" });
    }
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

// GET /company-claims - Get paginated claims for flyers owned by the current company
router.get("/company-claims", async (req, res) => {
  try {
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const limit = normalizePageLimit(req.query.limit);
    const cursorSnapshot = await getCursorSnapshot(db, req.query.cursor, ["users/"]);
    let query = db
      .collectionGroup("coupons")
      .where("companyId", "==", companyId)
      .orderBy("claimedAt", "desc")
      .limit(limit + 1);

    if (cursorSnapshot) {
      query = query.startAfter(cursorSnapshot);
    }

    const snapshot = await query.get();
    const hasMore = snapshot.docs.length > limit;
    const claimDocs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;
    const claims = claimDocs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const [flyerLookup, userLookup] = await Promise.all([
      getDocumentsByIds(
        db,
        "flyers",
        claims.map((claim) => claim.flyerId),
      ),
      getUserLookup(
        db,
        claims.map((claim) => claim.userId),
      ),
    ]);
    const data = claims.map((claim) => {
      const flyer = flyerLookup.get(claim.flyerId) || {};
      const flyerCoupon = getClaimFlyerCoupon(flyer, claim);

      return {
        ...claim,
        user: userLookup.get(claim.userId) || null,
        flyerTitle:
          flyer.header ||
          (claim.flyerId ? `Promotion ${claim.flyerId.slice(0, 6)}` : "-"),
        flyerCoupon: {
          downloadCount: flyerCoupon.downloadCount ?? 0,
          quantity: flyerCoupon.quantity ?? null,
        },
      };
    });

    return res.status(200).json({
      success: true,
      data,
      nextCursor: hasMore ? encodeCursor(claimDocs.at(-1).ref.path) : null,
    });
  } catch (error) {
    console.error("Error fetching company coupon claims:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch coupon claims",
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

    const coupons = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const claim = { id: doc.id, ...doc.data() };
        const flyerDoc = claim.flyerId
          ? await db.collection("flyers").doc(claim.flyerId).get()
          : null;
        const flyer = flyerDoc?.exists ? flyerDoc.data() : {};
        const flyerCoupon = getClaimFlyerCoupon(flyer, claim);

        return {
          ...claim,
          flyerTitle: flyer.header || "",
          flyerCoupon: {
            downloadCount: flyerCoupon.downloadCount ?? 0,
            quantity: flyerCoupon.quantity ?? null,
          },
        };
      }),
    );

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
