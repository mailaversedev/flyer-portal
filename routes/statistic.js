const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.firestore();

// GET /api/statistic
// Query params: year (optional), month (optional)
router.get("/", async (req, res) => {
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

module.exports = router;
