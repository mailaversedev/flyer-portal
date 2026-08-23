const crypto = require("crypto");

const SESSION_COLLECTION = "authSessions";
const MAX_ACTIVE_SESSIONS = 3;

const createTimestamp = () => new Date().toISOString();
const toMillis = (value) => new Date(value).getTime();
const hashRefreshToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
const generateRefreshToken = () => crypto.randomBytes(48).toString("base64url");

const createRefreshSession = async ({
  db,
  userId,
  subjectType,
  rollingDays,
  absoluteDays,
  metadata = {},
}) => {
  const refreshToken = generateRefreshToken();
  const now = new Date();
  const absoluteExpiresAt = new Date(
    now.getTime() + absoluteDays * 24 * 60 * 60 * 1000,
  );
  const expiresAt = new Date(
    Math.min(
      now.getTime() + rollingDays * 24 * 60 * 60 * 1000,
      absoluteExpiresAt.getTime(),
    ),
  );
  const sessionRef = db.collection(SESSION_COLLECTION).doc();

  await db.runTransaction(async (transaction) => {
    const activeSessions = await transaction.get(
      db
        .collection(SESSION_COLLECTION)
        .where("userId", "==", userId),
    );

    const validSessions = activeSessions.docs.filter((doc) => {
      const session = doc.data();
      return (
        session.subjectType === subjectType &&
        !session.revokedAt &&
        toMillis(session.expiresAt) > now.getTime()
      );
    });
    const sessionsToRevoke = validSessions
      .sort((a, b) => toMillis(a.data().createdAt) - toMillis(b.data().createdAt))
      .slice(0, Math.max(0, validSessions.length - MAX_ACTIVE_SESSIONS + 1));

    sessionsToRevoke.forEach((doc) => {
      transaction.update(doc.ref, {
        revokedAt: createTimestamp(),
        revokeReason: "device_limit",
      });
    });

    transaction.set(sessionRef, {
      userId,
      subjectType,
      refreshTokenHash: hashRefreshToken(refreshToken),
      previousRefreshTokenHash: null,
      createdAt: createTimestamp(),
      lastUsedAt: createTimestamp(),
      expiresAt: expiresAt.toISOString(),
      absoluteExpiresAt: absoluteExpiresAt.toISOString(),
      revokedAt: null,
      ...metadata,
    });
  });

  return { refreshToken, sessionId: sessionRef.id, expiresAt: expiresAt.toISOString() };
};

const rotateRefreshSession = async ({
  db,
  refreshToken,
  subjectType,
  rollingDays,
}) => {
  const now = new Date();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const sessions = await db
    .collection(SESSION_COLLECTION)
    .where("refreshTokenHash", "==", refreshTokenHash)
    .limit(1)
    .get();

  if (sessions.empty || sessions.docs[0].data().subjectType !== subjectType) {
    const reusedSessions = await db
      .collection(SESSION_COLLECTION)
      .where("previousRefreshTokenHash", "==", refreshTokenHash)
      .limit(1)
      .get();

    if (
      !reusedSessions.empty &&
      reusedSessions.docs[0].data().subjectType === subjectType
    ) {
      await reusedSessions.docs[0].ref.update({
        revokedAt: createTimestamp(),
        revokeReason: "refresh_token_reuse",
      });
    }
    throw new Error("Invalid refresh session");
  }

  const sessionDoc = sessions.docs[0];
  const session = sessionDoc.data();
  if (
    session.revokedAt ||
    toMillis(session.expiresAt) <= now.getTime() ||
    toMillis(session.absoluteExpiresAt) <= now.getTime()
  ) {
    throw new Error("Refresh session expired");
  }

  const nextRefreshToken = generateRefreshToken();
  const nextExpiresAt = new Date(
    Math.min(
      now.getTime() + rollingDays * 24 * 60 * 60 * 1000,
      toMillis(session.absoluteExpiresAt),
    ),
  );

  await sessionDoc.ref.update({
    previousRefreshTokenHash: refreshTokenHash,
    refreshTokenHash: hashRefreshToken(nextRefreshToken),
    lastUsedAt: createTimestamp(),
    expiresAt: nextExpiresAt.toISOString(),
  });

  return {
    refreshToken: nextRefreshToken,
    sessionId: sessionDoc.id,
    userId: session.userId,
    expiresAt: nextExpiresAt.toISOString(),
  };
};

const revokeRefreshSession = async ({ db, refreshToken, subjectType, reason }) => {
  if (!refreshToken) {
    return;
  }

  const session = await db
    .collection(SESSION_COLLECTION)
    .where("refreshTokenHash", "==", hashRefreshToken(refreshToken))
    .limit(1)
    .get();

  if (!session.empty && session.docs[0].data().subjectType === subjectType) {
    await session.docs[0].ref.update({
      revokedAt: createTimestamp(),
      revokeReason: reason,
    });
  }
};

const revokeAllRefreshSessions = async ({ db, userId, subjectType, reason }) => {
  const sessions = await db
    .collection(SESSION_COLLECTION)
    .where("userId", "==", userId)
    .get();

  const batch = db.batch();
  sessions.docs.forEach((doc) => {
    const session = doc.data();
    if (session.subjectType !== subjectType || session.revokedAt) {
      return;
    }
    batch.update(doc.ref, { revokedAt: createTimestamp(), revokeReason: reason });
  });
  await batch.commit();
};

module.exports = {
  createRefreshSession,
  rotateRefreshSession,
  revokeRefreshSession,
  revokeAllRefreshSessions,
};