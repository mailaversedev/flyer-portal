const express = require("express");

const {
  processQueuedFlyerJobs,
  cleanupExpiredFlyerJobs,
} = require("../../services/flyerJobService");

module.exports = function createJobsRouter() {
  const router = express.Router();

  async function processFlyerJobsHandler(req, res) {
    try {
      const secret = req.header("x-job-secret");
      const expectedSecret = process.env.NOTIFICATION_JOB_SECRET;

      if (!expectedSecret || secret !== expectedSecret) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized worker request",
        });
      }

      const maxJobs = Math.max(1, Math.min(20, Number(req.body?.maxJobs) || 3));
      const [processResult, cleanupResult] = await Promise.all([
        processQueuedFlyerJobs(maxJobs),
        cleanupExpiredFlyerJobs(500),
      ]);

      res.status(200).json({
        success: true,
        data: {
          ...processResult,
          deletedExpired: cleanupResult.deleted,
        },
      });
    } catch (error) {
      console.error("Error running flyer job worker:", error);
      res.status(500).json({
        success: false,
        message: "Failed to run flyer job worker",
        error: error.message,
      });
    }
  }

  router.post("/flyer-jobs/process", processFlyerJobsHandler);
  router.post("/notification-jobs/process", processFlyerJobsHandler);

  return router;
};
