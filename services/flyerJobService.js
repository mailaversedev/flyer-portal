const admin = require("firebase-admin");

const db = admin.firestore();

const USER_PAGE_SIZE = 500;
const FCM_BATCH_SIZE = 500;
const NOTIFICATION_JOB_RETENTION_DAYS = 30;
const MAX_NOTIFICATION_JOB_ATTEMPTS = 3;
const FIRESTORE_IN_QUERY_SIZE = 30;

const FLYER_JOB_COLLECTION = "notificationJobs";
const FLYER_JOB_LEASE_MS = Math.max(
  60000,
  Number(process.env.FLYER_JOB_LEASE_MS) || 10 * 60 * 1000,
);
const FLYER_JOB_REWARD_CONCURRENCY = Math.max(
  1,
  Math.min(50, Number(process.env.FLYER_JOB_REWARD_CONCURRENCY) || 20),
);

function getCurrentIsoTimestamp() {
  return new Date().toISOString();
}

function getWorkerId() {
  return process.env.DYNO || `pid-${process.pid}`;
}

function shouldProcessFlyerJobsInline() {
  return (
    process.env.NOTIFICATION_JOB_INLINE_PROCESSING === "true" ||
    process.env.NODE_ENV !== "production"
  );
}

function getJobExpiryTimestamp() {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + NOTIFICATION_JOB_RETENTION_DAYS);
  return admin.firestore.Timestamp.fromDate(expiryDate);
}

function getJobLeaseExpiryTimestamp() {
  return admin.firestore.Timestamp.fromMillis(Date.now() + FLYER_JOB_LEASE_MS);
}

function getEventTitleByFlyerType(type) {
  switch (type) {
    case "query":
      return "New Survey Dropped!";
    case "qr":
      return "New Scan Event Dropped!";
    case "leaflet":
    default:
      return "New Flyer Dropped!";
  }
}

function chunkArray(items, size) {
  const chunks = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

async function getWalletRefsByUserIds(userIds) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const walletRefsByUserId = new Map();

  for (const userIdChunk of chunkArray(uniqueUserIds, FIRESTORE_IN_QUERY_SIZE)) {
    const walletSnapshot = await db
      .collection("wallets")
      .where("userId", "in", userIdChunk)
      .get();

    walletSnapshot.docs.forEach((walletDoc) => {
      const walletData = walletDoc.data();
      if (walletData?.userId && !walletRefsByUserId.has(walletData.userId)) {
        walletRefsByUserId.set(walletData.userId, walletDoc.ref);
      }
    });
  }

  return walletRefsByUserId;
}

function buildFlyerRewardTransactionId(jobId, userId) {
  return `flyer_job_reward_${jobId}_${userId}`;
}

async function applyFlyerRewardToUser({
  jobId,
  flyerId,
  flyerHeader,
  companyIcon,
  user,
  amountPerUser,
  walletRefsByUserId,
}) {
  const rewardTransactionId = buildFlyerRewardTransactionId(jobId, user.id);
  const rewardTransactionRef = db.collection("transactions").doc(rewardTransactionId);

  return db.runTransaction(async (transaction) => {
    const existingRewardTransaction = await transaction.get(rewardTransactionRef);
    if (existingRewardTransaction.exists) {
      return false;
    }

    let walletRef = walletRefsByUserId.get(user.id) || null;
    let walletSnapshot = null;

    if (walletRef) {
      walletSnapshot = await transaction.get(walletRef);
      if (!walletSnapshot.exists) {
        walletRef = null;
        walletSnapshot = null;
      }
    }

    if (!walletRef) {
      const walletQuerySnapshot = await transaction.get(
        db.collection("wallets").where("userId", "==", user.id).limit(1),
      );

      if (!walletQuerySnapshot.empty) {
        walletSnapshot = walletQuerySnapshot.docs[0];
        walletRef = walletSnapshot.ref;
        walletRefsByUserId.set(user.id, walletRef);
      }
    }

    const timestamp = getCurrentIsoTimestamp();
    let previousBalance = 0;
    let newBalance = amountPerUser;

    if (walletRef && walletSnapshot) {
      const walletData = walletSnapshot.data();
      previousBalance = Number(walletData?.balance) || 0;
      newBalance = previousBalance + amountPerUser;

      transaction.update(walletRef, {
        balance: newBalance,
        updatedAt: timestamp,
        version: (Number(walletData?.version) || 0) + 1,
      });
    } else {
      walletRef = db.collection("wallets").doc();
      walletRefsByUserId.set(user.id, walletRef);

      transaction.set(walletRef, {
        userId: user.id,
        username: user.username || "",
        balance: amountPerUser,
        currency: "TOKEN",
        createdAt: timestamp,
        updatedAt: timestamp,
        isActive: true,
        version: 1,
      });
    }

    transaction.create(rewardTransactionRef, {
      transactionId: rewardTransactionId,
      userId: user.id,
      walletId: walletRef.id,
      type: "ADD",
      amount: amountPerUser,
      previousBalance,
      newBalance,
      description: flyerHeader
        ? `New Flyer reward - ${flyerHeader}`
        : "New Flyer reward",
      status: "COMPLETED",
      idempotencyKey: rewardTransactionId,
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: {
        source: "flyer_job_reward",
        flyerId: flyerId || "",
        flyerJobId: jobId,
        companyIcon: companyIcon || null,
      },
    });

    return true;
  });
}

async function distributeRewardsToUsers({
  jobId,
  flyerId,
  flyerHeader,
  companyIcon,
  users,
  amountPerUser,
}) {
  if (!Array.isArray(users) || users.length === 0 || amountPerUser <= 0 || !jobId) {
    return;
  }

  const walletRefsByUserId = await getWalletRefsByUserIds(
    users.map((user) => user.id),
  );
  const rewardErrors = [];

  for (const userChunk of chunkArray(users, FLYER_JOB_REWARD_CONCURRENCY)) {
    const chunkResults = await Promise.allSettled(
      userChunk.map((user) =>
        applyFlyerRewardToUser({
          jobId,
          flyerId,
          flyerHeader,
          companyIcon,
          user,
          amountPerUser,
          walletRefsByUserId,
        }),
      ),
    );

    chunkResults.forEach((result) => {
      if (result.status === "rejected") {
        rewardErrors.push(result.reason);
      }
    });
  }

  if (rewardErrors.length > 0) {
    throw rewardErrors[0];
  }
}

async function removeInvalidTokenFromUsers(token, userIds) {
  if (!token || !Array.isArray(userIds) || userIds.length === 0) {
    return;
  }

  const timestamp = new Date().toISOString();
  const chunks = [];
  for (let i = 0; i < userIds.length; i += 450) {
    chunks.push(userIds.slice(i, i + 450));
  }

  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach((userId) => {
      const userRef = db.collection("users").doc(userId);
      batch.update(userRef, {
        fcmTokens: admin.firestore.FieldValue.arrayRemove(token),
        updatedAt: timestamp,
      });
    });
    await batch.commit();
  }
}

async function claimFlyerJob(jobRef) {
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(jobRef);
    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    const attempts = data.attempts || 0;
    const status = data.status;
    const leaseExpiresAt = data.leaseExpiresAt;
    const leaseExpired =
      leaseExpiresAt && typeof leaseExpiresAt.toMillis === "function"
        ? leaseExpiresAt.toMillis() <= Date.now()
        : false;

    if (
      !["queued", "failed"].includes(status) &&
      !(status === "processing" && leaseExpired)
    ) {
      return null;
    }

    if (attempts >= MAX_NOTIFICATION_JOB_ATTEMPTS) {
      return null;
    }

    const now = getCurrentIsoTimestamp();
    const nextLeaseExpiry = getJobLeaseExpiryTimestamp();
    transaction.update(jobRef, {
      status: "processing",
      startedAt: data.startedAt || now,
      claimedAt: now,
      lastHeartbeatAt: now,
      leaseExpiresAt: nextLeaseExpiry,
      workerId: getWorkerId(),
      updatedAt: now,
      attempts: attempts + 1,
      error: admin.firestore.FieldValue.delete(),
      completedAt: admin.firestore.FieldValue.delete(),
    });

    return {
      id: doc.id,
      ...data,
      attempts: attempts + 1,
      status: "processing",
      leaseExpiresAt: nextLeaseExpiry,
    };
  });
}

async function updateFlyerJobProgress(jobRef, progress = {}) {
  const now = getCurrentIsoTimestamp();

  await jobRef.update({
    ...progress,
    updatedAt: now,
    lastHeartbeatAt: now,
    leaseExpiresAt: getJobLeaseExpiryTimestamp(),
    workerId: getWorkerId(),
  });
}

async function markFlyerJobAsFailed(jobId, errorMessage) {
  await db
    .collection(FLYER_JOB_COLLECTION)
    .doc(jobId)
    .set(
      {
        status: "failed",
        error: errorMessage || "Unknown flyer job failure",
        updatedAt: getCurrentIsoTimestamp(),
        lastFailedAt: getCurrentIsoTimestamp(),
        expiresAt: getJobExpiryTimestamp(),
        leaseExpiresAt: admin.firestore.FieldValue.delete(),
        lastHeartbeatAt: admin.firestore.FieldValue.delete(),
        workerId: admin.firestore.FieldValue.delete(),
      },
      { merge: true },
    );
}

async function findNextQueuedFlyerJobId() {
  const queuedSnapshot = await db
    .collection(FLYER_JOB_COLLECTION)
    .where("status", "in", ["queued", "failed"])
    .orderBy("updatedAt", "asc")
    .limit(1)
    .get();

  if (!queuedSnapshot.empty) {
    return queuedSnapshot.docs[0].id;
  }

  const staleProcessingSnapshot = await db
    .collection(FLYER_JOB_COLLECTION)
    .where("leaseExpiresAt", "<=", admin.firestore.Timestamp.now())
    .orderBy("leaseExpiresAt", "asc")
    .limit(1)
    .get();

  if (!staleProcessingSnapshot.empty) {
    return staleProcessingSnapshot.docs[0].id;
  }

  return null;
}

async function processFlyerJob(jobId) {
  const jobRef = db.collection(FLYER_JOB_COLLECTION).doc(jobId);
  const claimedJob = await claimFlyerJob(jobRef);
  if (!claimedJob) {
    return false;
  }

  const job = claimedJob;
  const flyerId = job.flyerId || "";
  const flyerType = job.flyerType || "leaflet";
  const flyerHeader = job.flyerHeader || "";
  const companyIcon = job.companyIcon || null;
  const amountPerUser = job.amountPerUser || 0;

  const titlePrefix = getEventTitleByFlyerType(flyerType);
  const title = flyerHeader ? `${titlePrefix} ${flyerHeader}` : titlePrefix;

  let lastProcessedUserId = job.lastProcessedUserId || null;
  let usersScanned = job.usersScanned || 0;
  let tokensProcessed = job.tokensProcessed || 0;
  let successCount = job.successCount || 0;
  let failureCount = job.failureCount || 0;

  do {
    let usersQuery = db
      .collection("users")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(USER_PAGE_SIZE);
    if (lastProcessedUserId) {
      usersQuery = usersQuery.startAfter(lastProcessedUserId);
    }

    const usersSnapshot = await usersQuery.get();
    if (usersSnapshot.empty) {
      break;
    }

    usersScanned += usersSnapshot.size;

    const tokenToUserIds = new Map();
    const activeUserRewardTargets = [];

    usersSnapshot.docs.forEach((userDoc) => {
      const userData = userDoc.data();

      if (userData.isActive === true && amountPerUser > 0) {
        activeUserRewardTargets.push({
          id: userDoc.id,
          username: userData.username,
        });
      }

      const fcmTokens = Array.isArray(userData.fcmTokens)
        ? userData.fcmTokens
        : [];

      fcmTokens.forEach((token) => {
        if (!token || typeof token !== "string") {
          return;
        }

        const normalizedToken = token.trim();
        if (!normalizedToken) {
          return;
        }

        if (!tokenToUserIds.has(normalizedToken)) {
          tokenToUserIds.set(normalizedToken, []);
        }
        tokenToUserIds.get(normalizedToken).push(userDoc.id);
      });
    });

    const tokens = Array.from(tokenToUserIds.keys());
    tokensProcessed += tokens.length;

    for (let i = 0; i < tokens.length; i += FCM_BATCH_SIZE) {
      const tokenChunk = tokens.slice(i, i + FCM_BATCH_SIZE);
      if (tokenChunk.length === 0) {
        continue;
      }

      const message = {
        notification: {
          title,
          body: "Open Mailaverse to view latest event",
        },
        data: {
          type: flyerType,
          flyerId,
          event: "new_flyer",
        },
        tokens: tokenChunk,
      };

      const batchResponse =
        await admin.messaging().sendEachForMulticast(message);

      successCount += batchResponse.successCount;
      failureCount += batchResponse.failureCount;

      const invalidTokens = [];
      batchResponse.responses.forEach((sendResponse, idx) => {
        if (sendResponse.success) {
          return;
        }

        const errorCode = sendResponse.error?.code;
        if (
          errorCode === "messaging/registration-token-not-registered" ||
          errorCode === "messaging/invalid-registration-token"
        ) {
          invalidTokens.push(tokenChunk[idx]);
        }
      });

      for (const invalidToken of invalidTokens) {
        const userIds = tokenToUserIds.get(invalidToken) || [];
        await removeInvalidTokenFromUsers(invalidToken, userIds);
      }
    }

    if (activeUserRewardTargets.length > 0 && amountPerUser > 0) {
      try {
        await distributeRewardsToUsers({
          jobId,
          flyerId,
          flyerHeader,
          companyIcon,
          users: activeUserRewardTargets,
          amountPerUser,
        });
      } catch (rewardError) {
        console.error("Failed to distribute flyer job rewards:", rewardError);
        throw rewardError;
      }
    }

    lastProcessedUserId = usersSnapshot.docs[usersSnapshot.docs.length - 1]?.id || null;

    await updateFlyerJobProgress(jobRef, {
      status: "processing",
      usersScanned,
      tokensProcessed,
      successCount,
      failureCount,
      lastProcessedUserId,
    });

    if (usersSnapshot.size < USER_PAGE_SIZE) {
      break;
    }
  } while (true);

  await jobRef.update({
    status: "completed",
    usersScanned,
    tokensProcessed,
    successCount,
    failureCount,
    completedAt: getCurrentIsoTimestamp(),
    updatedAt: getCurrentIsoTimestamp(),
    expiresAt: getJobExpiryTimestamp(),
    leaseExpiresAt: admin.firestore.FieldValue.delete(),
    lastHeartbeatAt: admin.firestore.FieldValue.delete(),
    workerId: admin.firestore.FieldValue.delete(),
  });

  return true;
}

async function scheduleFlyerJob({
  flyerId,
  flyerType,
  flyerHeader,
  companyIcon,
  amountPerUser,
}) {
  const createdAt = getCurrentIsoTimestamp();
  const jobRef = db.collection(FLYER_JOB_COLLECTION).doc();

  await jobRef.set({
    type: "flyer_created",
    status: "queued",
    flyerId,
    flyerType,
    flyerHeader: flyerHeader || "",
    companyIcon: companyIcon || null,
    amountPerUser: amountPerUser || 0,
    usersScanned: 0,
    tokensProcessed: 0,
    successCount: 0,
    failureCount: 0,
    attempts: 0,
    lastProcessedUserId: null,
    expiresAt: getJobExpiryTimestamp(),
    createdAt,
    updatedAt: createdAt,
  });

  if (shouldProcessFlyerJobsInline()) {
    setImmediate(() => {
      processFlyerJob(jobRef.id).catch(async (error) => {
        console.error("Error processing flyer job:", error);
        try {
          await markFlyerJobAsFailed(
            jobRef.id,
            error.message || "Unknown flyer job failure",
          );
        } catch (updateErr) {
          console.error("Failed to update flyer job status:", updateErr);
        }
      });

      cleanupExpiredFlyerJobs(200).catch((cleanupError) => {
        console.error("Error cleaning expired flyer jobs:", cleanupError);
      });
    });
  }

  return jobRef.id;
}

async function processQueuedFlyerJobs(maxJobs = 3) {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  while (processed < maxJobs) {
    const nextJobId = await findNextQueuedFlyerJobId();
    if (!nextJobId) {
      break;
    }

    try {
      const didProcess = await processFlyerJob(nextJobId);
      if (!didProcess) {
        continue;
      }

      processed += 1;
      succeeded += 1;
    } catch (error) {
      processed += 1;
      failed += 1;
      console.error("Queued flyer job failed:", error);

      await markFlyerJobAsFailed(
        nextJobId,
        error.message || "Unknown flyer job worker failure",
      );
    }
  }

  return { processed, succeeded, failed };
}

async function cleanupExpiredFlyerJobs(maxDelete = 500) {
  const nowTs = admin.firestore.Timestamp.now();
  const snapshot = await db
    .collection(FLYER_JOB_COLLECTION)
    .where("expiresAt", "<=", nowTs)
    .limit(maxDelete)
    .get();

  if (snapshot.empty) {
    return { deleted: 0 };
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  return { deleted: snapshot.size };
}

module.exports = {
  processQueuedFlyerJobs,
  cleanupExpiredFlyerJobs,
  scheduleFlyerJob,
};