const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();

// GET /api/internal/statistic
// Query params: year (optional), month (optional)
router.get("/statistic", async (req, res) => {
  try {
    let { year, month } = req.query;

    const statsRef = db
      .collection("companies")
      .doc(req.user.companyId)
      .collection("statistics");

    let results = [];

    // Case 1: Specific Month (Year + Month) -> Get single document
    if (year && month) {
      const docId = `${year}-${String(month).padStart(2, "0")}`;
      const doc = await statsRef.doc(docId).get();

      if (doc.exists) {
        results.push({ id: doc.id, ...doc.data() });
      }
    }
    // Case 2: Specific Year -> Query by year field
    else if (year) {
      const snapshot = await statsRef
        .where("year", "==", parseInt(year))
        .orderBy("month", "asc")
        .get();

      snapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
    }
    // Case 3: No filters -> Return all, ordered by date descending
    else {
      const snapshot = await statsRef
        .orderBy("year", "desc")
        .orderBy("month", "desc")
        .get();

      snapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
    }

    res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

// POST /api/internal/notification - Send push notification to a specific device
router.post("/notification", async (req, res) => {
  try {
    const { token, title, body, data } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Device token is required",
      });
    }

    const message = {
      notification: {
        title: title || "New Notification",
        body: body || "",
      },
      data: data || {},
      token: token,
    };

    const response = await admin.messaging().send(message);

    res.status(200).json({
      success: true,
      message: "Notification sent successfully",
      messageId: response,
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send notification",
      error: error.message,
    });
  }
});

module.exports = router;
