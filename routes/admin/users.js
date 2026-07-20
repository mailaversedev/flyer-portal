const express = require("express");

module.exports = function createUsersRouter(context) {
  const {
    db,
    normalizeLimit,
    decodeNextToken,
    encodeNextToken,
    fetchAudienceSegment,
    AUDIENCE_SOURCE_USERS,
    AUDIENCE_SOURCE_CRM,
    CRM_CONTACTS_COLLECTION,
  } = context;

  const router = express.Router();

  router.get("/users", async (req, res) => {
    try {
      const limit = normalizeLimit(req.query.limit);
      const direction = req.query.direction === "asc" ? "asc" : "desc";
      const parsedToken = decodeNextToken(req.query.nextToken);
      let currentSource =
        parsedToken?.source === AUDIENCE_SOURCE_CRM
          ? AUDIENCE_SOURCE_CRM
          : AUDIENCE_SOURCE_USERS;
      let cursor = parsedToken?.cursor || null;
      let remaining = limit;
      const entries = [];
      let nextToken = null;

      const [userCountSnapshot, crmCountSnapshot] = await Promise.all([
        db.collection(AUDIENCE_SOURCE_USERS).count().get(),
        db.collection(CRM_CONTACTS_COLLECTION).count().get(),
      ]);

      while (remaining > 0 && currentSource) {
        const segment = await fetchAudienceSegment({
          source: currentSource,
          direction,
          limit: remaining,
          cursor,
        });

        entries.push(...segment.entries);
        remaining -= segment.entries.length;

        if (segment.hasMore && segment.cursor) {
          nextToken = encodeNextToken({
            source: currentSource,
            cursor: segment.cursor,
          });
          break;
        }

        if (currentSource === AUDIENCE_SOURCE_USERS) {
          currentSource = AUDIENCE_SOURCE_CRM;
          cursor = null;
        } else {
          currentSource = null;
        }
      }

      const totalRegisteredUsers = userCountSnapshot.data().count || 0;
      const totalCrmContacts = crmCountSnapshot.data().count || 0;

      if (
        !nextToken &&
        currentSource === AUDIENCE_SOURCE_CRM &&
        remaining === 0 &&
        totalCrmContacts > 0
      ) {
        nextToken = encodeNextToken({
          source: AUDIENCE_SOURCE_CRM,
          cursor: null,
        });
      }

      res.status(200).json({
        success: true,
        data: {
          entries,
        },
        nextToken,
        summary: {
          registeredUsers: totalRegisteredUsers,
          crmContacts: totalCrmContacts,
          totalAudience: totalRegisteredUsers + totalCrmContacts,
        },
      });
    } catch (error) {
      console.error("Error fetching admin user list:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch users",
        error: error.message,
      });
    }
  });

  return router;
};
