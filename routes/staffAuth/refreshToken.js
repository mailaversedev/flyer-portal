const express = require("express");
const jwt = require("jsonwebtoken");

module.exports = function createRefreshTokenRouter(context) {
  const { db, authenticateToken, JWT_SECRET, JWT_OPTIONS } = context;

  const router = express.Router();

  router.post("/refresh-token", authenticateToken, async (req, res) => {
    try {
      const { userId } = req.user;

      const staffDoc = await db.collection("staffs").doc(userId).get();

      if (!staffDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Staff not found",
        });
      }

      const staffData = staffDoc.data();

      if (!staffData.isActive) {
        return res.status(401).json({
          success: false,
          message: "Staff account is deactivated",
        });
      }

      const tokenPayload = {
        userId: staffDoc.id,
        username: staffData.username,
        displayName: staffData.displayName,
        role: staffData.role,
        companyId: staffData.companyId,
        locale: staffData.profile?.locale || null,
      };

      const newToken = jwt.sign(tokenPayload, JWT_SECRET, JWT_OPTIONS);

      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          token: newToken,
          user: {
            id: staffDoc.id,
            username: staffData.username,
            displayName: staffData.displayName,
            role: staffData.role,
            companyId: staffData.companyId,
            locale: staffData.profile?.locale || null,
          },
        },
      });
    } catch (error) {
      console.error("Error refreshing staff token:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during token refresh",
        error: error.message,
      });
    }
  });

  return router;
};
