const express = require("express");

const { authenticateToken } = require("../auth");

module.exports = function createListingRouter(context) {
  const { db } = context;

  const router = express.Router();

  router.get("/flyer/:flyerId", authenticateToken, async (req, res) => {
    try {
      const { flyerId } = req.params;
      const isSuperAdmin = req.user?.role === "super-admin";

      if (!flyerId) {
        return res.status(400).json({
          success: false,
          message: "Missing flyerId",
        });
      }

      const flyerDoc = await db.collection("flyers").doc(flyerId).get();
      if (!flyerDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Flyer not found",
        });
      }

      const flyerData = flyerDoc.data() || {};

      if (
        !isSuperAdmin &&
        flyerData.companyId &&
        flyerData.companyId !== req.user.companyId
      ) {
        return res.status(404).json({
          success: false,
          message: "Flyer not found",
        });
      }

      const flyer = {
        id: flyerDoc.id,
        ...flyerData,
      };

      try {
        const lotteryDoc = await db.collection("lottery").doc(flyerId).get();
        if (lotteryDoc.exists) {
          flyer.lottery = lotteryDoc.data();
        }
      } catch (lotteryError) {
        console.warn(
          "Error fetching lottery metadata for single flyer:",
          lotteryError,
        );
      }

      res.status(200).json({
        success: true,
        data: flyer,
      });
    } catch (error) {
      console.error("Error fetching flyer by ID:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch flyer",
        error: error.message,
      });
    }
  });

  router.get("/flyers", async (req, res) => {
    try {
      const {
        limit = "100",
        after,
        sortBy = "createdAt",
        direction = "desc",
        companyId,
      } = req.query;

      const limitNum = parseInt(limit, 10);
      if (Number.isNaN(limitNum) || limitNum <= 0 || limitNum > 1000) {
        return res.status(400).json({
          success: false,
          message: "Invalid limit. Must be a number between 1 and 1000.",
        });
      }

      if (!["asc", "desc"].includes(direction.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid direction. Must be "asc" or "desc".',
        });
      }

      const validSortFields = ["createdAt", "updatedAt", "type", "status"];
      if (!validSortFields.includes(sortBy)) {
        return res.status(400).json({
          success: false,
          message: `Invalid sortBy field. Must be one of: ${validSortFields.join(
            ", ",
          )}.`,
        });
      }

      let query = db.collection("flyers");

      if (companyId) {
        query = query.where("companyId", "==", companyId);
      }

      query = query.orderBy(sortBy, direction.toLowerCase());

      if (after) {
        try {
          const afterDoc = await db.collection("flyers").doc(after).get();
          if (!afterDoc.exists) {
            return res.status(400).json({
              success: false,
              message: "Invalid cursor. Document not found.",
            });
          }
          query = query.startAfter(afterDoc);
        } catch (_error) {
          return res.status(400).json({
            success: false,
            message: "Invalid cursor format.",
          });
        }
      }

      query = query.limit(limitNum);

      const snapshot = await query.get();

      const flyers = [];
      snapshot.forEach((doc) => {
        flyers.push({
          id: doc.id,
          ...doc.data(),
        });
      });

      if (flyers.length > 0) {
        try {
          const lotteryRefs = flyers.map((flyer) =>
            db.collection("lottery").doc(flyer.id),
          );
          const lotterySnapshots = await db.getAll(...lotteryRefs);

          lotterySnapshots.forEach((lotteryDoc, index) => {
            if (lotteryDoc.exists) {
              flyers[index].lottery = lotteryDoc.data();
            }
          });
        } catch (err) {
          console.warn("Error fetching lottery metadata:", err);
        }
      }

      let nextCursor = null;
      if (flyers.length === limitNum && flyers.length > 0) {
        nextCursor = flyers[flyers.length - 1].id;
      }

      res.status(200).json({
        success: true,
        data: flyers,
        pagination: {
          nextCursor,
        },
      });
    } catch (error) {
      console.error("Error fetching flyers:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch flyers",
        error: error.message,
      });
    }
  });

  return router;
};
