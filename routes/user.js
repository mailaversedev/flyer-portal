const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();

// GET /profile - Get user profile
router.get("/profile", async (req, res) => {
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

// DELETE /delete - Delete user account and all related data
router.delete("/delete", async (req, res) => {
  try {
    const userId = req.user.userId;
    const batchSize = 500;

    // Helper function to delete documents in batches
    const deleteQueryBatch = async (query, resolve) => {
      const snapshot = await query.limit(batchSize).get();

      if (snapshot.empty) {
        // When there are no documents left, we are done
        resolve();
        return;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // Recurse on the next process tick, to avoid stack overflow
      process.nextTick(() => {
        deleteQueryBatch(query, resolve);
      });
    };

    // 1. Delete User Document
    await db.collection("users").doc(userId).delete();

    // 2. Delete Wallet
    const walletQuery = db.collection("wallets").where("userId", "==", userId);
    await new Promise((resolve, reject) => {
      deleteQueryBatch(walletQuery, resolve).catch(reject);
    });

    // 3. Delete Transactions
    const transactionsQuery = db.collection("transactions").where("userId", "==", userId);
    await new Promise((resolve, reject) => {
      deleteQueryBatch(transactionsQuery, resolve).catch(reject);
    });

    // 4. Delete Flyers (if any created by user)
    const flyersQuery = db.collection("flyers").where("userId", "==", userId);
    await new Promise((resolve, reject) => {
      deleteQueryBatch(flyersQuery, resolve).catch(reject);
    });

    // 5. Delete Claims (Collection Group)
    // Note: This requires a composite index on claims collection for userId
    const claimsQuery = db.collectionGroup("claims").where("userId", "==", userId);
    await new Promise((resolve, reject) => {
      deleteQueryBatch(claimsQuery, resolve).catch(reject);
    });

    res.status(200).json({
      success: true,
      message: "User account and related data deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user account:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during account deletion",
      error: error.message,
    });
  }
});

// POST /device-token - Register a device token for push notifications
router.post("/device-token", async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.userId;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Device token is required",
      });
    }

    // Add token to user's fcmTokens array
    await db.collection("users").doc(userId).update({
      fcmTokens: admin.firestore.FieldValue.arrayUnion(token),
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: "Device token registered successfully",
    });
  } catch (error) {
    console.error("Error registering device token:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
