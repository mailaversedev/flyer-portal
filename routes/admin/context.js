const admin = require("firebase-admin");

const db = admin.firestore();

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const CRM_EMAIL_SUBJECT_MAX_LENGTH = 160;
const CRM_EMAIL_HTML_MAX_LENGTH = 200000;
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CRM_CONTACTS_COLLECTION = "crm_contacts";
const AUDIENCE_SOURCE_USERS = "users";
const AUDIENCE_SOURCE_CRM = "crm_contacts";

const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "super-admin") {
    return res.status(403).json({
      success: false,
      message: "Super admin access is required",
    });
  }

  next();
};

const normalizeLimit = (value) => {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
};

const normalizeString = (value) => `${value || ""}`.trim();

const normalizeMoneyAmount = (value) => {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
};

const encodeNextToken = (value) => {
  if (!value) {
    return null;
  }

  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
};

const decodeNextToken = (value) => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch (_error) {
    return null;
  }
};

const commitDeleteRefsInChunks = async (refs, chunkSize = 450) => {
  const uniqueRefs = Array.from(
    new Map(refs.filter(Boolean).map((ref) => [ref.path, ref])).values(),
  );

  for (let index = 0; index < uniqueRefs.length; index += chunkSize) {
    const batch = db.batch();
    uniqueRefs.slice(index, index + chunkSize).forEach((ref) => {
      batch.delete(ref);
    });
    await batch.commit();
  }
};

const buildAudienceQuery = ({ collectionName, direction, limit, cursor }) => {
  let query = db
    .collection(collectionName)
    .orderBy(admin.firestore.FieldPath.documentId(), direction)
    .limit(limit + 1);

  if (cursor?.id) {
    query = query.startAfter(cursor.id);
  }

  return query;
};

const serializeAdminUser = (doc) => {
  const data = doc.data() || {};

  return {
    id: doc.id,
    username: data.username || "",
    displayName: data.displayName || "",
    createdAt: data.createdAt || null,
    lastLoginAt: data.lastLoginAt || null,
    status: data.isActive !== false ? "active" : "inactive",
    location: data.location || null,
    source: "user",
  };
};

const serializeCrmContact = (doc) => {
  const data = doc.data() || {};
  const baseLocation =
    data.location && typeof data.location === "object" ? data.location : {};

  return {
    id: doc.id,
    username: data.email || "",
    displayName: data.name || "",
    createdAt: data.createdAt || null,
    lastLoginAt: null,
    status: "engaged",
    location: {
      countryCity: baseLocation.countryCity || data.countryCity || "",
      district: baseLocation.district || data.district || "",
      buildingEstate:
        baseLocation.buildingEstate ||
        baseLocation.address ||
        data.address ||
        "",
    },
    source: "crm_contact",
  };
};

const fetchAudienceSegment = async ({ source, direction, limit, cursor }) => {
  const collectionName =
    source === AUDIENCE_SOURCE_CRM
      ? CRM_CONTACTS_COLLECTION
      : AUDIENCE_SOURCE_USERS;
  const snapshot = await buildAudienceQuery({
    collectionName,
    direction,
    limit,
    cursor,
  }).get();
  const docs = snapshot.docs;
  const hasMore = docs.length > limit;
  const visibleDocs = hasMore ? docs.slice(0, limit) : docs;
  const serialize =
    source === AUDIENCE_SOURCE_CRM ? serializeCrmContact : serializeAdminUser;
  const entries = visibleDocs.map((doc) => serialize(doc));
  const lastDoc = visibleDocs.at(-1);

  return {
    entries,
    hasMore,
    cursor: lastDoc ? { id: lastDoc.id } : null,
  };
};

module.exports = {
  admin,
  db,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  CRM_EMAIL_SUBJECT_MAX_LENGTH,
  CRM_EMAIL_HTML_MAX_LENGTH,
  SIMPLE_EMAIL_RE,
  CRM_CONTACTS_COLLECTION,
  AUDIENCE_SOURCE_USERS,
  AUDIENCE_SOURCE_CRM,
  requireSuperAdmin,
  normalizeLimit,
  normalizeString,
  normalizeMoneyAmount,
  encodeNextToken,
  decodeNextToken,
  commitDeleteRefsInChunks,
  fetchAudienceSegment,
};
