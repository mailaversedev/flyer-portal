const express = require("express");
const jwt = require("jsonwebtoken");

module.exports = function createBiometricSessionRouter(context) {
  const {
    db,
    JWT_SECRET,
    JWT_OPTIONS,
    createRefreshSession,
    authenticateToken,
  } = context;

  const router = express.Router();

  router.post("/biometric-session", authenticateToken, async (req, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Invalid user session",
        });
      }

      const userDoc = await db.collection("users").doc(userId).get();
      if (!userDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const userData = userDoc.data();
      if (!userData.isActive) {
        return res.status(401).json({
          success: false,
          message: "User account is deactivated",
        });
      }

      const tokenPayload = {
        userId: userDoc.id,
        username: userData.username,
        locale: userData.profile?.locale || null,
      };
      const token = jwt.sign(tokenPayload, JWT_SECRET, JWT_OPTIONS);
      const session = await createRefreshSession({
        db,
        userId: userDoc.id,
        subjectType: "user",
        rollingDays: 30,
        absoluteDays: 90,
        metadata: {
          authMethod: "biometric",
          userAgent: req.get("user-agent") || null,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Biometric session created successfully",
        data: {
          token,
          refreshToken: session.refreshToken,
          refreshTokenExpiresAt: session.expiresAt,
          user: tokenPayload,
        },
      });
    } catch (error) {
      console.error("Error creating biometric session:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error creating biometric session",
        error: error.message,
      });
    }
  });

  return router;
};
