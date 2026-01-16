const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();

// GET /api/lottery - Lottery endpoint (idempotent per user, fluctuating reward, pool depletion)
// Requires ?flyerId=xxx as query params. userId is extracted from the token.
router.get("/", async (req, res) => {
  try {
    const userId = req.user.userId;
    const flyerId = req.query.flyerId;
    if (!flyerId) {
      return res
        .status(400)
        .json({ success: false, message: "flyerId is required" });
    }

    // Retrieve flyer for event/lottery parameters
    const flyerDoc = await db.collection("flyers").doc(flyerId).get();
    if (!flyerDoc.exists) {
      return res
        .status(404)
        .json({ success: false, message: "Flyer not found" });
    }

    const flyer = flyerDoc.data();
    // Use flyer fields or fallback to defaults
    const pool = flyer.targetBudget.budget || 5000;
    const lotteryFactor = 20;
    const spreadingCoefficient = 0.6;
    const eventCostPercent = 0.2;
    const eventUsagePercent = 0.8;

    // Step 1: Calculate final pool after spreading
    const finalPool = pool / spreadingCoefficient;
    // Step 2: Max number of users to get the lottery
    const maxUsers = Math.floor(finalPool / lotteryFactor);
    // Step 3: 80% of original pool used for event, 20% as cost
    const eventMoney = pool * (1 - eventCostPercent);
    // Step 4: 80% of event money used for lottery
    const lotteryMoney = eventMoney * eventUsagePercent;
    // Step 5: Average money per user
    const avgMoneyPerUser = lotteryMoney / maxUsers;

    // --- Firestore collections ---
    const lotteryStateRef = db.collection("lottery").doc(flyerId);
    const userClaimsRef = db
      .collection("lottery")
      .doc(flyerId)
      .collection("claims")
      .doc(userId);

    // Find user's wallet
    const walletQuery = await db
      .collection("wallets")
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (walletQuery.empty) {
      return res.status(404).json({
        success: false,
        message: "User wallet not found",
      });
    }
    const walletRef = walletQuery.docs[0].ref;

    // --- Transaction for idempotency and atomicity ---
    await db.runTransaction(async (transaction) => {
      // 1. Check if user already claimed
      const userClaimDoc = await transaction.get(userClaimsRef);
      if (userClaimDoc.exists) {
        // Already claimed, return previous result
        const data = userClaimDoc.data();
        res.status(200).json({
          success: true,
          message: "Already claimed",
          ...data,
          avgMoneyPerUser,
          maxUsers,
        });
        throw new Error("__ALREADY_CLAIMED__"); // abort transaction
      }

      // 2. Get or initialize lottery state
      let lotteryStateDoc = await transaction.get(lotteryStateRef);
      let state;
      if (!lotteryStateDoc.exists) {
        // First claim, initialize state
        state = {
          pool,
          lotteryMoney,
          maxUsers,
          claims: 0,
          remaining: lotteryMoney,
        };
        // We must perform the write later, after all reads
      } else {
        state = lotteryStateDoc.data();
      }

      // 3. Check if pool is depleted or max users reached
      if (state.claims >= state.maxUsers || state.remaining <= 0) {
        res.status(200).json({
          success: false,
          message: "All lottery rewards have been claimed",
          avgMoneyPerUser,
          maxUsers,
        });
        throw new Error("__POOL_DEPLETED__");
      }

      // 7. Get user wallet (READ)
      const walletDoc = await transaction.get(walletRef);

      // 8. Get Company Statistics (READ)
      let statsRef;
      let statsDoc;
      if (flyer.companyId) {
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 1-12
        const statsDocId = `${year}-${String(month).padStart(2, "0")}`;

        statsRef = db
          .collection("companies")
          .doc(flyer.companyId)
          .collection("statistics")
          .doc(statsDocId);

        statsDoc = await transaction.get(statsRef);
      }

      // --- ALL READS COMPLETE, START WRITES ---

      // 2b. Initialize lottery state if needed (WRITE)
      if (!lotteryStateDoc.exists) {
        transaction.set(lotteryStateRef, state);
      }

      // 4. Calculate reward for this user
      let reward;
      if (state.claims === state.maxUsers - 1) {
        // Last user gets all remaining
        reward = state.remaining;
      } else {
        // Fluctuate +-50% of avgMoneyPerUser, but not more than remaining
        const min = Math.max(0, avgMoneyPerUser * 0.5);
        const max = Math.min(state.remaining, avgMoneyPerUser * 1.5);
        reward = Math.random() * (max - min) + min;
        reward = Math.floor(reward * 100) / 100; // round to 2 decimals
        // Don't let reward exceed remaining for last user
        if (reward > state.remaining) reward = state.remaining;
      }

      // 5. Update state (WRITE)
      const newClaims = state.claims + 1;
      const newRemaining = Math.max(0, state.remaining - reward);
      transaction.update(lotteryStateRef, {
        claims: newClaims,
        remaining: newRemaining,
      });

      // 6. Record user claim (WRITE)
      const claimData = {
        userId,
        flyerId,
        reward,
        claimedAt: new Date().toISOString(),
        claimNumber: newClaims,
        avgMoneyPerUser,
        maxUsers,
        remainingAfter: newRemaining,
      };
      transaction.set(userClaimsRef, claimData);

      // 7b. Update user wallet (WRITE)
      if (walletDoc.exists) {
        const currentBalance = walletDoc.data().balance || 0;
        transaction.update(walletRef, {
          balance: currentBalance + reward,
          updatedAt: new Date().toISOString(),
        });
      }

      // 8b. Update Company Statistics (WRITE)
      if (flyer.companyId && statsRef) {
        if (statsDoc.exists) {
          transaction.update(statsRef, {
            claimCount: admin.firestore.FieldValue.increment(1),
            totalReward: admin.firestore.FieldValue.increment(reward),
            updatedAt: new Date().toISOString(),
          });
        } else {
          const date = new Date();
          transaction.set(statsRef, {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            claimCount: 1,
            totalReward: reward,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // 9. Respond
      res.status(200).json({
        success: true,
        ...claimData,
      });
    });
  } catch (error) {
    if (
      error.message === "__ALREADY_CLAIMED__" ||
      error.message === "__POOL_DEPLETED__"
    ) {
      // Response already sent
      return;
    }
    console.error("Lottery error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
