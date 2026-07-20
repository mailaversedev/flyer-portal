const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

module.exports = function createLoginRouter(context) {
  const { db, JWT_SECRET, JWT_OPTIONS } = context;

  const router = express.Router();

  router.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "Username and password are required",
        });
      }

      const staffQuery = await db
        .collection("staffs")
        .where("username", "==", username)
        .limit(1)
        .get();

      if (staffQuery.empty) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password",
        });
      }

      const staffDoc = staffQuery.docs[0];
      const staffData = staffDoc.data();

      if (!staffData.isActive) {
        return res.status(401).json({
          success: false,
          message: "Staff account is deactivated",
        });
      }

      const isPasswordValid = await bcrypt.compare(password, staffData.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid username or password",
        });
      }

      let companyInfo = null;
      if (staffData.companyId) {
        const companyDoc = await db
          .collection("companies")
          .doc(staffData.companyId)
          .get();
        if (companyDoc.exists) {
          const companyData = companyDoc.data();
          companyInfo = {
            id: companyDoc.id,
            companyDisplayName: companyData.companyDisplayName,
            name: companyData.name,
            nature: companyData.nature,
            icon: companyData.icon,
            address: companyData.address,
            contact: companyData.contact,
            coverPhotos: Array.isArray(companyData.coverPhotos)
              ? companyData.coverPhotos.filter(
                  (photo) => typeof photo === "string" && photo.trim(),
                )
              : [],
            introduction:
              typeof companyData.introduction === "string"
                ? companyData.introduction
                : null,
            website:
              typeof companyData.website === "string"
                ? companyData.website
                : null,
            isActive: companyData.isActive,
          };

          const now = new Date();
          const year = now.getFullYear();
          const currentMonth = now.getMonth() + 1;
          const statsDocId = `${year}-${String(currentMonth).padStart(2, "0")}`;
          const statsRef = db
            .collection("companies")
            .doc(companyDoc.id)
            .collection("statistics");

          const statsQuery = await statsRef.where("year", "==", year).get();

          let statsList = [];
          if (statsQuery.empty) {
            const newStats = {
              year,
              month: currentMonth,
              claimCount: 0,
              flyerCount: 0,
              totalReward: 0,
              totalEventMoney: 0,
              totalClaimCount: 0,
              createdAt: now.toISOString(),
              updatedAt: now.toISOString(),
            };
            await statsRef.doc(statsDocId).set(newStats);
            statsList = [newStats];
          } else {
            statsList = statsQuery.docs.map((doc) => doc.data());
          }

          const aggregated = statsList.reduce(
            (acc, stat) => {
              acc.claimCount += stat.claimCount || 0;
              acc.totalReward += stat.totalReward || 0;
              acc.totalEventMoney += stat.totalEventMoney || 0;
              acc.totalClaimCount += stat.totalClaimCount || 0;
              acc.flyerCount += stat.flyerCount || 0;
              acc.couponDownloadCount += stat.couponDownloadCount || 0;
              return acc;
            },
            {
              claimCount: 0,
              totalReward: 0,
              totalEventMoney: 0,
              totalClaimCount: 0,
              flyerCount: 0,
              couponDownloadCount: 0,
            },
          );
          companyInfo.stats = {
            year,
            claimCount: aggregated.claimCount,
            totalReward: aggregated.totalReward,
            couponDownloadCount: aggregated.couponDownloadCount,
            months: aggregated.months,
            monthly: statsList,
          };
        }
      }

      const tokenPayload = {
        userId: staffDoc.id,
        username: staffData.username,
        displayName: staffData.displayName,
        role: staffData.role,
        companyId: staffData.companyId,
        locale: staffData.profile?.locale || null,
      };

      const token = jwt.sign(tokenPayload, JWT_SECRET, JWT_OPTIONS);

      await db.collection("staffs").doc(staffDoc.id).update({
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      res.status(200).json({
        success: true,
        message: "Staff login successful",
        data: {
          token,
          user: {
            id: staffDoc.id,
            username: staffData.username,
            displayName: staffData.displayName,
            role: staffData.role,
            companyId: staffData.companyId,
            locale: staffData.profile?.locale || null,
          },
          company: companyInfo,
        },
      });
    } catch (error) {
      console.error("Error during staff login:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error during staff login",
        error: error.message,
      });
    }
  });

  return router;
};
