const { calculateLotteryMetricsFromHkd } = require("../config/lotteryConfig");
const { createHash } = require("crypto");

const MIN_EVENT_BUDGET = 100;
const MAX_EVENT_BUDGET = 50000;

function prepareEventReward(budget, industry) {
  if (typeof budget !== "number" || !Number.isSafeInteger(budget) ||
      budget < MIN_EVENT_BUDGET || budget > MAX_EVENT_BUDGET) {
    throw new Error("Event budget must be a whole number between HK$100 and HK$50,000");
  }
  const metrics = calculateLotteryMetricsFromHkd(budget, industry);
  if (metrics.lotteryMoney < 1) throw new Error("Event reward pool must be positive");
  return {
    budget,
    pool: {
      ...metrics,
      remaining: metrics.lotteryMoney,
      claims: 0,
      unit: "mailcoin",
      status: "active",
    },
  };
}

async function awardEventCheckin({ db, tx, eventRef, event, application, timestamp }) {
  const poolRef = db.collection("lottery").doc(eventRef.id);
  const claimRef = poolRef.collection("claims").doc(application.userId);
  const walletQuery = db.collection("wallets").where("userId", "==", application.userId).limit(1);
  const [poolDoc, claimDoc, wallets] = await Promise.all([
    tx.get(poolRef), tx.get(claimRef), tx.get(walletQuery),
  ]);
  if (claimDoc.exists) throw new Error("Event reward claim already exists without confirmed attendance");
  if (!poolDoc.exists) throw new Error("Event reward pool not found");
  const pool = poolDoc.data();
  if (!Number.isSafeInteger(pool.remaining) || pool.remaining < 0 ||
      !Number.isSafeInteger(pool.claims) || pool.claims < 0 ||
      !Number.isSafeInteger(pool.maxUsers) || pool.maxUsers < 1 ||
      !Number.isSafeInteger(pool.lotteryMoney) || pool.lotteryMoney < 1 ||
      pool.remaining > pool.lotteryMoney || pool.claims > pool.maxUsers) {
    throw new Error("Invalid event reward pool");
  }
  if (pool.remaining === 0 || pool.claims >= pool.maxUsers) {
    return { rewardStatus: "exhausted", reward: 0 };
  }
  const reward = pool.claims === pool.maxUsers - 1
    ? pool.remaining
    : Math.min(pool.remaining, Math.max(1, Math.floor(pool.lotteryMoney / pool.maxUsers)));
  const walletDoc = wallets.empty ? null : wallets.docs[0];
  const walletRef = walletDoc ? walletDoc.ref : db.collection("wallets").doc();
  const previousBalance = walletDoc ? walletDoc.data().balance : 0;
  if (typeof previousBalance !== "number" || !Number.isFinite(previousBalance) || previousBalance < 0) {
    throw new Error("Invalid user wallet balance");
  }
  const newBalance = previousBalance + reward;
  if (!Number.isFinite(newBalance)) throw new Error("Invalid resulting wallet balance");
  const transactionId = `event_checkin_${createHash("sha256").update(JSON.stringify([eventRef.id, application.userId])).digest("hex")}`;
  const transactionRef = db.collection("transactions").doc(transactionId);
  const updatedPool = { remaining: pool.remaining - reward, claims: pool.claims + 1 };
  if (walletDoc) {
    tx.update(walletRef, { balance: newBalance, updatedAt: timestamp, version: (Number(walletDoc.data().version) || 0) + 1 });
  } else {
    tx.create(walletRef, { userId: application.userId, username: application.username || "", balance: reward, currency: "TOKEN", isActive: true, version: 1, createdAt: timestamp, updatedAt: timestamp });
  }
  tx.update(poolRef, updatedPool);
  tx.create(claimRef, { userId: application.userId, flyerId: eventRef.id, reward, claimedAt: timestamp, unit: "mailcoin", source: "event_checkin" });
  tx.create(transactionRef, {
    transactionId, userId: application.userId, walletId: walletRef.id, type: "ADD", amount: reward,
    previousBalance, newBalance, description: event.header || "Event check-in reward",
    status: "COMPLETED", idempotencyKey: transactionId, createdAt: timestamp, updatedAt: timestamp,
    metadata: { source: "event_checkin", flyerId: eventRef.id, companyIcon: event.companyIcon || null },
  });
  tx.update(eventRef, { "lottery.remaining": updatedPool.remaining, "lottery.claims": updatedPool.claims });
  return { rewardStatus: "paid", reward };
}

module.exports = { prepareEventReward, awardEventCheckin };
