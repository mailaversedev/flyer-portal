const PAGE_DEFAULT_LIMIT = 50;
const PAGE_MAX_LIMIT = 100;
const LOOKUP_BATCH_SIZE = 100;

const encodeCursor = (path) =>
  Buffer.from(JSON.stringify({ path }), "utf8").toString("base64url");

const decodeCursor = (value) => {
  if (!value) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return typeof decoded?.path === "string" ? decoded.path : null;
  } catch (_error) {
    return null;
  }
};

const normalizePageLimit = (value) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return PAGE_DEFAULT_LIMIT;
  }

  return Math.min(parsed, PAGE_MAX_LIMIT);
};

const chunk = (items, size) => {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const getDocumentsByIds = async (db, collectionName, ids) => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  const documentsById = new Map();

  for (const idChunk of chunk(uniqueIds, LOOKUP_BATCH_SIZE)) {
    const refs = idChunk.map((id) => db.collection(collectionName).doc(id));
    const snapshots = await db.getAll(...refs);

    snapshots.forEach((snapshot) => {
      if (snapshot.exists) {
        documentsById.set(snapshot.id, snapshot.data() || {});
      }
    });
  }

  return documentsById;
};

const getUserLookup = async (db, userIds) => {
  const usersById = await getDocumentsByIds(db, "users", userIds);
  const userLookup = new Map();

  usersById.forEach((userData, userId) => {
    userLookup.set(userId, {
      username: userData.username || "",
      email: userData.email || "",
    });
  });

  return userLookup;
};

const getCursorSnapshot = async (db, cursor, allowedPrefixes = []) => {
  const cursorPath = decodeCursor(cursor);

  if (
    !cursorPath ||
    !allowedPrefixes.some((prefix) => cursorPath.startsWith(prefix))
  ) {
    return null;
  }

  const cursorSnapshot = await db.doc(cursorPath).get();
  return cursorSnapshot.exists ? cursorSnapshot : null;
};

module.exports = {
  encodeCursor,
  getCursorSnapshot,
  getDocumentsByIds,
  getUserLookup,
  normalizePageLimit,
};
