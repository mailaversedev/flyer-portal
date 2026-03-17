const express = require("express");
const admin = require("firebase-admin");

const { authenticateToken } = require("./auth");
const { calculateLotteryMetricsFromHkd } = require("../config/lotteryConfig");
const {
  processQueuedFlyerJobs,
  cleanupExpiredFlyerJobs,
  scheduleFlyerJob,
} = require("../services/flyerJobService");

const router = express.Router();
const db = admin.firestore();

async function processFlyerJobsHandler(req, res) {
  try {
    const secret = req.header("x-job-secret");
    const expectedSecret = process.env.NOTIFICATION_JOB_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized worker request",
      });
    }

    const maxJobs = Math.max(1, Math.min(20, Number(req.body?.maxJobs) || 3));
    const [processResult, cleanupResult] = await Promise.all([
      processQueuedFlyerJobs(maxJobs),
      cleanupExpiredFlyerJobs(500),
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...processResult,
        deletedExpired: cleanupResult.deleted,
      },
    });
  } catch (error) {
    console.error("Error running flyer job worker:", error);
    res.status(500).json({
      success: false,
      message: "Failed to run flyer job worker",
      error: error.message,
    });
  }
}

router.post("/flyer-jobs/process", processFlyerJobsHandler);
router.post("/notification-jobs/process", processFlyerJobsHandler);

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
        const companyDoc = await db
          .collection("companies")
          .doc(flyerData.companyId)
          .get();
        if (companyDoc.exists) {
          const companyInfo = companyDoc.data();
          flyerData.companyIcon = companyInfo.icon;
          flyerData.companyName = companyInfo.name;
          flyerData.companyNature = companyInfo.nature;
        }
      }
    } catch (error) {
      console.warn(
        "Failed to fetch company info during flyer creation:",
        error,
      );
      // Continue without it, don't fail the whole creation
    }

    // 2. Prepare Lottery Data
    const poolHkd = data?.targetBudget?.budget || 5000;
    const {
      pool,
      spreadingCoefficient,
      mailcoinHkdRate,
      lotteryFactor,
      eventCostPercent,
      eventUsagePercent,
      userReached,
      finalPool,
      maxUsers,
      eventMoney,
      lotteryMoney,
    } = calculateLotteryMetricsFromHkd(poolHkd);

    flyerData.lottery = {
      lotteryMoney,
      maxUsers,
      userReached,
      remaining: lotteryMoney,
      claims: 0,
      unit: "mailcoin",
      mailcoinHkdRate,
    };

    const lotteryEvent = {
      pool,
      spreadingCoefficient,
      lotteryFactor,
      eventCostPercent,
      eventUsagePercent,
      userReached,
      finalPool,
      maxUsers,
      eventMoney,
      lotteryMoney,
      claims: 0,
      remaining: lotteryMoney,
      unit: "mailcoin",
      mailcoinHkdRate,
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
            totalClaimCount: admin.firestore.FieldValue.increment(maxUsers),
            totalEventMoney: admin.firestore.FieldValue.increment(finalPool),
            updatedAt: new Date().toISOString(),
          });
        } else {
          transaction.set(statsRef, {
            year: statsYear,
            month: statsMonth,
            flyerCount: 1,
            totalClaimCount: maxUsers,
            totalEventMoney: finalPool,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    });

    // 5. Calculate distribution amount correctly using count() to avoid fetching all documents.
    // The actual wallet distribution will now happen asynchronously in the flyer job background worker.
    const distributionAmount = Math.max(
      0,
      Math.floor(pool * eventUsagePercent * eventCostPercent),
    );

    let amountPerUser = 0;
    if (distributionAmount > 0) {
      const countSnapshot = await db
        .collection("users")
        .where("isActive", "==", true)
        .count()
        .get();
      
      const activeUsersCount = countSnapshot.data().count;
      if (activeUsersCount > 0) {
        amountPerUser = Math.floor(distributionAmount / activeUsersCount);
      }
    }

    const response = {
      success: true,
      flyerId: flyerRef.id,
      type: type,
      message: `${type} flyer created successfully`,
      data: flyerData,
    };

    res.status(201).json(response);

    scheduleFlyerJob({
      flyerId: flyerRef.id,
      flyerType: type,
      flyerHeader: flyerData.header || "",
      amountPerUser: amountPerUser,
    }).catch((flyerJobError) => {
      console.error("Failed to schedule flyer job:", flyerJobError);
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create flyer",
      error: error.message,
    });
  }
});

// GET /api/flyer/:flyerId - Get single flyer by ID
router.get("/flyer/:flyerId", async (req, res) => {
  try {
    const { flyerId } = req.params;

    if (!flyerId) {
      return res.status(400).json({
        success: false,
        message: "Missing flyerId",
      });
    }

    const flyerDoc = await db.collection("flyers").doc(flyerId).get();
    if (!flyerDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Flyer not found",
      });
    }

    const flyer = {
      id: flyerDoc.id,
      ...flyerDoc.data(),
    };

    try {
      const lotteryDoc = await db.collection("lottery").doc(flyerId).get();
      if (lotteryDoc.exists) {
        flyer.lottery = lotteryDoc.data();
      }
    } catch (lotteryError) {
      console.warn("Error fetching lottery metadata for single flyer:", lotteryError);
    }

    res.status(200).json({
      success: true,
      data: flyer,
    });
  } catch (error) {
    console.error("Error fetching flyer by ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch flyer",
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
          ", ",
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
          db.collection("lottery").doc(flyer.id),
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

// POST /api/flyer/:flyerId/answers - Submit survey answers
router.post("/flyer/:flyerId/answers", authenticateToken, async (req, res) => {
  try {
    const { flyerId } = req.params;
    const { answers } = req.body;

    if (!flyerId || !answers) {
      return res.status(400).json({
        success: false,
        message: "Missing flyerId or answers",
      });
    }

    const answerRef = db
      .collection("flyers")
      .doc(flyerId)
      .collection("answers")
      .doc(req.user.userId);

    const timestamp = new Date().toISOString();
    const answerData = {
      flyerId,
      userId: req.user.userId,
      answers,
      updatedAt: timestamp,
    };

    const doc = await answerRef.get();

    if (doc.exists) {
      await answerRef.update(answerData);
    } else {
      answerData.createdAt = timestamp;
      await answerRef.set(answerData);
    }

    res.status(200).json({
      success: true,
      message: "Survey answers submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting survey answers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit survey answers",
      error: error.message,
    });
  }
});

// GET /api/flyer/:flyerId/answer-status - Check if user submitted answer
router.get("/flyer/:flyerId/answer-status", authenticateToken, async (req, res) => {
  try {
    const { flyerId } = req.params;
    const userId = req.user.userId;

    if (!flyerId) {
      return res.status(400).json({
        success: false,
        message: "Missing flyerId",
      });
    }

    const answerDoc = await db
      .collection("flyers")
      .doc(flyerId)
      .collection("answers")
      .doc(userId)
      .get();

    if (answerDoc.exists) {
      res.status(200).json({
        success: true,
        submitted: true,
        data: answerDoc.data(),
      });
    } else {
      res.status(200).json({
        success: true,
        submitted: false,
      });
    }
  } catch (error) {
    console.error("Error checking answer status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check answer status",
      error: error.message,
    });
  }
});

module.exports = router;
