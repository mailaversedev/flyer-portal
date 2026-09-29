const express = require("express");

module.exports = function createAdminEventsRouter({ db }) {
  const router = express.Router();
  // Mounted under /api/admin, which authenticates and requires super-admin.
  router.get("/events/:eventId/summary", async (req, res) => {
    try {
      const doc = await db.collection("flyers").doc(req.params.eventId).get();
      if (!doc.exists || doc.data().type !== "event") return res.status(404).json({ success: false, message: "Event not found" });
      const event = doc.data();
      const applicants = event.applicantCount || 0;
      const confirmed = event.confirmedCount || 0;
      return res.json({ success: true, data: {
        eventId: doc.id, title: event.header, merchant: event.companyDisplayName,
        capacity: event.capacity, applicants,
        verifiedConfirmed: event.confirmationRequired ? confirmed : 0,
        selfReportedJoined: event.confirmationRequired ? 0 : applicants,
        verifiedShowUpRate: event.confirmationRequired && applicants ? confirmed / applicants : null,
      } });
    } catch (error) {
      console.error("Failed to fetch event summary:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch event summary" });
    }
  });

  router.get("/events/:eventId/applications", async (req, res) => {
    try {
      const eventRef = db.collection("flyers").doc(req.params.eventId);
      const eventDoc = await eventRef.get();
      if (!eventDoc.exists || eventDoc.data().type !== "event") {
        return res.status(404).json({ success: false, message: "Event not found" });
      }
      const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
      let query = eventRef.collection("eventApplications").orderBy("appliedAt", "desc").limit(limit);
      if (req.query.after) {
        const cursor = await eventRef.collection("eventApplications").doc(String(req.query.after)).get();
        if (!cursor.exists) return res.status(400).json({ success: false, message: "Invalid cursor" });
        query = query.startAfter(cursor);
      }
      const snapshot = await query.get();
      const applications = snapshot.docs.map((doc) => ({
        userId: doc.id, username: doc.data().username,
        appliedAt: doc.data().appliedAt, confirmedAt: doc.data().confirmedAt || null,
        joinedType: doc.data().confirmationRequired
          ? (doc.data().confirmedAt ? "verified" : "pending")
          : "self-reported",
      }));
      res.set("Cache-Control", "no-store");
      return res.json({ success: true, data: applications, next: snapshot.size === limit ? snapshot.docs[snapshot.size - 1].id : null });
    } catch (error) {
      console.error("Failed to list event applications:", error);
      return res.status(500).json({ success: false, message: "Failed to list event applications" });
    }
  });
  return router;
};
