const express = require("express");

const {
  encodeCursor,
  getCursorSnapshot,
  getUserLookup,
  normalizePageLimit,
} = require("./engagementHelpers");

module.exports = function createVoucherRedemptionsRouter(context) {
  const { db } = context;
  const router = express.Router();

  router.get("/voucher-redemptions", async (req, res) => {
    try {
      const limit = normalizePageLimit(req.query.limit);
      const cursorSnapshot = await getCursorSnapshot(db, req.query.cursor, [
        "voucherRedemptions/",
      ]);
      let query = db
        .collection("voucherRedemptions")
        .orderBy("createdAt", "desc")
        .limit(limit + 1);

      if (cursorSnapshot) {
        query = query.startAfter(cursorSnapshot);
      }

      const snapshot = await query.get();
      const hasMore = snapshot.docs.length > limit;
      const redemptionDocs = hasMore
        ? snapshot.docs.slice(0, limit)
        : snapshot.docs;
      const redemptions = redemptionDocs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const userLookup = await getUserLookup(
        db,
        redemptions.map((redemption) => redemption.userId),
      );

      const data = redemptions.map((redemption) => ({
        ...redemption,
        voucher: redemption.result?.voucher || null,
        user: userLookup.get(redemption.userId) || null,
      }));

      return res.status(200).json({
        success: true,
        data,
        nextCursor: hasMore
          ? encodeCursor(redemptionDocs.at(-1).ref.path)
          : null,
      });
    } catch (error) {
      console.error("Error fetching admin voucher redemptions:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch voucher redemptions",
        error: error.message,
      });
    }
  });

  return router;
};
