const admin = require("firebase-admin");

const db = admin.firestore();

const USER_PAGE_SIZE = 500;
const FCM_BATCH_SIZE = 500;
const NOTIFICATION_JOB_RETENTION_DAYS = 30;
const MAX_NOTIFICATION_JOB_ATTEMPTS = 3;
const FIRESTORE_IN_QUERY_SIZE = 30;
const FIRESTORE_BATCH_WRITE_SIZE = 400;

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

async function distributeRewardsToUsers(users, amountPerUser) {
  if (!Array.isArray(users) || users.length === 0 || amountPerUser <= 0) {
    return;
  }

  const timestamp = new Date().toISOString();
  const walletRefsByUserId = await getWalletRefsByUserIds(
    users.map((user) => user.id),
  );

  for (const userChunk of chunkArray(users, FIRESTORE_BATCH_WRITE_SIZE)) {
    const batch = db.batch();

    userChunk.forEach((user) => {
      const walletRef = walletRefsByUserId.get(user.id);

      if (walletRef) {
        batch.update(walletRef, {
          balance: admin.firestore.FieldValue.increment(amountPerUser),
          updatedAt: timestamp,
        });
        return;
      }

      const newWalletRef = db.collection("wallets").doc();
      batch.set(newWalletRef, {
        userId: user.id,
        username: user.username || "",
        balance: amountPerUser,
        currency: "TOKEN",
        createdAt: timestamp,
        updatedAt: timestamp,
        isActive: true,
        version: 1,
      });
    });

    await batch.commit();
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

    if (!["queued", "failed"].includes(status)) {
      return null;
    }

    if (attempts >= MAX_NOTIFICATION_JOB_ATTEMPTS) {
      return null;
    }

    const now = new Date().toISOString();
    transaction.update(jobRef, {
      status: "processing",
      startedAt: now,
      updatedAt: now,
      attempts: attempts + 1,
      error: admin.firestore.FieldValue.delete(),
    });

    return { id: doc.id, ...data, attempts: attempts + 1 };
  });
}

async function processFlyerJob(jobId) {
  const jobRef = db.collection("notificationJobs").doc(jobId);
  const claimedJob = await claimFlyerJob(jobRef);
  if (!claimedJob) {
    return;
  }

  const job = claimedJob;
  const flyerId = job.flyerId || "";
  const flyerType = job.flyerType || "leaflet";
  const flyerHeader = (job.flyerHeader || "").trim();
  const amountPerUser = job.amountPerUser || 0;

  const titlePrefix = getEventTitleByFlyerType(flyerType);
  const title = flyerHeader ? `${titlePrefix} ${flyerHeader}` : titlePrefix;

  let lastDoc = null;
  let usersScanned = 0;
  let tokensProcessed = 0;
  let successCount = 0;
  let failureCount = 0;

  do {
    let usersQuery = db.collection("users").limit(USER_PAGE_SIZE);
    if (lastDoc) {
      usersQuery = usersQuery.startAfter(lastDoc);
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
        await distributeRewardsToUsers(activeUserRewardTargets, amountPerUser);
      } catch (rewardError) {
        console.error("Failed to distribute flyer job rewards:", rewardError);
      }
    }

    await jobRef.update({
      status: "processing",
      usersScanned,
      tokensProcessed,
      successCount,
      failureCount,
      updatedAt: new Date().toISOString(),
    });

    lastDoc = usersSnapshot.docs[usersSnapshot.docs.length - 1] || null;
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
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: getJobExpiryTimestamp(),
  });
}

async function scheduleFlyerJob({ flyerId, flyerType, flyerHeader, amountPerUser }) {
  const createdAt = new Date().toISOString();
  const jobRef = db.collection("notificationJobs").doc();

  await jobRef.set({
    type: "flyer_created",
    status: "queued",
    flyerId,
    flyerType,
    flyerHeader: flyerHeader || "",
    amountPerUser: amountPerUser || 0,
    usersScanned: 0,
    tokensProcessed: 0,
    successCount: 0,
    failureCount: 0,
    attempts: 0,
    expiresAt: getJobExpiryTimestamp(),
    createdAt,
    updatedAt: createdAt,
  });

  if (shouldProcessFlyerJobsInline()) {
    setImmediate(() => {
      processFlyerJob(jobRef.id).catch(async (error) => {
        console.error("Error processing flyer job:", error);
        try {
          await jobRef.update({
            status: "failed",
            error: error.message || "Unknown flyer job failure",
            updatedAt: new Date().toISOString(),
            expiresAt: getJobExpiryTimestamp(),
          });
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
    const queuedSnapshot = await db
      .collection("notificationJobs")
      .where("status", "in", ["queued", "failed"])
      .orderBy("updatedAt", "asc")
      .limit(1)
      .get();

    if (queuedSnapshot.empty) {
      break;
    }

    const nextJobId = queuedSnapshot.docs[0].id;
    processed += 1;

    try {
      await processFlyerJob(nextJobId);
      succeeded += 1;
    } catch (error) {
      failed += 1;
      console.error("Queued flyer job failed:", error);

      await db
        .collection("notificationJobs")
        .doc(nextJobId)
        .set(
          {
            status: "failed",
            error: error.message || "Unknown flyer job worker failure",
            updatedAt: new Date().toISOString(),
            expiresAt: getJobExpiryTimestamp(),
          },
          { merge: true },
        );
    }
  }

  return { processed, succeeded, failed };
}

async function cleanupExpiredFlyerJobs(maxDelete = 500) {
  const nowTs = admin.firestore.Timestamp.now();
  const snapshot = await db
    .collection("notificationJobs")
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