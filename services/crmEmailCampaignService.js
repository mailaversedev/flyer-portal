const crypto = require("crypto");
const admin = require("firebase-admin");

const { DEFAULT_FROM, createMailTransport, htmlToText } = require("./mailService");

const db = admin.firestore();

const CRM_CONTACTS_COLLECTION = "crm_contacts";
const CRM_EMAIL_CAMPAIGNS_COLLECTION = "crmEmailCampaigns";
const CRM_EMAIL_RECIPIENTS_SUBCOLLECTION = "recipients";
const FIRESTORE_BATCH_LIMIT = 400;
const EMAIL_BATCH_SIZE = Math.max(
  1,
  Math.min(100, Number(process.env.CRM_EMAIL_BATCH_SIZE) || 25),
);
const EMAIL_SEND_CONCURRENCY = Math.max(
  1,
  Math.min(20, Number(process.env.CRM_EMAIL_SEND_CONCURRENCY) || 5),
);
const CRM_EMAIL_JOB_LEASE_MS = Math.max(
  60000,
  Number(process.env.CRM_EMAIL_JOB_LEASE_MS) || 10 * 60 * 1000,
);

function normalizeRecipientEmail(email) {
  return `${email || ""}`.trim().toLowerCase();
}

function getCurrentIsoTimestamp() {
  return new Date().toISOString();
}

function getWorkerId() {
  return process.env.DYNO || `pid-${process.pid}`;
}

function getJobLeaseExpiryTimestamp() {
  return admin.firestore.Timestamp.fromMillis(Date.now() + CRM_EMAIL_JOB_LEASE_MS);
}

function hashRecipientEmail(email) {
  return crypto.createHash("sha1").update(email).digest("hex");
}

function serializeCampaign(doc) {
  const data = doc.data() || {};

  return {
    id: doc.id,
    subject: data.subject || "",
    mode: data.mode || "campaign",
    status: data.status || "queued",
    totalRecipients: Number(data.totalRecipients) || 0,
    pendingCount: Number(data.pendingCount) || 0,
    sentCount: Number(data.sentCount) || 0,
    failedCount: Number(data.failedCount) || 0,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    queuedAt: data.queuedAt || null,
    startedAt: data.startedAt || null,
    completedAt: data.completedAt || null,
    lastError: data.lastError || "",
    createdBy: data.createdBy || null,
    testRecipientEmail: data.testRecipientEmail || "",
    html: data.html || "",
  };
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function getCrmContactSummary() {
  const [totalSnapshot, eligibleSnapshot] = await Promise.all([
    db.collection(CRM_CONTACTS_COLLECTION).count().get(),
    db
      .collection(CRM_CONTACTS_COLLECTION)
      .where("channels.email", "==", true)
      .count()
      .get(),
  ]);

  return {
    totalContacts: totalSnapshot.data().count || 0,
    eligibleEmailContacts: eligibleSnapshot.data().count || 0,
  };
}

async function listCrmEmailCampaigns(limit = 10) {
  const snapshot = await db
    .collection(CRM_EMAIL_CAMPAIGNS_COLLECTION)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => serializeCampaign(doc));
}

async function getCrmEmailCampaign(campaignId) {
  const campaignDoc = await db
    .collection(CRM_EMAIL_CAMPAIGNS_COLLECTION)
    .doc(campaignId)
    .get();

  if (!campaignDoc.exists) {
    return null;
  }

  return serializeCampaign(campaignDoc);
}

async function buildRecipientList({ testRecipientEmail = "" } = {}) {
  const normalizedTestRecipientEmail = normalizeRecipientEmail(testRecipientEmail);

  if (normalizedTestRecipientEmail) {
    return [
      {
        email: normalizedTestRecipientEmail,
        name: "",
        sourceContactId: null,
        isTestRecipient: true,
      },
    ];
  }

  const snapshot = await db
    .collection(CRM_CONTACTS_COLLECTION)
    .where("channels.email", "==", true)
    .get();

  const deduped = new Map();

  snapshot.docs.forEach((doc) => {
    const data = doc.data() || {};
    const email = normalizeRecipientEmail(data.email);

    if (!email || deduped.has(email)) {
      return;
    }

    deduped.set(email, {
      email,
      name: data.name || "",
      sourceContactId: doc.id,
    });
  });

  return Array.from(deduped.values());
}

async function commitWriteBatch(operations) {
  if (operations.length === 0) {
    return;
  }

  const batch = db.batch();
  operations.forEach((operation) => {
    batch.set(operation.ref, operation.data, operation.options || undefined);
  });
  await batch.commit();
}

async function enqueueCrmEmailCampaign({
  subject,
  html,
  createdBy = null,
  testRecipientEmail = "",
}) {
  const normalizedTestRecipientEmail = normalizeRecipientEmail(testRecipientEmail);
  const recipients = await buildRecipientList({
    testRecipientEmail: normalizedTestRecipientEmail,
  });

  if (recipients.length === 0) {
    throw new Error("No CRM contacts with a valid email address are available");
  }

  const timestamp = getCurrentIsoTimestamp();
  const campaignRef = db.collection(CRM_EMAIL_CAMPAIGNS_COLLECTION).doc();
  const mode = normalizedTestRecipientEmail ? "test" : "campaign";

  await campaignRef.set({
    subject,
    html,
    mode,
    htmlTextPreview: htmlToText(html).slice(0, 240),
    status: "queued",
    totalRecipients: recipients.length,
    pendingCount: recipients.length,
    sentCount: 0,
    failedCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    queuedAt: timestamp,
    createdBy,
    ...(normalizedTestRecipientEmail
      ? { testRecipientEmail: normalizedTestRecipientEmail }
      : {}),
  });

  const operations = recipients.map((recipient) => ({
    ref: campaignRef
      .collection(CRM_EMAIL_RECIPIENTS_SUBCOLLECTION)
      .doc(hashRecipientEmail(recipient.email)),
    data: {
      ...recipient,
      status: "pending",
      attempts: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  }));

  for (const chunk of chunkArray(operations, FIRESTORE_BATCH_LIMIT)) {
    await commitWriteBatch(chunk);
  }

  const createdCampaign = await campaignRef.get();
  return serializeCampaign(createdCampaign);
}

async function claimCrmEmailCampaign(campaignRef) {
  return db.runTransaction(async (transaction) => {
    const campaignDoc = await transaction.get(campaignRef);

    if (!campaignDoc.exists) {
      return null;
    }

    const data = campaignDoc.data() || {};
    const status = data.status || "queued";
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

    const now = getCurrentIsoTimestamp();

    transaction.update(campaignRef, {
      status: "processing",
      startedAt: data.startedAt || now,
      claimedAt: now,
      lastHeartbeatAt: now,
      leaseExpiresAt: getJobLeaseExpiryTimestamp(),
      workerId: getWorkerId(),
      updatedAt: now,
      lastError: admin.firestore.FieldValue.delete(),
      completedAt: admin.firestore.FieldValue.delete(),
    });

    return {
      id: campaignDoc.id,
      ...data,
      status: "processing",
    };
  });
}

async function updateCrmEmailCampaignProgress(campaignRef, fields = {}) {
  await campaignRef.update({
    ...fields,
    updatedAt: getCurrentIsoTimestamp(),
    lastHeartbeatAt: getCurrentIsoTimestamp(),
    leaseExpiresAt: getJobLeaseExpiryTimestamp(),
    workerId: getWorkerId(),
  });
}

async function markCrmEmailCampaignAsFailed(campaignId, errorMessage) {
  await db
    .collection(CRM_EMAIL_CAMPAIGNS_COLLECTION)
    .doc(campaignId)
    .set(
      {
        status: "failed",
        lastError: errorMessage || "Unknown CRM email campaign failure",
        updatedAt: getCurrentIsoTimestamp(),
        lastFailedAt: getCurrentIsoTimestamp(),
        leaseExpiresAt: admin.firestore.FieldValue.delete(),
        lastHeartbeatAt: admin.firestore.FieldValue.delete(),
        workerId: admin.firestore.FieldValue.delete(),
      },
      { merge: true },
    );
}

async function findNextQueuedCrmEmailCampaignId() {
  const queuedSnapshot = await db
    .collection(CRM_EMAIL_CAMPAIGNS_COLLECTION)
    .where("status", "in", ["queued", "failed"])
    .limit(1)
    .get();

  if (!queuedSnapshot.empty) {
    return queuedSnapshot.docs[0].id;
  }

  const staleSnapshot = await db
    .collection(CRM_EMAIL_CAMPAIGNS_COLLECTION)
    .where("leaseExpiresAt", "<=", admin.firestore.Timestamp.now())
    .limit(1)
    .get();

  if (!staleSnapshot.empty) {
    return staleSnapshot.docs[0].id;
  }

  return null;
}

async function sendEmailBatch({ transporter, subject, html, recipientDocs }) {
  const results = [];

  for (const recipientChunk of chunkArray(recipientDocs, EMAIL_SEND_CONCURRENCY)) {
    const chunkResults = await Promise.all(
      recipientChunk.map(async (recipientDoc) => {
        const recipient = recipientDoc.data() || {};

        try {
          await transporter.sendMail({
            from: DEFAULT_FROM,
            to: recipient.email,
            subject,
            text: htmlToText(html),
            html,
          });

          return {
            doc: recipientDoc,
            success: true,
          };
        } catch (error) {
          return {
            doc: recipientDoc,
            success: false,
            error: error.message || "Failed to send email",
          };
        }
      }),
    );

    results.push(...chunkResults);
  }

  return results;
}

async function processCrmEmailCampaign(campaignId) {
  const campaignRef = db.collection(CRM_EMAIL_CAMPAIGNS_COLLECTION).doc(campaignId);
  const claimedCampaign = await claimCrmEmailCampaign(campaignRef);

  if (!claimedCampaign) {
    return false;
  }

  const transporter = createMailTransport();
  let pendingCount = Number(claimedCampaign.pendingCount) || 0;
  let sentCount = Number(claimedCampaign.sentCount) || 0;
  let failedCount = Number(claimedCampaign.failedCount) || 0;

  while (true) {
    const recipientSnapshot = await campaignRef
      .collection(CRM_EMAIL_RECIPIENTS_SUBCOLLECTION)
      .where("status", "==", "pending")
      .limit(EMAIL_BATCH_SIZE)
      .get();

    if (recipientSnapshot.empty) {
      break;
    }

    const results = await sendEmailBatch({
      transporter,
      subject: claimedCampaign.subject || "",
      html: claimedCampaign.html || "",
      recipientDocs: recipientSnapshot.docs,
    });

    const now = getCurrentIsoTimestamp();
    const batch = db.batch();
    let batchSentCount = 0;
    let batchFailedCount = 0;

    results.forEach((result) => {
      const recipient = result.doc.data() || {};

      if (result.success) {
        batch.update(result.doc.ref, {
          status: "sent",
          attempts: (Number(recipient.attempts) || 0) + 1,
          sentAt: now,
          updatedAt: now,
          lastError: admin.firestore.FieldValue.delete(),
        });
        batchSentCount += 1;
        return;
      }

      batch.update(result.doc.ref, {
        status: "failed",
        attempts: (Number(recipient.attempts) || 0) + 1,
        updatedAt: now,
        lastError: result.error || "Failed to send email",
      });
      batchFailedCount += 1;
    });

    await batch.commit();

    sentCount += batchSentCount;
    failedCount += batchFailedCount;
    pendingCount = Math.max(0, pendingCount - results.length);

    await updateCrmEmailCampaignProgress(campaignRef, {
      status: pendingCount > 0 ? "processing" : batchFailedCount > 0 ? "completed_with_failures" : "completed",
      pendingCount,
      sentCount,
      failedCount,
      lastProcessedAt: now,
    });
  }

  await campaignRef.set(
    {
      status: failedCount > 0 ? "completed_with_failures" : "completed",
      pendingCount,
      sentCount,
      failedCount,
      completedAt: getCurrentIsoTimestamp(),
      leaseExpiresAt: admin.firestore.FieldValue.delete(),
      lastHeartbeatAt: admin.firestore.FieldValue.delete(),
      workerId: admin.firestore.FieldValue.delete(),
      updatedAt: getCurrentIsoTimestamp(),
    },
    { merge: true },
  );

  return true;
}

async function processQueuedCrmEmailCampaigns(maxCampaigns = 1) {
  const result = {
    processed: 0,
    succeeded: 0,
    failed: 0,
  };

  for (let index = 0; index < maxCampaigns; index += 1) {
    const nextCampaignId = await findNextQueuedCrmEmailCampaignId();

    if (!nextCampaignId) {
      break;
    }

    try {
      const handled = await processCrmEmailCampaign(nextCampaignId);

      if (!handled) {
        break;
      }

      result.processed += 1;
      result.succeeded += 1;
    } catch (error) {
      result.processed += 1;
      result.failed += 1;
      console.error("Failed to process CRM email campaign:", error);
      await markCrmEmailCampaignAsFailed(
        nextCampaignId,
        error.message || "Failed to process CRM email campaign",
      );
    }
  }

  return result;
}

module.exports = {
  CRM_EMAIL_CAMPAIGNS_COLLECTION,
  enqueueCrmEmailCampaign,
  getCrmContactSummary,
  getCrmEmailCampaign,
  listCrmEmailCampaigns,
  processQueuedCrmEmailCampaigns,
  serializeCampaign,
};