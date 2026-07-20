const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

module.exports = function createRegisterRouter(context) {
  const {
    db,
    JWT_SECRET,
    JWT_OPTIONS,
    normalizeEmail,
    isValidEmail,
    findUserByEmail,
  } = context;

  const router = express.Router();

  router.post("/register", async (req, res) => {
    try {
      const { username, password, email } = req.body;
      const normalizedUsername = username?.trim();
      const normalizedEmail = normalizeEmail(email);

      if (!normalizedUsername || !password || !normalizedEmail) {
        return res.status(400).json({
          success: false,
          message: "Username, email, and password are required",
        });
      }

      if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "A valid email address is required",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }

      const existingUserQuery = await db
        .collection("users")
        .where("username", "==", normalizedUsername)
        .limit(1)
        .get();

      if (!existingUserQuery.empty) {
        return res.status(409).json({
          success: false,
          message: "Username already exists",
        });
      }

      const existingEmailUser = await findUserByEmail(normalizedEmail);

      if (existingEmailUser) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }

      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const userData = {
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      };

      const timestamp = new Date().toISOString();

      const result = await db.runTransaction(async (transaction) => {
        const userRef = db.collection("users").doc();
        transaction.set(userRef, userData);

        const walletData = {
          userId: userRef.id,
          username: userData.username,
          email: userData.email,
          balance: 0,
          currency: "TOKEN",
          createdAt: timestamp,
          updatedAt: timestamp,
          isActive: true,
          version: 1,
        };

        const walletRef = db.collection("wallets").doc();
        transaction.set(walletRef, walletData);

        return { userId: userRef.id, walletId: walletRef.id };
      });

      const tokenPayload = {
        userId: result.userId,
        username: userData.username,
        locale: null,
      };

      const token = jwt.sign(tokenPayload, JWT_SECRET, JWT_OPTIONS);

      res.status(201).json({
        success: true,
        message: "User registered successfully and wallet created",
        data: {
          token,
          user: tokenPayload,
        },
      });
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during registration",
        error: error.message,
      });
    }
  });

  return router;
};
