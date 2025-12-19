const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();

const spreadingCoefficient = 0.6;
const lotteryFactor = 20;

// POST /api/flyer - Create flyer (leaflet, query, or qr code)
router.post("/flyer", async (req, res) => {
  try {
    const { type, data } = req.body;

    // Placeholder response - replace with actual implementation
    const flyerData = {
      type,
      ...data,
      createdAt: new Date().toISOString(),
      status: "active",
    };

    // Save flyerData to Firestore and get the flyer doc id
    const flyerRef = await db.collection("flyers").add(flyerData);

    // Create a lottery event for this flyer (doc id = flyer doc id)
    // Use same lottery parameters as in /api/lottery
    const pool = 5000;
    const eventCostPercent = 0.2;
    const eventUsagePercent = 0.8;
    const finalPool = pool / spreadingCoefficient;
    const maxUsers = Math.floor(finalPool / lotteryFactor);
    const eventMoney = pool * (1 - eventCostPercent);
    const lotteryMoney = eventMoney * eventUsagePercent;

    const lotteryEvent = {
      pool,
      spreadingCoefficient,
      lotteryFactor,
      eventCostPercent,
      eventUsagePercent,
      finalPool,
      maxUsers,
      eventMoney,
      lotteryMoney,
      claims: 0,
      remaining: lotteryMoney,
      flyerId: flyerRef.id,
      createdAt: new Date().toISOString(),
      status: "active",
    };
    await db.collection("lottery").doc(flyerRef.id).set(lotteryEvent);

    // Distribute 20% of pool to all active users
    const distributionAmount = pool * eventCostPercent;
    const usersSnapshot = await db
      .collection("users")
      .where("isActive", "==", true)
      .get();

    if (!usersSnapshot.empty) {
      const activeUsersCount = usersSnapshot.size;
      const amountPerUser = distributionAmount / activeUsersCount;
      const timestamp = new Date().toISOString();

      const updates = usersSnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data();
        const userId = userDoc.id;

        const walletQuery = await db
          .collection("wallets")
          .where("userId", "==", userId)
          .limit(1)
          .get();

        if (!walletQuery.empty) {
          const walletDoc = walletQuery.docs[0];
          const currentBalance = walletDoc.data().balance || 0;
          await walletDoc.ref.update({
            balance: currentBalance + amountPerUser,
            updatedAt: timestamp,
          });
        } else {
          await db.collection("wallets").add({
            userId: userId,
            username: userData.username,
            balance: amountPerUser,
            currency: "TOKEN",
            createdAt: timestamp,
            updatedAt: timestamp,
            isActive: true,
            version: 1,
          });
        }
      });

      await Promise.all(updates);
    }

    const response = {
      success: true,
      flyerId: flyerRef.id,
      type: type,
      message: `${type} flyer created successfully`,
      data: flyerData,
    };

    res.status(201).json(response);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create flyer",
      error: error.message,
    });
  }
});

// GET /api/flyers - Get all flyers with pagination and sorting
router.get("/flyers", async (req, res) => {
  try {
    const {
      limit = "100",
      after,
      sortBy = "createdAt",
      direction = "desc",
    } = req.query;

    // Convert limit to number and validate
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 1000) {
      return res.status(400).json({
        success: false,
        message: "Invalid limit. Must be a number between 1 and 1000.",
      });
    }

    // Validate direction
    if (!["asc", "desc"].includes(direction.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid direction. Must be "asc" or "desc".',
      });
    }

    // Valid sortBy fields
    const validSortFields = ["createdAt", "updatedAt", "type", "status"];
    if (!validSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sortBy field. Must be one of: ${validSortFields.join(
          ", "
        )}.`,
      });
    }

    let query = db.collection("flyers");

    // Apply sorting
    query = query.orderBy(sortBy, direction.toLowerCase());

    // Apply cursor-based pagination if 'after' is provided
    if (after) {
      try {
        const afterDoc = await db.collection("flyers").doc(after).get();
        if (!afterDoc.exists) {
          return res.status(400).json({
            success: false,
            message: "Invalid cursor. Document not found.",
          });
        }
        query = query.startAfter(afterDoc);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid cursor format.",
        });
      }
    }

    // Apply limit
    query = query.limit(limitNum);

    // Execute query
    const snapshot = await query.get();

    const flyers = [];
    snapshot.forEach((doc) => {
      flyers.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Get the last document for next cursor (if there are results)
    let nextCursor = null;
    if (flyers.length === limitNum && flyers.length > 0) {
      nextCursor = flyers[flyers.length - 1].id;
    }

    const response = {
      success: true,
      data: flyers,
      pagination: {
        nextCursor: nextCursor,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching flyers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch flyers",
      error: error.message,
    });
  }
});

module.exports = router;
