const express = require("express");
const jwt = require("jsonwebtoken");

module.exports = function createRefreshTokenRouter(context) {
  const { db, authenticateToken, JWT_SECRET, JWT_OPTIONS } = context;

  const router = express.Router();

  router.post("/refresh-token", authenticateToken, async (req, res) => {
    try {
      const { userId } = req.user;

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

      const newToken = jwt.sign(tokenPayload, JWT_SECRET, JWT_OPTIONS);

      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          user: tokenPayload,
          token: newToken,
        },
      });
    } catch (error) {
      console.error("Error refreshing token:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during token refresh",
        error: error.message,
      });
    }
  });

  return router;
};
