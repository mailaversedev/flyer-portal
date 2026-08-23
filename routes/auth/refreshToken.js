const express = require("express");
const jwt = require("jsonwebtoken");

module.exports = function createRefreshTokenRouter(context) {
  const {
    db,
    JWT_SECRET,
    JWT_OPTIONS,
    LEGACY_JWT_OPTIONS,
    rotateRefreshSession,
    revokeRefreshSession,
  } = context;

  const router = express.Router();

  router.post("/refresh-token", async (req, res) => {
    try {
      const refreshToken = req.body?.refreshToken;
      const legacyAccessToken = req.headers.authorization?.split(" ")[1];
      const usesRotatingSession =
        typeof refreshToken === "string" && refreshToken.length > 0;

      if (!usesRotatingSession && !legacyAccessToken) {
        return res.status(401).json({
          success: false,
          message: "Access token or refresh token is required",
        });
      }

      let session = null;
      let userId;
      if (usesRotatingSession) {
        session = await rotateRefreshSession({
          db,
          refreshToken,
          subjectType: "user",
          rollingDays: 30,
        });
        userId = session.userId;
      } else {
        const decoded = jwt.verify(legacyAccessToken, JWT_SECRET, {
          algorithms: ["HS256"],
          issuer: JWT_OPTIONS.issuer,
          audience: JWT_OPTIONS.audience,
        });
        userId = decoded.userId;
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

      const newToken = jwt.sign(
        tokenPayload,
        JWT_SECRET,
        usesRotatingSession ? JWT_OPTIONS : LEGACY_JWT_OPTIONS,
      );

      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          user: tokenPayload,
          token: newToken,
          ...(session
            ? {
                refreshToken: session.refreshToken,
                refreshTokenExpiresAt: session.expiresAt,
              }
            : {}),
        },
      });
    } catch (error) {
      if (
        ["Invalid refresh session", "Refresh session expired"].includes(
          error.message,
        )
      ) {
        return res.status(401).json({
          success: false,
          message: "Session expired. Please login again.",
        });
      }

      if (
        error.name === "JsonWebTokenError" ||
        error.name === "TokenExpiredError"
      ) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token",
        });
      }

      console.error("Error refreshing token:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error during token refresh",
        error: error.message,
      });
    }
  });

  router.post("/logout", async (req, res) => {
    await revokeRefreshSession({
      db,
      refreshToken: req.body?.refreshToken,
      subjectType: "user",
      reason: "logout",
    });
    return res.status(204).end();
  });

  return router;
};
