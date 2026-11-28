const admin = require("firebase-admin");

function scheduledAtForFlyer(flyer) {
  const value = flyer.scheduledAt || flyer.targetBudget?.scheduledAt || flyer.createdAt;
  if (typeof value !== "string" || !value.trim() || !Number.isFinite(Date.parse(value))) {
    throw new Error("Missing or invalid scheduledAt/createdAt");
  }
  return new Date(value).toISOString();
}

async function backfillFlyerScheduledAt(db, { apply = false, log = console.log } = {}) {
  const counts = { scanned: 0, changed: 0, unchanged: 0, invalid: 0 };
  let cursor;
  while (true) {
    let query = db.collection("flyers").orderBy(admin.firestore.FieldPath.documentId()).limit(200);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    for (const doc of snapshot.docs) {
      counts.scanned++;
      const process = (data) => {
        let scheduledAt;
        try {
          scheduledAt = scheduledAtForFlyer(data);
        } catch (error) {
          return { status: "invalid", message: error.message };
        }
        if (data.scheduledAt === scheduledAt) {
          return { status: "unchanged" };
        }
        return { status: "changed", scheduledAt };
      };
      let result;
      if (apply) {
        result = await db.runTransaction(async (transaction) => {
          const current = await transaction.get(doc.ref);
          if (!current.exists) return { status: "deleted" };
          const outcome = process(current.data());
          if (outcome.status === "changed") {
            transaction.update(doc.ref, { scheduledAt: outcome.scheduledAt });
          }
          return outcome;
        });
      } else {
        result = process(doc.data());
      }
      if (result.status === "changed") {
        counts.changed++;
        log(`${doc.id}: ${apply ? "updated" : "would update"} scheduledAt`);
      } else if (result.status === "invalid") {
        counts.invalid++;
        log(`${doc.id}: ${result.message}`);
      } else if (result.status === "unchanged") {
        counts.unchanged++;
      }
    }
    if (snapshot.docs.length < 200) break;
    cursor = snapshot.docs.at(-1);
  }
  return counts;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const projectArg = args.find((arg) => arg.startsWith("--project="));
  if (!projectArg || !projectArg.slice("--project=".length) ||
      args.some((arg) => arg !== projectArg && arg !== "--apply")) {
    console.error("Usage: node scripts/backfillFlyerScheduledAt.js --project=PROJECT_ID [--apply]");
    process.exitCode = 1;
  } else {
    const projectId = projectArg.slice("--project=".length);
    const apply = args.includes("--apply");
    admin.initializeApp({ projectId, credential: admin.credential.applicationDefault() });
    console.log(`Project: ${projectId}; mode: ${apply ? "APPLY" : "DRY RUN"}`);
    backfillFlyerScheduledAt(admin.firestore(), { apply })
      .then((counts) => {
        console.log(JSON.stringify(counts));
        if (counts.invalid) process.exitCode = 1;
      })
      .catch((error) => {
        console.error("Flyer backfill failed:", error);
        process.exitCode = 1;
      });
  }
}

module.exports = { backfillFlyerScheduledAt, scheduledAtForFlyer };
