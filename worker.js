const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: "https://flyer-genie.firebaseio.com",
  });
}

admin.firestore().settings({ ignoreUndefinedProperties: true });

const {
  processQueuedFlyerJobs,
  cleanupExpiredFlyerJobs,
} = require("./services/flyerJobService");

const POLL_INTERVAL_MS = Math.max(
  1000,
  Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS) || 10000,
);
const MAX_JOBS_PER_CYCLE = Math.max(
  1,
  Math.min(20, Number(process.env.NOTIFICATION_WORKER_MAX_JOBS) || 3),
);
const CLEANUP_BATCH_SIZE = Math.max(
  1,
  Math.min(500, Number(process.env.NOTIFICATION_WORKER_CLEANUP_BATCH) || 200),
);
const CLEANUP_INTERVAL_MS = Math.max(
  10000,
  Number(process.env.NOTIFICATION_WORKER_CLEANUP_INTERVAL_MS) || 300000,
);

let isShuttingDown = false;
let nextCleanupAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runCycle() {
  const processResult = await processQueuedFlyerJobs(MAX_JOBS_PER_CYCLE);
  let cleanupResult = { deleted: 0 };

  if (Date.now() >= nextCleanupAt) {
    cleanupResult = await cleanupExpiredFlyerJobs(CLEANUP_BATCH_SIZE);
    nextCleanupAt = Date.now() + CLEANUP_INTERVAL_MS;
  }

  if (
    processResult.processed > 0 ||
    processResult.failed > 0 ||
    cleanupResult.deleted > 0
  ) {
    console.log("Flyer job worker cycle completed", {
      processed: processResult.processed,
      succeeded: processResult.succeeded,
      failed: processResult.failed,
      deletedExpired: cleanupResult.deleted,
    });
  }
}

async function startWorker() {
  console.log("Flyer job worker started", {
    pollIntervalMs: POLL_INTERVAL_MS,
    maxJobsPerCycle: MAX_JOBS_PER_CYCLE,
    cleanupBatchSize: CLEANUP_BATCH_SIZE,
    cleanupIntervalMs: CLEANUP_INTERVAL_MS,
  });

  nextCleanupAt = Date.now();

  while (!isShuttingDown) {
    try {
      await runCycle();
    } catch (error) {
      console.error("Flyer job worker cycle failed:", error);
    }

    if (!isShuttingDown) {
      await sleep(POLL_INTERVAL_MS);
    }
  }

  console.log("Flyer job worker stopped");
}

function handleShutdown(signal) {
  console.log(`Received ${signal}, shutting down flyer job worker...`);
  isShuttingDown = true;
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("unhandledRejection", (error) => {
  console.error("Unhandled promise rejection in flyer job worker:", error);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception in flyer job worker:", error);
  process.exit(1);
});

startWorker().catch((error) => {
  console.error("Flyer job worker failed to start:", error);
  process.exit(1);
});