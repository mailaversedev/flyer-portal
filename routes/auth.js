const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

const router = express.Router();
const db = admin.firestore();

// JWT Secret - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || "flyer-portal-secret-key-2024";

const JWT_OPTIONS = {
  expiresIn: "24h",
  issuer: "flyer-portal",
  audience: "flyer-portal-users",
};

const RESET_OTP_COLLECTION = "passwordResetOtps";

const normalizeEmail = (value = "") => value.trim().toLowerCase();

const isValidEmail = (value = "") => /\S+@\S+\.\S+/.test(value);

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const createMailTransport = () =>
  nodemailer.createTransport({
    host: "mail.privateemail.com",
    port: 465,
    secure: true,
    auth: {
      user: "hi@mailaverse.io",
      pass: process.env.MAILAVERSE_SMTP_PASSWORD,
    },
  });

const sendPasswordResetEmail = async (email, otp) => {
  const transporter = createMailTransport();

  await transporter.sendMail({
    from: "hi@mailaverse.io",
    to: email,
    subject: "[Mailaverse] Your Password Reset Code",
    text: `Your password reset code is: ${otp}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #f6f8fa; padding: 32px 0;">
        <div style="max-width: 420px; margin: 0 auto; background: #fff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.07); padding: 32px 28px 24px 28px;">
          <div style="text-align: center; margin-bottom: 18px;">
            <img src='https://mailaverse.io/logo192.png' alt='Mailaverse Logo' style='width: 48px; height: 48px; margin-bottom: 8px;' />
            <h2 style="margin: 0; color: #1a1a1a; font-size: 1.4rem; font-weight: 600;">Mailaverse Password Reset</h2>
          </div>
          <p style="font-size: 1.05rem; color: #333; margin-bottom: 18px; text-align: center;">Use the following code to reset your password:</p>
          <div style="text-align: center; margin-bottom: 24px;">
            <span style="display: inline-block; font-size: 2.1rem; letter-spacing: 0.18em; color: #2d7ff9; background: #f0f6ff; border-radius: 8px; padding: 12px 32px; font-weight: bold; border: 1px solid #e0e7ef;">${otp}</span>
          </div>
          <p style="font-size: 0.98rem; color: #666; text-align: center; margin-bottom: 0;">This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
          <div style="margin-top: 32px; text-align: center; color: #b0b0b0; font-size: 0.92rem;">&copy; ${new Date().getFullYear()} Mailaverse</div>
        </div>
      </div>
    `,
  });
};

const findUserByEmail = async (email) => {
  const directQuery = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  return directQuery.empty ? null : directQuery.docs[0];
};

const storePasswordResetOtp = async (email, otp) => {
  await db.collection(RESET_OTP_COLLECTION).doc(email).set({
    email,
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
    used: false,
    createdAt: new Date().toISOString(),
  });
};

const consumePasswordResetOtp = async (email, otp) => {
  const otpRef = db.collection(RESET_OTP_COLLECTION).doc(email);
  const otpDoc = await otpRef.get();

  if (!otpDoc.exists) {
    throw new Error("OTP not found");
  }

  const data = otpDoc.data();

  if (data.used) {
    throw new Error("OTP already used");
  }

  if (Date.now() > data.expiresAt) {
    throw new Error("OTP expired");
  }

  if (data.otp !== otp) {
    throw new Error("Invalid OTP");
  }

  await otpRef.update({
    used: true,
    usedAt: new Date().toISOString(),
  });
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
    const { username, password, email } = req.body;
    const normalizedUsername = username?.trim();
    const normalizedEmail = normalizeEmail(email);

    // Validate required fields
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

    // Hash the password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user data
    const userData = {
      username: normalizedUsername,
      email: normalizedEmail,
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
        email: userData.email,
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
      locale: null, // New user has no locale preference yet
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

// POST /api/auth/request-password-reset - Request a password reset OTP
router.post("/request-password-reset", async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required",
      });
    }

    const userDoc = await findUserByEmail(normalizedEmail);

    if (!userDoc || userDoc.data()?.isActive === false) {
      return res.status(200).json({
        success: true,
        message:
          "If an account exists for this email, a password reset code has been sent.",
      });
    }

    const otp = generateOtp();
    await storePasswordResetOtp(normalizedEmail, otp);
    await sendPasswordResetEmail(normalizedEmail, otp);

    return res.status(200).json({
      success: true,
      message:
        "If an account exists for this email, a password reset code has been sent.",
    });
  } catch (error) {
    console.error("Error requesting password reset:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during password reset request",
      error: error.message,
    });
  }
});

// POST /api/auth/reset-password - Reset password with email OTP
router.post("/reset-password", async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    const otp = req.body?.otp?.toString().trim();
    const newPassword = req.body?.newPassword;

    if (!normalizedEmail || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Email, OTP, and new password are required",
      });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    await consumePasswordResetOtp(normalizedEmail, otp);

    const userDoc = await findUserByEmail(normalizedEmail);

    if (!userDoc || userDoc.data()?.isActive === false) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await db.collection("users").doc(userDoc.id).update({
      password: hashedPassword,
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    const clientSafeErrors = new Set([
      "OTP not found",
      "OTP already used",
      "OTP expired",
      "Invalid OTP",
    ]);

    if (clientSafeErrors.has(error.message)) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Error resetting password:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during password reset",
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
      locale: userData.profile?.locale || null,
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

module.exports = { router, authenticateToken };
