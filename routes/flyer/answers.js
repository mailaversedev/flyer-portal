const express = require("express");

const { authenticateToken } = require("../auth");

module.exports = function createAnswersRouter(context) {
  const { db } = context;

  const router = express.Router();

  router.post("/flyer/:flyerId/answers", authenticateToken, async (req, res) => {
    try {
      const { flyerId } = req.params;
      const { answers } = req.body;

      if (!flyerId || !answers) {
        return res.status(400).json({
          success: false,
          message: "Missing flyerId or answers",
        });
      }

      const answerRef = db
        .collection("flyers")
        .doc(flyerId)
        .collection("answers")
        .doc(req.user.userId);

      const timestamp = new Date().toISOString();
      const answerData = {
        flyerId,
        userId: req.user.userId,
        answers,
        updatedAt: timestamp,
      };

      const doc = await answerRef.get();

      if (doc.exists) {
        await answerRef.update(answerData);
      } else {
        answerData.createdAt = timestamp;
        await answerRef.set(answerData);
      }

      res.status(200).json({
        success: true,
        message: "Survey answers submitted successfully",
      });
    } catch (error) {
      console.error("Error submitting survey answers:", error);
      res.status(500).json({
        success: false,
        message: "Failed to submit survey answers",
        error: error.message,
      });
    }
  });

  router.get(
    "/flyer/:flyerId/answer-status",
    authenticateToken,
    async (req, res) => {
      try {
        const { flyerId } = req.params;
        const userId = req.user.userId;

        if (!flyerId) {
          return res.status(400).json({
            success: false,
            message: "Missing flyerId",
          });
        }

        const answerDoc = await db
          .collection("flyers")
          .doc(flyerId)
          .collection("answers")
          .doc(userId)
          .get();

        if (answerDoc.exists) {
          res.status(200).json({
            success: true,
            submitted: true,
            data: answerDoc.data(),
          });
        } else {
          res.status(200).json({
            success: true,
            submitted: false,
          });
        }
      } catch (error) {
        console.error("Error checking answer status:", error);
        res.status(500).json({
          success: false,
          message: "Failed to check answer status",
          error: error.message,
        });
      }
    },
  );

  return router;
};
