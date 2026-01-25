const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const db = admin.firestore();

// JWT Secret - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || "flyer-portal-secret-key-2024";

const JWT_OPTIONS = {
  expiresIn: "24h",
  issuer: "flyer-portal",
  audience: "flyer-portal-users",
};

// JWT Middleware for protected routes (optional usage)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token is required",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    req.user = decoded;
    next();
  });
};

// POST /api/auth/register - Register a new user
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Validate password length (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Check if user already exists
    const existingUserQuery = await db
      .collection("users")
      .where("username", "==", username)
      .limit(1)
      .get();

    if (!existingUserQuery.empty) {
      return res.status(409).json({
        success: false,
        message: "Username already exists",
      });
    }

    // Hash the password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user data
    const userData = {
      username: username,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
    };

    // Save user to Firestore and create wallet in a transaction
    const timestamp = new Date().toISOString();

    const result = await db.runTransaction(async (transaction) => {
      // Create user document
      const userRef = db.collection("users").doc();
      transaction.set(userRef, userData);

      // Create wallet for the user
      const walletData = {
        userId: userRef.id,
        username: userData.username,
        balance: 0,
        currency: "TOKEN", // Default currency - you can modify this
        createdAt: timestamp,
        updatedAt: timestamp,
        isActive: true,
        version: 1, // For optimistic locking
      };

      const walletRef = db.collection("wallets").doc();
      transaction.set(walletRef, walletData);

      return { userId: userRef.id, walletId: walletRef.id };
    });

    // Generate JWT token
    const tokenPayload = {
      userId: result.userId,
      username: userData.username,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, JWT_OPTIONS);

    // Return success response (without password)
    const responseData = {
      token: token,
      user: tokenPayload,
    };

    res.status(201).json({
      success: true,
      message: "User registered successfully and wallet created",
      data: responseData,
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

// POST /api/auth/login - Login user and generate JWT token
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Find user by username
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

    // Check if user is active
    if (!userData.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is deactivated",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, userData.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Generate JWT token
    const tokenPayload = {
      userId: userDoc.id,
      username: userData.username,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, JWT_OPTIONS);

    // Update last login timestamp
    await db.collection("users").doc(userDoc.id).update({
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Return success response with token
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token: token,
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

// POST /api/auth/refresh-token - Refresh a valid token
router.post("/refresh-token", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;

    // Check if user exists in DB
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userData = userDoc.data();

    // Check if user is active
    if (!userData.isActive) {
      return res.status(401).json({
        success: false,
        message: "User account is deactivated",
      });
    }

    // Generate a new JWT token using latest data
    const tokenPayload = {
      userId: userDoc.id,
      username: userData.username,
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

module.exports = { router, authenticateToken };
