const express = require("express");

module.exports = function createAdminSummaryRouter(context) {
  const { db } = context;
  const router = express.Router();

  router.get("/summary", async (_req, res) => {
    try {
      const [usersSnapshot, crmContactsSnapshot, companiesSnapshot, flyersSnapshot, creditRequestsSnapshot, flyerGenerationsSnapshot] = await Promise.all([
        db.collection("users").count().get(),
        db.collection("crm_contacts").count().get(),
        db.collection("companies").count().get(),
        db.collection("flyers").count().get(),
        db.collection("creditRequests").get(),
        db
          .collection("transactions")
          .where("ownerType", "==", "company")
          .where("type", "==", "DEDUCT")
          .where("unit", "==", "TOKEN")
          .count()
          .get(),
      ]);

      const creditRequestAmountHkd = creditRequestsSnapshot.docs.reduce(
        (total, doc) => total + (Number(doc.data()?.amount) || 0),
        0,
      );

      res.status(200).json({
        success: true,
        data: {
          users:
            (usersSnapshot.data().count || 0) +
            (crmContactsSnapshot.data().count || 0),
          companies: companiesSnapshot.data().count || 0,
          flyers: flyersSnapshot.data().count || 0,
          creditRequests: creditRequestsSnapshot.size || 0,
          creditRequestAmountHkd: Math.round(creditRequestAmountHkd * 100) / 100,
          flyerGenerations: flyerGenerationsSnapshot.data().count || 0,
        },
      });
    } catch (error) {
      console.error("Error fetching admin collection totals:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch admin collection totals",
        error: error.message,
      });
    }
  });

  return router;
};