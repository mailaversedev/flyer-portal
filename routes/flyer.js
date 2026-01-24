const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();
const { authenticateToken } = require("./auth");

const spreadingCoefficient = 0.6;
const lotteryFactor = 20;

// POST /api/flyer - Create flyer (leaflet, query, or qr code)
router.post("/flyer", authenticateToken, async (req, res) => {
  try {
    const { type, data } = req.body;

    // 1. Prepare Flyer Data
    // Generate ID first so we can use it in the transaction
    const flyerRef = db.collection("flyers").doc();
    const flyerData = {
      type,
      ...data,
      createdAt: new Date().toISOString(),
      status: "active",
    };
    flyerData.companyId = req.user.companyId;

    // Fetch company info to embed in flyer (denormalization)
    try {
      if (flyerData.companyId) {
        const companyDoc = await db.collection("companies").doc(flyerData.companyId).get();
        if (companyDoc.exists) {
          const companyInfo = companyDoc.data();
          flyerData.companyIcon = companyInfo.icon;
          flyerData.companyName = companyInfo.name;
        }
      }
    } catch (error) {
       console.warn("Failed to fetch company info during flyer creation:", error);
       // Continue without it, don't fail the whole creation
    }

    // 2. Prepare Lottery Data
    const pool = data.targetBudget.budget;
    const eventCostPercent = 0.2;
    const eventUsagePercent = 0.8;
    const finalPool = pool / spreadingCoefficient;
    const maxUsers = Math.floor(finalPool / lotteryFactor);
    const eventMoney = pool * (1 - eventCostPercent);
    const lotteryMoney = eventMoney * eventUsagePercent;

    flyerData.lotteryMoney = lotteryMoney;
    flyerData.maxUsers = maxUsers;

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
      createdAt: new Date().toISOString(),
      status: "active",
    };

    // 3. Prepare Stats Data (if applicable)
    let statsRef = null;
    let statsYear = null;
    let statsMonth = null;

    if (flyerData.companyId) {
      const date = new Date();
      statsYear = date.getFullYear();
      statsMonth = date.getMonth() + 1;
      const statsDocId = `${statsYear}-${String(statsMonth).padStart(2, "0")}`;

      statsRef = db
        .collection("companies")
        .doc(flyerData.companyId)
        .collection("statistics")
        .doc(statsDocId);
    }

    // 4. Execute Core Transaction (Flyer + Lottery + Stats)
    await db.runTransaction(async (transaction) => {
      // Reads must come before writes
      let statsDoc = null;
      if (statsRef) {
        statsDoc = await transaction.get(statsRef);
      }

      // Create Flyer
      transaction.set(flyerRef, flyerData);

      // Create Lottery Event
      const lotteryRef = db.collection("lottery").doc(flyerRef.id);
      transaction.set(lotteryRef, lotteryEvent);

      // Update Stats (if applicable)
      if (statsRef) {
        if (statsDoc && statsDoc.exists) {
          transaction.update(statsRef, {
            flyerCount: admin.firestore.FieldValue.increment(1),
            totalMaxUsers: admin.firestore.FieldValue.increment(maxUsers),
            totalEventMoney: admin.firestore.FieldValue.increment(finalPool),
            updatedAt: new Date().toISOString(),
          });
        } else {
          transaction.set(statsRef, {
            year: statsYear,
            month: statsMonth,
            flyerCount: 1,
            totalMaxUsers: maxUsers,
            totalEventMoney: finalPool,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    });

    // 5. Distribute 20% of pool to all active users
    // Note: This is kept outside the transaction to avoid hitting Firestore operation limits (500 ops)
    // as the user base grows. It runs only if the transaction above succeeds.
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
      companyId,
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

    if (companyId) {
      query = query.where("companyId", "==", companyId);
    }

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

    // Fetch related lottery metadata
    if (flyers.length > 0) {
      try {
        const lotteryRefs = flyers.map((flyer) =>
          db.collection("lottery").doc(flyer.id)
        );
        const lotterySnapshots = await db.getAll(...lotteryRefs);

        lotterySnapshots.forEach((lotteryDoc, index) => {
          if (lotteryDoc.exists) {
            flyers[index].lottery = lotteryDoc.data();
          }
        });
      } catch (err) {
        console.warn("Error fetching lottery metadata:", err);
        // gracefully continue without lottery data
      }
    }

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
