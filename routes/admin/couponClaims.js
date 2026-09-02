const express = require("express");

const {
  encodeCursor,
  getCursorSnapshot,
  getDocumentsByIds,
  getUserLookup,
  normalizePageLimit,
} = require("./engagementHelpers");

module.exports = function createCouponClaimsRouter(context) {
  const { db } = context;
  const router = express.Router();

  router.get("/coupon-claims", async (req, res) => {
    try {
      const limit = normalizePageLimit(req.query.limit);
      const cursorSnapshot = await getCursorSnapshot(db, req.query.cursor, [
        "users/",
      ]);
      let query = db
        .collectionGroup("coupons")
        .orderBy("claimedAt", "desc")
        .limit(limit + 1);

      if (cursorSnapshot) {
        query = query.startAfter(cursorSnapshot);
      }

      const snapshot = await query.get();
      const hasMore = snapshot.docs.length > limit;
      const claimDocs = hasMore ? snapshot.docs.slice(0, limit) : snapshot.docs;
      const claims = claimDocs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const [userLookup, flyerLookup] = await Promise.all([
        getUserLookup(
          db,
          claims.map((claim) => claim.userId),
        ),
        getDocumentsByIds(
          db,
          "flyers",
          claims.map((claim) => claim.flyerId),
        ),
      ]);

      const data = claims.map((claim) => {
        const flyer = flyerLookup.get(claim.flyerId) || {};
        return {
          ...claim,
          flyerTitle:
            flyer.header ||
            (claim.flyerId ? `Promotion ${claim.flyerId.slice(0, 6)}` : "-"),
          user: userLookup.get(claim.userId) || null,
        };
      });

      return res.status(200).json({
        success: true,
        data,
        nextCursor: hasMore ? encodeCursor(claimDocs.at(-1).ref.path) : null,
      });
    } catch (error) {
      console.error("Error fetching admin coupon claims:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch coupon claims",
        error: error.message,
      });
    }
  });

  return router;
};
