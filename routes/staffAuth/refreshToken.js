const express = require("express");
const jwt = require("jsonwebtoken");

const getRequestCookie = (req, name) => {
  const prefix = `${name}=`;
  const cookie = (req.headers.cookie || "")
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
};

module.exports = function createRefreshTokenRouter(context) {
  const { db, JWT_SECRET, JWT_OPTIONS, rotateRefreshSession, revokeRefreshSession } =
    context;

  const router = express.Router();

  router.post("/refresh-token", async (req, res) => {
    try {
      const refreshToken = getRequestCookie(req, "staff_refresh_token");
      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          message: "Refresh session is required",
        });
      }

      const session = await rotateRefreshSession({
        db,
        refreshToken,
        subjectType: "staff",
        rollingDays: 14,
      });
      const { userId } = session;

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
      res.cookie("staff_refresh_token", session.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth/staff",
        maxAge: 14 * 24 * 60 * 60 * 1000,
      });

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

      console.error("Error refreshing staff token:", error);
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
      refreshToken: getRequestCookie(req, "staff_refresh_token"),
      subjectType: "staff",
      reason: "logout",
    });
    res.clearCookie("staff_refresh_token", { path: "/api/auth/staff" });
    return res.status(204).end();
  });

  return router;
};
