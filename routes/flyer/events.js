const express = require("express");
const crypto = require("crypto");
const { authenticateToken } = require("../auth");

const asDate = (value) => typeof value === "string" && value.trim() ? new Date(value) : new Date(NaN);
const validDate = (date) => !Number.isNaN(date.getTime());
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

function checkinToken(applicationId, nonce) {
  const secret = process.env.EVENT_CHECKIN_SECRET;
  if (!secret || secret.length < 32) throw new Error("EVENT_CHECKIN_SECRET must contain at least 32 characters");
  return crypto.createHmac("sha256", secret).update(`${applicationId}:${nonce}`).digest("hex");
}

function applicationResponse(data, id) {
  const response = {
    eventId: data.eventId,
    appliedAt: data.appliedAt,
    confirmedAt: data.confirmedAt || null,
    status: data.confirmedAt ? "confirmed" : "applied",
    confirmationRequired: data.confirmationRequired,
  };
  if (data.confirmationRequired) {
    const token = checkinToken(id, data.nonce);
    const origin = process.env.EVENT_PUBLIC_BASE_URL;
    if (!origin || !/^https:\/\/[^/]+\/?$/.test(origin)) {
      throw new Error("EVENT_PUBLIC_BASE_URL must be an HTTPS origin");
    }
    response.checkinUrl = `${origin.replace(/\/$/, "")}/events/check-in/${token}`;
  }
  return response;
}

module.exports = function createEventsRouter({ db }) {
  const router = express.Router();

  // Event creation is separate from normal flyer economics and accepts only an allowlisted payload.
  router.post("/flyer/events", authenticateToken, async (req, res) => {
    if (req.user?.role !== "super-admin") return res.status(403).json({ success: false, message: "Super admin access is required" });
    const data = req.body || {};
    const companyId = typeof data.companyId === "string" ? data.companyId.trim() : "";
    const header = typeof data.header === "string" ? data.header.trim() : "";
    const adContent = typeof data.adContent === "string" ? data.adContent.trim() : "";
    const venue = typeof data.venue === "string" ? data.venue.trim() : "";
    const start = asDate(data.startsAt);
    const end = asDate(data.endsAt);
    const deadline = asDate(data.applicationDeadline);
    const capacity = data.capacity === "" || data.capacity == null ? null : Number(data.capacity);
    if (!companyId || !header || !adContent || !venue || !validDate(start) || !validDate(end) || !validDate(deadline) ||
        start <= new Date() || end <= start || deadline > start || deadline <= new Date() ||
        (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 1)) ||
        (data.confirmationRequired !== undefined && typeof data.confirmationRequired !== "boolean") ||
        typeof data.coverPhoto !== "string" || !/^https:\/\//.test(data.coverPhoto) ||
        (data.timezone && (typeof data.timezone !== "string" || data.timezone.length > 80 || !Intl.supportedValuesOf("timeZone").includes(data.timezone))) ||
        header.length > 160 || adContent.length > 5000 || venue.length > 300) {
      return res.status(400).json({ success: false, message: "Invalid event fields or dates" });
    }
    if (data.confirmationRequired && ((!process.env.EVENT_CHECKIN_SECRET || process.env.EVENT_CHECKIN_SECRET.length < 32) || !/^https:\/\/[^/]+\/?$/.test(process.env.EVENT_PUBLIC_BASE_URL || ""))) {
      return res.status(503).json({ success: false, message: "Event check-in is not configured" });
    }
    try {
      const merchant = await db.collection("companies").doc(companyId).get();
      if (!merchant.exists || merchant.data()?.isActive === false) return res.status(400).json({ success: false, message: "Active merchant not found" });
      const company = merchant.data();
      const flyer = {
        type: "event", companyId, header, adContent, venue,
        startsAt: start.toISOString(), endsAt: end.toISOString(), applicationDeadline: deadline.toISOString(),
        timezone: data.timezone || "Asia/Hong_Kong", capacity,
        confirmationRequired: data.confirmationRequired === true, applicantCount: 0, confirmedCount: 0,
        coverPhoto: data.coverPhoto || null, flyerPrompts: typeof data.flyerPrompts === "string" ? data.flyerPrompts.slice(0, 2000) : "",
        companyName: company.name || "", companyDisplayName: company.companyDisplayName || company.name || "",
        companyIcon: company.icon || null, hideCompanyDetail: false, noReward: true,
        status: "active", createdAt: new Date().toISOString(),
      };
      const ref = await db.collection("flyers").add(flyer);
      return res.status(201).json({ success: true, flyerId: ref.id, data: { id: ref.id, ...flyer } });
    } catch (error) {
      console.error("Failed to create event:", error);
      return res.status(500).json({ success: false, message: "Failed to create event" });
    }
  });

  router.get("/flyer/:eventId/application", authenticateToken, async (req, res) => {
    const userId = req.user?.userId;
    if (!userId || req.user?.role) return res.status(403).json({ success: false, message: "User login required" });
    res.set("Cache-Control", "no-store");
    try {
      const ref = db.collection("flyers").doc(req.params.eventId).collection("eventApplications").doc(userId);
      const doc = await ref.get();
      if (!doc.exists) return res.json({ success: true, data: null });
      return res.json({ success: true, data: applicationResponse(doc.data(), ref.path) });
    } catch (error) {
      console.error("Failed to fetch event application:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch application" });
    }
  });

  router.post("/flyer/:eventId/apply", authenticateToken, async (req, res) => {
    const userId = req.user?.userId;
    if (!userId || req.user?.role) return res.status(403).json({ success: false, message: "User login required" });
    res.set("Cache-Control", "no-store");
    const eventRef = db.collection("flyers").doc(req.params.eventId);
    const applicationRef = eventRef.collection("eventApplications").doc(userId);
    try {
      const application = await db.runTransaction(async (tx) => {
        const [eventDoc, existing, userDoc] = await Promise.all([
          tx.get(eventRef), tx.get(applicationRef), tx.get(db.collection("users").doc(userId)),
        ]);
        if (!eventDoc.exists || eventDoc.data().type !== "event") throw Object.assign(new Error("Event not found"), { status: 404 });
        if (existing.exists) return existing.data();
        const event = eventDoc.data();
        const now = new Date();
        if (event.status !== "active" || now >= asDate(event.startsAt) || now >= asDate(event.applicationDeadline) || (event.scheduledAt && now < asDate(event.scheduledAt))) throw Object.assign(new Error("Applications are closed"), { status: 409 });
        if (event.capacity != null && (event.applicantCount || 0) >= event.capacity) throw Object.assign(new Error("Event is full"), { status: 409 });
        if (!userDoc.exists || userDoc.data()?.isActive === false) throw Object.assign(new Error("Active user not found"), { status: 403 });
        const nonce = event.confirmationRequired ? crypto.randomBytes(32).toString("hex") : null;
        const record = {
          eventId: eventRef.id, userId, username: userDoc.data().username,
          appliedAt: now.toISOString(), confirmedAt: null, confirmationRequired: event.confirmationRequired,
          ...(nonce ? { nonce } : {}),
        };
        if (nonce) {
          const tokenHash = hash(checkinToken(applicationRef.path, nonce));
          tx.create(db.collection("eventCheckinTokens").doc(tokenHash), { eventId: eventRef.id, userId });
        }
        tx.create(applicationRef, record);
        tx.update(eventRef, { applicantCount: (event.applicantCount || 0) + 1 });
        return record;
      });
      return res.json({ success: true, data: applicationResponse(application, applicationRef.path) });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ success: false, message: error.message });
      console.error("Failed to apply for event:", error);
      return res.status(500).json({ success: false, message: "Failed to apply for event" });
    }
  });

  return router;
};
