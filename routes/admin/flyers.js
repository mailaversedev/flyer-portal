const express = require("express");

module.exports = function createFlyersRouter(context) {
  const { db, normalizeLimit, normalizeString, commitDeleteRefsInChunks } = context;

  const router = express.Router();

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

  router.post("/flyers/:flyerId/status", async (req, res) => {
    try {
      const { flyerId } = req.params;
      const nextStatus = normalizeString(req.body?.status).toLowerCase();

      if (!flyerId) {
        return res.status(400).json({
          success: false,
          message: "Flyer ID is required",
        });
      }

      if (!["active", "inactive"].includes(nextStatus)) {
        return res.status(400).json({
          success: false,
          message: "Status must be active or inactive",
        });
      }

      const flyerRef = db.collection("flyers").doc(flyerId);
      const flyerDoc = await flyerRef.get();

      if (!flyerDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Flyer not found",
        });
      }

      await flyerRef.set(
        {
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      const updatedFlyerDoc = await flyerRef.get();

      return res.status(200).json({
        success: true,
        message: "Flyer status updated successfully",
        data: {
          id: updatedFlyerDoc.id,
          ...updatedFlyerDoc.data(),
        },
      });
    } catch (error) {
      console.error("Error updating admin flyer status:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update flyer status",
        error: error.message,
      });
    }
  });

  router.delete("/flyers/:flyerId", async (req, res) => {
    try {
      const { flyerId } = req.params;

      if (!flyerId) {
        return res.status(400).json({
          success: false,
          message: "Flyer ID is required",
        });
      }

      const flyerRef = db.collection("flyers").doc(flyerId);
      const flyerDoc = await flyerRef.get();

      if (!flyerDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Flyer not found",
        });
      }

      const lotteryRef = db.collection("lottery").doc(flyerId);
      const flyerJobsSnapshot = await db
        .collection("notificationJobs")
        .where("flyerId", "==", flyerId)
        .get();

      const refsToDelete = [
        flyerRef,
        lotteryRef,
        ...flyerJobsSnapshot.docs.map((doc) => doc.ref),
      ];

      await commitDeleteRefsInChunks(refsToDelete);

      return res.status(200).json({
        success: true,
        message: "Flyer deleted successfully",
        data: {
          flyerId,
        },
      });
    } catch (error) {
      console.error("Error deleting admin flyer:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete flyer",
        error: error.message,
      });
    }
  });

  return router;
};
