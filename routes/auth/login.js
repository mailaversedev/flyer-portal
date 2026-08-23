const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

module.exports = function createLoginRouter(context) {
  const {
    db,
    JWT_SECRET,
    JWT_OPTIONS,
    LEGACY_JWT_OPTIONS,
    ROTATING_SESSION_MODE,
    createRefreshSession,
  } = context;

  const router = express.Router();

  router.post("/login", async (req, res) => {
    try {
      const { username, password, sessionMode } = req.body;
      const usesRotatingSession = sessionMode === ROTATING_SESSION_MODE;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "Username and password are required",
        });
      }

      const userQuery = await db
        .collection("users")
        .where("username", "==", username)
        .limit(1)
        .get();

      if (userQuery.empty) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password",
        });
      }

      const userDoc = userQuery.docs[0];
      const userData = userDoc.data();

      if (!userData.isActive) {
        return res.status(401).json({
          success: false,
          message: "User account is deactivated",
        });
      }

      const isPasswordValid = await bcrypt.compare(password, userData.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password",
        });
      }

      const tokenPayload = {
        userId: userDoc.id,
        username: userData.username,
        locale: userData.profile?.locale || null,
      };

      const token = jwt.sign(
        tokenPayload,
        JWT_SECRET,
        usesRotatingSession ? JWT_OPTIONS : LEGACY_JWT_OPTIONS,
      );
      const session = usesRotatingSession
        ? await createRefreshSession({
            db,
            userId: userDoc.id,
            subjectType: "user",
            rollingDays: 30,
            absoluteDays: 90,
            metadata: { userAgent: req.get("user-agent") || null },
          })
        : null;

      await db.collection("users").doc(userDoc.id).update({
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          token,
          ...(session
            ? {
                refreshToken: session.refreshToken,
                refreshTokenExpiresAt: session.expiresAt,
              }
            : {}),
          user: tokenPayload,
        },
      });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during login",
        error: error.message,
      });
    }
  });

  return router;
};
