const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");

const { authenticateToken } = require("./auth");

const router = express.Router();
const db = admin.firestore();

// JWT Secret - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || "flyer-portal-secret-key-2024";

const JWT_OPTIONS = {
  expiresIn: "12h", // Staff tokens might have different expiry
  issuer: "flyer-portal",
  audience: "flyer-portal-staff",
};

const ALLOWED_STAFF_ROLES = new Set(["staff", "admin"]);

// POST /register - Register a new staff user
// Mounted at /api/auth/staff/register
router.post("/register", async (req, res) => {
  try {
    const {
      username,
      displayName,
      password,
      companyDisplayName,
      companyName,
      companyIcon,
      address,
      contact,
      role,
      companyNature,
      locale,
    } = req.body;
    const requestedRole = typeof role === "string" ? role.trim() : "staff";

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

    if (!ALLOWED_STAFF_ROLES.has(requestedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff role",
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
          companyDisplayName,
          name: companyName,
          icon: companyIcon,
          address,
          contact,
          nature: companyNature,
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
        role: requestedRole,
        companyId: companyId, // Link to company if created
        profile: {
          locale: locale || "en",
        },
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

// POST /login - Login staff and generate JWT token
// Mounted at /api/auth/staff/login
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

    // Fetch company information if available, and add statistics
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
          companyDisplayName: companyData.companyDisplayName,
          name: companyData.name,
          nature: companyData.nature,
          icon: companyData.icon,
          address: companyData.address,
          contact: companyData.contact,
          coverPhotos: Array.isArray(companyData.coverPhotos)
            ? companyData.coverPhotos.filter(
                (photo) => typeof photo === "string" && photo.trim(),
              )
            : [],
          introduction:
            typeof companyData.introduction === "string"
              ? companyData.introduction
              : null,
          website:
            typeof companyData.website === "string"
              ? companyData.website
              : null,
          isActive: companyData.isActive,
        };

        // --- Add statistics aggregation for current year ---
        const now = new Date();
        const year = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const statsDocId = `${year}-${String(currentMonth).padStart(2, "0")}`;
        const statsRef = db
          .collection("companies")
          .doc(companyDoc.id)
          .collection("statistics");

        // Try to get all statistics for the current year
        const statsQuery = await statsRef.where("year", "==", year).get();

        let statsList = [];
        if (statsQuery.empty) {
          // If not found, create one for current year/month
          const newStats = {
            year: year,
            month: currentMonth,
            claimCount: 0,
            flyerCount: 0,
            totalReward: 0,
            totalEventMoney: 0,
            totalClaimCount: 0,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          };
          await statsRef.doc(statsDocId).set(newStats);
          statsList = [newStats];
        } else {
          statsList = statsQuery.docs.map((doc) => doc.data());
        }

        // Aggregate data for the year
        const aggregated = statsList.reduce(
          (acc, stat) => {
            acc.claimCount += stat.claimCount || 0;
            acc.totalReward += stat.totalReward || 0;
            acc.totalEventMoney += stat.totalEventMoney || 0;
            acc.totalClaimCount += stat.totalClaimCount || 0;
            acc.flyerCount += stat.flyerCount || 0;
            acc.couponDownloadCount += stat.couponDownloadCount || 0;
            return acc;
          },
          {
            claimCount: 0,
            totalReward: 0,
            totalEventMoney: 0,
            totalClaimCount: 0,
            flyerCount: 0,
            couponDownloadCount: 0,
          },
        );
        companyInfo.stats = {
          year,
          claimCount: aggregated.claimCount,
          totalReward: aggregated.totalReward,
          couponDownloadCount: aggregated.couponDownloadCount,
          months: aggregated.months,
          monthly: statsList,
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
      locale: staffData.profile?.locale || null,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, JWT_OPTIONS);

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
          locale: staffData.profile?.locale || null,
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

// POST /refresh-token - Refresh a valid staff token
router.post("/refresh-token", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;

    // Check if staff exists in DB
    const staffDoc = await db.collection("staffs").doc(userId).get();

    if (!staffDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Staff not found",
      });
    }

    const staffData = staffDoc.data();

    // Check if staff is active
    if (!staffData.isActive) {
      return res.status(401).json({
        success: false,
        message: "Staff account is deactivated",
      });
    }

    // Generate a new JWT token using latest data
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

// PUT /profile - Update staff profile information
router.put("/profile", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { displayName, ...profileData } = req.body;

    const updateData = {
      updatedAt: new Date().toISOString(),
    };

    if (displayName !== undefined) {
      updateData.displayName = displayName;
    }

    if (Object.keys(profileData).length > 0) {
      updateData.profile = profileData;
    }

    await db.collection("staffs").doc(userId).set(updateData, { merge: true });

    res.status(200).json({
      success: true,
      message: "Staff profile updated successfully",
      data: {
        displayName: updateData.displayName,
        profile: updateData.profile,
      },
    });
  } catch (error) {
    console.error("Error updating staff profile:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during staff profile update",
      error: error.message,
    });
  }
});

// PUT /company - Update company information
router.put("/company", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { companyDisplayName, name, nature, address, contact, icon, coverPhotos, introduction, website } = req.body;

    // Get staff info to find companyId
    const staffDoc = await db.collection("staffs").doc(userId).get();
    if (!staffDoc.exists) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }
    
    const staffData = staffDoc.data();
    if (!staffData.companyId) {
      return res.status(400).json({ success: false, message: "No company associated with this staff" });
    }

    const companyRef = db.collection("companies").doc(staffData.companyId);
    
    // Update company
    const updateData = {
      updatedAt: new Date().toISOString()
    };
    if (companyDisplayName !== undefined) {
      updateData.companyDisplayName = companyDisplayName;
    }
    if (name !== undefined) updateData.name = name;
    if (nature !== undefined) updateData.nature = nature;
    if (address !== undefined) updateData.address = address;
    if (contact !== undefined) updateData.contact = contact;
    if (icon !== undefined) updateData.icon = icon;
    if (coverPhotos !== undefined) {
      updateData.coverPhotos = Array.isArray(coverPhotos)
        ? coverPhotos
            .filter((photo) => typeof photo === "string" && photo.trim())
            .slice(0, 5)
        : [];
    }
    if (introduction !== undefined) updateData.introduction = introduction;
    if (website !== undefined) updateData.website = website;

    await companyRef.update(updateData);

    res.status(200).json({
      success: true,
      message: "Company profile updated successfully",
      data: updateData
    });
  } catch (error) {
    console.error("Error updating company:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during company update",
      error: error.message,
    });
  }
});

module.exports = router;
