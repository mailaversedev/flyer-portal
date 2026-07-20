const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

module.exports = function createLoginRouter(context) {
  const { db, JWT_SECRET, JWT_OPTIONS } = context;

  const router = express.Router();

  router.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body;

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

      const token = jwt.sign(tokenPayload, JWT_SECRET, JWT_OPTIONS);

      await db.collection("users").doc(userDoc.id).update({
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          token,
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
