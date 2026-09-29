const express = require("express");
const crypto = require("crypto");

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

module.exports = function createEventCheckinRouter({ db }) {
  const router = express.Router();
  const attempts = new Map();
  router.use("/events/check-in/:token", (req, res, next) => {
    res.set({
      "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    });
    const now = Date.now();
    if (attempts.size > 5000) {
      for (const [key, entry] of attempts) {
        if (entry.until < now) attempts.delete(key);
      }
    }
    const key = req.ip;
    const previous = attempts.get(key);
    const entry = previous && previous.until > now ? previous : { count: 0, until: now + 60000 };
    entry.count += 1;
    attempts.set(key, entry);
    if (entry.count > 60) return res.status(429).send("Too many check-in requests");
    next();
  });

  async function lookup(token) {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const index = await db.collection("eventCheckinTokens").doc(sha256(token)).get();
    if (!index.exists) return null;
    const { eventId, userId } = index.data();
    const eventRef = db.collection("flyers").doc(eventId);
    const applicationRef = eventRef.collection("eventApplications").doc(userId);
    const [event, application] = await Promise.all([eventRef.get(), applicationRef.get()]);
    if (!event.exists || event.data().type !== "event" || !application.exists || !application.data().confirmationRequired) return null;
    return { eventRef, applicationRef, event: event.data(), application: application.data() };
  }

  function render(res, token, record, message) {
    const { event, application } = record;
    const alreadyConfirmed = !!application.confirmedAt;
    res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Event check-in</title><style>body{font-family:system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:1rem;color:#172237}button{background:#1b68be;color:white;border:0;border-radius:8px;padding:1rem;font-size:1rem;cursor:pointer}.card{border:1px solid #ddd;border-radius:12px;padding:1.5rem}</style></head><body><main class="card"><h1>${escapeHtml(event.header)}</h1><p>${escapeHtml(event.adContent)}</p><p>Organizer: ${escapeHtml(event.companyDisplayName)}</p><p>Venue: ${escapeHtml(event.venue)}</p><p>Applicant: ${escapeHtml(application.username)}</p><p>${escapeHtml(message || (alreadyConfirmed ? "Attendance confirmed" : "Awaiting confirmation"))}</p>${alreadyConfirmed ? "" : `<form method="post" action="/events/check-in/${token}"><button type="submit">Confirm Attendance</button></form>`}</main></body></html>`);
  }

  router.get("/events/check-in/:token", async (req, res) => {
    try {
      const record = await lookup(req.params.token);
      if (!record) return res.status(404).send("Check-in not found");
      return render(res, req.params.token, record);
    } catch (error) {
      console.error("Failed to load check-in:", error);
      return res.status(500).send("Check-in unavailable");
    }
  });

  router.post("/events/check-in/:token", async (req, res) => {
    try {
      const record = await lookup(req.params.token);
      if (!record) return res.status(404).send("Check-in not found");
      const { eventRef, applicationRef } = record;
      const result = await db.runTransaction(async (tx) => {
        const [eventDoc, applicationDoc] = await Promise.all([tx.get(eventRef), tx.get(applicationRef)]);
        if (!eventDoc.exists || !applicationDoc.exists) return "Check-in not found";
        const event = eventDoc.data();
        const application = applicationDoc.data();
        if (application.confirmedAt) return "Attendance confirmed";
        const now = new Date();
        if (event.status !== "active" || now < new Date(event.startsAt) || now > new Date(event.endsAt)) return "Check-in is not open";
        tx.update(applicationRef, { confirmedAt: now.toISOString() });
        tx.update(eventRef, { confirmedCount: (event.confirmedCount || 0) + 1 });
        return "Attendance confirmed";
      });
      const latest = await applicationRef.get();
      return render(res, req.params.token, { ...record, application: latest.data() }, result);
    } catch (error) {
      console.error("Failed to confirm check-in:", error);
      return res.status(500).send("Check-in unavailable");
    }
  });
  return router;
};
