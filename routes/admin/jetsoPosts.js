const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const { randomUUID } = require("node:crypto");
const admin = require("firebase-admin");
const { MAILAVERSE_ORGANIZER } = require("../../src/utils/EventCreationUtil");
const {
  PostValidationError, normalizeDraft, publicContent, previewHtml, hasBodyContent,
} = require("../../services/jetsoPostContent");

const COLLECTION = "jetsoPosts";
const IMAGE_COLLECTION = "jetsoPostImages";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 2 },
});
const fail = (message, status = 400) => { throw new PostValidationError(message, status); };
const checkRecordSize = (record) => {
  if (Buffer.byteLength(JSON.stringify(record), "utf8") > 950 * 1024) {
    fail("The draft and published copy exceed the Firestore document limit. Shorten the article or translations.", 413);
  }
};
const checkPayload = (payload, allowed) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
      Object.keys(payload).some((key) => !allowed.includes(key))) fail("Invalid request fields");
};
const checkRevision = (value, record) => {
  if (!Number.isInteger(value) || value < 1) fail("A saved revision is required");
  if (value !== record.revision) fail("This article was changed by another editor. Reload before saving.", 409);
};
const checkPost = (snapshot) => {
  if (!snapshot.exists || snapshot.data().kind !== "blog" || snapshot.data().channel !== "jetso") fail("Article not found", 404);
  return snapshot.data();
};

module.exports = function createJetsoPostsRouter({
  db, bucket = () => admin.storage().bucket("flyer-genie.firebasestorage.app"),
}) {
  const router = express.Router();
  router.use("/jetso-posts", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!req.user?.userId) return res.status(401).json({ success: false, message: "Admin login is required" });
    if (req.user.role !== "super-admin") return res.status(403).json({ success: false, message: "Super admin access is required" });
    return next();
  });
  const handle = (action) => async (req, res) => {
    try { await action(req, res); } catch (error) {
      if (error instanceof PostValidationError) {
        return res.status(error.status).json({ success: false, message: error.message });
      }
      console.error("Jetso blog request failed:", error);
      return res.status(500).json({ success: false, message: "Unable to process the blog request. Please try again." });
    }
  };
  const postRef = (id) => {
    if (typeof id !== "string" || !/^[^/]{1,150}$/.test(id)) fail("Invalid article ID");
    return db.collection(COLLECTION).doc(id);
  };
  const attribution = async (draft, transaction = null) => {
    if (!draft.companyId) return {
      companyName: MAILAVERSE_ORGANIZER.name,
      companyDisplayName: MAILAVERSE_ORGANIZER.name,
      companyIcon: MAILAVERSE_ORGANIZER.icon,
    };
    const ref = db.collection("companies").doc(draft.companyId);
    const doc = transaction ? await transaction.get(ref) : await ref.get();
    if (!doc.exists || doc.data().isActive === false) fail("Select an active merchant");
    const company = doc.data();
    return {
      companyName: company.name || "",
      companyDisplayName: company.companyDisplayName || company.name || "",
      companyIcon: company.icon || "",
    };
  };

  router.get("/jetso-posts", handle(async (req, res) => {
    const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) fail("Limit must be between 1 and 100");
    let query = db.collection(COLLECTION).orderBy("createdAt", "desc").limit(limit + 1);
    if (req.query.after) {
      const cursor = await postRef(req.query.after).get();
      checkPost(cursor);
      query = query.startAfter(cursor);
    }
    const snapshot = await query.get();
    const documents = snapshot.docs.slice(0, limit);
    const data = documents.map((doc) => {
      const post = doc.data();
      return {
        id: doc.id, kind: post.kind, channel: post.channel, status: post.status,
        revision: post.revision, createdAt: post.createdAt, updatedAt: post.updatedAt,
        publishedAt: post.publishedAt,
        draft: { header: post.draft.header, scheduledAt: post.draft.scheduledAt },
        publicSnapshot: post.publicSnapshot ? {
          header: post.publicSnapshot.header, scheduledAt: post.publicSnapshot.scheduledAt,
          publishedAt: post.publicSnapshot.publishedAt,
        } : null,
      };
    });
    res.json({ success: true, data, pagination: {
      nextCursor: snapshot.docs.length > limit ? documents.at(-1).id : null,
    } });
  }));

  router.post("/jetso-posts/preview", handle(async (req, res) => {
    checkPayload(req.body, ["draft"]);
    const draft = normalizeDraft(req.body.draft);
    await attribution(draft);
    res.json({ success: true, data: { html: previewHtml(draft) } });
  }));

  router.post("/jetso-posts/images", upload.single("file"), handle(async (req, res) => {
    if (!req.file) fail("Choose a JPEG, PNG or WebP image");
    if (!["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype)) fail("Only JPEG, PNG and WebP images are supported");
    let output;
    try {
      const processor = sharp(req.file.buffer, { limitInputPixels: 40000000, animated: false });
      const metadata = await processor.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format) || (metadata.pages || 1) > 1) fail("Only static JPEG, PNG and WebP images are supported");
      if (metadata.width > 8192 || metadata.height > 8192) fail("Images must not exceed 8192 pixels in either dimension");
      output = await processor.rotate().webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
    } catch (error) {
      if (error instanceof PostValidationError) throw error;
      fail("This image could not be decoded. Choose a valid JPEG, PNG or WebP file.");
    }
    const id = randomUUID();
    const storage = typeof bucket === "function" ? bucket() : bucket;
    const objectPath = `jetso-blog/${id}.webp`;
    const url = `https://storage.googleapis.com/${storage.name}/${objectPath}`;
    try {
      await storage.file(objectPath).save(output.data, {
        resumable: false, contentType: "image/webp", public: true,
        metadata: { cacheControl: "public,max-age=31536000,immutable" },
      });
      await db.collection(IMAGE_COLLECTION).doc(id).set({
        objectPath, url, uploadedBy: req.user.userId, uploadedAt: new Date().toISOString(),
        width: output.info.width, height: output.info.height,
      });
    } catch (error) {
      console.error("Blog image upload failed; review object before cleanup:", { objectPath, error });
      throw error;
    }
    res.status(201).json({
      success: true, url, fileId: id, width: output.info.width, height: output.info.height,
    });
  }));

  router.post("/jetso-posts", handle(async (req, res) => {
    checkPayload(req.body, ["draft"]);
    const draft = normalizeDraft(req.body.draft);
    await attribution(draft);
    const now = new Date().toISOString();
    const record = {
      kind: "blog", channel: "jetso", status: "draft", revision: 1, draft,
      publicSnapshot: null, publishedAt: null,
      createdBy: req.user.userId, updatedBy: req.user.userId,
      createdAt: now, updatedAt: now,
    };
    checkRecordSize(record);
    const ref = db.collection(COLLECTION).doc();
    await ref.set(record);
    res.status(201).json({ success: true, data: { id: ref.id, ...record } });
  }));

  router.get("/jetso-posts/:postId", handle(async (req, res) => {
    const doc = await postRef(req.params.postId).get();
    res.json({ success: true, data: { id: doc.id, ...checkPost(doc) } });
  }));

  router.put("/jetso-posts/:postId", handle(async (req, res) => {
    checkPayload(req.body, ["draft", "revision"]);
    const draft = normalizeDraft(req.body.draft);
    const ref = postRef(req.params.postId);
    const record = await db.runTransaction(async (transaction) => {
      const existing = checkPost(await transaction.get(ref));
      checkRevision(req.body.revision, existing);
      await attribution(draft, transaction);
      const updated = {
        ...existing, draft, revision: existing.revision + 1,
        updatedAt: new Date().toISOString(), updatedBy: req.user.userId,
      };
      checkRecordSize(updated);
      transaction.set(ref, updated);
      return updated;
    });
    res.json({ success: true, data: { id: ref.id, ...record } });
  }));

  for (const action of ["publish", "unpublish", "archive"]) {
    router.post(`/jetso-posts/:postId/${action}`, handle(async (req, res) => {
      checkPayload(req.body, ["revision"]);
      const ref = postRef(req.params.postId);
      const record = await db.runTransaction(async (transaction) => {
        const existing = checkPost(await transaction.get(ref));
        checkRevision(req.body.revision, existing);
        const now = new Date().toISOString();
        const updated = {
          ...existing, revision: existing.revision + 1, updatedAt: now, updatedBy: req.user.userId,
        };
        if (action === "publish") {
          const draft = existing.draft;
          if (!draft.header || !hasBodyContent(draft)) fail("A title and article description are required to publish");
          if (!draft.coverPhoto) fail("Choose a cover image before publishing");
          const currentlyLive = existing.status === "published" && existing.publicSnapshot &&
            (!existing.publicSnapshot.scheduledAt || existing.publicSnapshot.scheduledAt <= now);
          if (currentlyLive && draft.scheduledAt && draft.scheduledAt > now) fail("Scheduled replacements of live articles are not supported. Publish the update now.");
          const company = await attribution(draft, transaction);
          const publishedAt = currentlyLive
            ? existing.publicSnapshot.publishedAt
            : draft.scheduledAt && draft.scheduledAt > now ? draft.scheduledAt : now;
          updated.status = "published";
          updated.publishedAt = publishedAt;
          updated.publicSnapshot = {
            ...publicContent(draft), ...company,
            publishedAt, updatedAt: publishedAt > now ? publishedAt : now,
          };
        } else {
          updated.status = action === "archive" ? "archived" : "draft";
          updated.publicSnapshot = null;
          updated.publishedAt = null;
        }
        checkRecordSize(updated);
        transaction.set(ref, updated);
        return updated;
      });
      res.json({ success: true, data: { id: ref.id, ...record } });
    }));
  }

  router.use((error, _req, res, next) => {
    if (!(error instanceof multer.MulterError)) return next(error);
    return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      success: false,
      message: error.code === "LIMIT_FILE_SIZE" ? "Images must be at most 5 MiB" : "Upload one image file with no additional fields",
    });
  });
  return router;
};
