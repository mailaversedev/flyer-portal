const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const db = admin.firestore();

// JWT Secret - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || "flyer-portal-secret-key-2024";

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
    const { username, displayName, password } = req.body;

    // Validate required fields
    if (!username || !displayName || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, display name, and password are required",
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
      displayName: displayName,
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

    // Return success response (without password)
    const responseData = {
      id: result.userId,
      username: userData.username,
      displayName: userData.displayName,
      createdAt: userData.createdAt,
      isActive: userData.isActive,
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
      displayName: userData.displayName,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: "24h",
      issuer: "flyer-portal",
      audience: "flyer-portal-users",
    });

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
        user: {
          id: userDoc.id,
          username: userData.username,
          displayName: userData.displayName,
        },
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

// POST /api/auth/staff/register - Register a new staff user
router.post("/staff/register", async (req, res) => {
  try {
    const {
      username,
      displayName,
      password,
      companyName,
      companyIcon,
      address,
      contact,
      role,
    } = req.body;

    // Validate required fields
    if (!username || !displayName || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, display name, and password are required",
      });
    }

    // Validate password length (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Check if staff already exists
    const existingStaffQuery = await db
      .collection("staffs")
      .where("username", "==", username)
      .limit(1)
      .get();

    if (!existingStaffQuery.empty) {
      return res.status(409).json({
        success: false,
        message: "Staff username already exists",
      });
    }

    // Hash the password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Use a transaction to create company (if provided) and staff
    const result = await db.runTransaction(async (transaction) => {
      let companyId = null;
      let companyData = null;

      // If company info is provided, create company
      if (companyName) {
        const companyRef = db.collection("companies").doc();
        companyData = {
          name: companyName,
          icon: companyIcon,
          address,
          contact,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true,
        };
        transaction.set(companyRef, companyData);
        companyId = companyRef.id;
      }

      // Create staff data
      const staffRef = db.collection("staffs").doc();
      const staffData = {
        username: username,
        displayName: displayName,
        password: hashedPassword,
        role: role || "staff",
        companyId: companyId, // Link to company if created
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
      };

      transaction.set(staffRef, staffData);

      return {
        staffId: staffRef.id,
        staffData,
        companyId,
        companyData,
      };
    });

    // Return success response (without password)
    const responseData = {
      id: result.staffId,
      username: result.staffData.username,
      displayName: result.staffData.displayName,
      role: result.staffData.role,
      companyId: result.companyId,
      createdAt: result.staffData.createdAt,
      isActive: result.staffData.isActive,
    };

    if (result.companyData) {
      responseData.company = {
        id: result.companyId,
        name: result.companyData.name,
      };
    }

    res.status(201).json({
      success: true,
      message: "Staff registered successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Error registering staff:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during staff registration",
      error: error.message,
    });
  }
});

// POST /api/auth/staff/login - Login staff and generate JWT token
router.post("/staff/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    // Find staff by username
    const staffQuery = await db
      .collection("staffs")
      .where("username", "==", username)
      .limit(1)
      .get();

    if (staffQuery.empty) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    const staffDoc = staffQuery.docs[0];
    const staffData = staffDoc.data();

    // Check if staff is active
    if (!staffData.isActive) {
      return res.status(401).json({
        success: false,
        message: "Staff account is deactivated",
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, staffData.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password",
      });
    }

    // Fetch company information if available
    let companyInfo = null;
    if (staffData.companyId) {
      const companyDoc = await db
        .collection("companies")
        .doc(staffData.companyId)
        .get();
      if (companyDoc.exists) {
        const companyData = companyDoc.data();
        companyInfo = {
          id: companyDoc.id,
          name: companyData.name,
          icon: companyData.icon,
          address: companyData.address,
          contact: companyData.contact,
          isActive: companyData.isActive,
        };
      }
    }

    // Generate JWT token
    const tokenPayload = {
      userId: staffDoc.id,
      username: staffData.username,
      displayName: staffData.displayName,
      role: staffData.role,
      companyId: staffData.companyId,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: "12h", // Staff tokens might have different expiry
      issuer: "flyer-portal",
      audience: "flyer-portal-staff",
    });

    // Update last login timestamp
    await db.collection("staffs").doc(staffDoc.id).update({
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Return success response with token
    res.status(200).json({
      success: true,
      message: "Staff login successful",
      data: {
        token: token,
        user: {
          id: staffDoc.id,
          username: staffData.username,
          displayName: staffData.displayName,
          role: staffData.role,
          companyId: staffData.companyId,
        },
        company: companyInfo,
      },
    });
  } catch (error) {
    console.error("Error during staff login:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during staff login",
      error: error.message,
    });
  }
});

// Example of a protected route - GET /api/auth/profile
router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const userDoc = await db.collection("users").doc(req.user.userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userData = userDoc.data();

    // Return user profile (without password)
    res.status(200).json({
      success: true,
      data: {
        id: userDoc.id,
        username: userData.username,
        displayName: userData.displayName,
        createdAt: userData.createdAt,
        lastLoginAt: userData.lastLoginAt,
        isActive: userData.isActive,
      },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = { router, authenticateToken };
