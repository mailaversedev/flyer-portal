const express = require("express");

const { authenticateToken } = require("../auth");
const {
  DAILY_FREE_GENERATIONS_PER_COMPANY,
  getLeafletTokenCost,
} = require("../../config/billingConfig");
const { calculateLotteryMetricsFromHkd } = require("../../config/lotteryConfig");
const { scheduleFlyerJob } = require("../../services/flyerJobService");
const { syncCompanyCouponLibraryEntry } = require("../../services/companyCouponLibrary");
const {
  createCompanyWalletIfMissing,
  createCompanyWalletTransaction,
  ensureCompanyWalletInTransaction,
  getCompanyDailyUsage,
} = require("../../services/companyWalletService");

module.exports = function createCreationRouter(context) {
  const {
    admin,
    db,
    MAILAVERSE_COMPANY_NAME,
    MAILAVERSE_COMPANY_ICON,
    roundMoneyAmount,
  } = context;

  const router = express.Router();

  router.post("/flyer/leaflet/consume-tokens", authenticateToken, async (req, res) => {
    try {
      if (req.user?.role === "super-admin") {
        return res.status(200).json({
          success: true,
          data: {
            chargedTokens: 0,
            pricing: null,
            flyerOutputPath: `${req.body?.flyerOutputPath || ""}`.trim(),
            previousBalance: null,
            newBalance: null,
            exempt: true,
          },
        });
      }

      const companyId = req.user?.companyId;
      const flyerOutputPath = `${req.body?.flyerOutputPath || ""}`.trim();

      if (!companyId) {
        return res.status(403).json({
          success: false,
          message: "Flyer generation is available to company users only",
        });
      }

      if (!flyerOutputPath) {
        return res.status(400).json({
          success: false,
          message: "flyerOutputPath is required",
        });
      }

      const companyDoc = await db.collection("companies").doc(companyId).get();

      if (!companyDoc.exists) {
        return res.status(404).json({
          success: false,
          message: "Company not found",
        });
      }

      const companyData = companyDoc.data() || {};
      const pricing = getLeafletTokenCost(req.body?.resolution);
      await createCompanyWalletIfMissing({
        companyId,
        companyName: companyData.name || "",
        companyDisplayName: companyData.companyDisplayName || "",
        initialBalance: 0,
      });
      const todayUsage = await getCompanyDailyUsage(companyId);
      const freeAttemptsUsed = Number(todayUsage.data?.freeGenerationAttemptsUsed) || 0;
      const freeAttemptsRemaining = Math.max(
        0,
        DAILY_FREE_GENERATIONS_PER_COMPANY - freeAttemptsUsed,
      );

      if (freeAttemptsRemaining <= 0) {
        const wallet = await createCompanyWalletIfMissing({
          companyId,
          companyName: companyData.name || "",
          companyDisplayName: companyData.companyDisplayName || "",
          initialBalance: 0,
        });
        const availableTokens = Number(wallet?.data?.balance) || 0;

        if (availableTokens < pricing.tokens) {
          return res.status(402).json({
            success: false,
            message: "Insufficient tokens to complete flyer generation",
            data: {
              requiredTokens: pricing.tokens,
              availableTokens,
              pricing,
              dailyFreeAttemptsRemaining: freeAttemptsRemaining,
            },
          });
        }
      }

      const timestamp = new Date().toISOString();
      const billingResult = await db.runTransaction(async (transaction) => {
        const dailyUsage = await getCompanyDailyUsage(companyId, { transaction });
        const currentFreeAttemptsUsed =
          Number(dailyUsage.data?.freeGenerationAttemptsUsed) || 0;
        const currentFreeAttemptsRemaining = Math.max(
          0,
          DAILY_FREE_GENERATIONS_PER_COMPANY - currentFreeAttemptsUsed,
        );
        const currentWallet = await ensureCompanyWalletInTransaction({
          transaction,
          companyId,
          companyName: companyData.name || "",
          companyDisplayName: companyData.companyDisplayName || "",
          initialBalance: 0,
          timestamp,
        });

        if (currentFreeAttemptsRemaining > 0) {
          transaction.set(
            dailyUsage.ref,
            {
              companyId,
              dateKey: dailyUsage.dateKey,
              freeGenerationAttemptsUsed: currentFreeAttemptsUsed + 1,
              freeGenerationAttemptsLimit: DAILY_FREE_GENERATIONS_PER_COMPANY,
              updatedAt: timestamp,
              createdAt: dailyUsage.data?.createdAt || timestamp,
            },
            { merge: true },
          );

          createCompanyWalletTransaction({
            transaction,
            walletId: (currentWallet.ref || currentWallet.doc.ref).id,
            companyId,
            type: "FREE",
            amount: 0,
            previousBalance: Number(currentWallet.data.balance) || 0,
            newBalance: Number(currentWallet.data.balance) || 0,
            description: `${pricing.title} free daily attempt`,
            timestamp,
            metadata: {
              source: "leaflet_generation_free_attempt",
              resolution: pricing.resolution,
              productCode: pricing.code,
              flyerOutputPath,
              freeAttemptsUsed: currentFreeAttemptsUsed + 1,
              freeAttemptsRemaining: Math.max(
                0,
                DAILY_FREE_GENERATIONS_PER_COMPANY -
                  (currentFreeAttemptsUsed + 1),
              ),
            },
          });

          return {
            previousBalance: Number(currentWallet.data.balance) || 0,
            newBalance: Number(currentWallet.data.balance) || 0,
            chargedTokens: 0,
            usedFreeAttempt: true,
            dailyFreeAttemptsUsed: currentFreeAttemptsUsed + 1,
            dailyFreeAttemptsRemaining: Math.max(
              0,
              DAILY_FREE_GENERATIONS_PER_COMPANY -
                (currentFreeAttemptsUsed + 1),
            ),
          };
        }

        const currentBalance = Number(currentWallet.data.balance) || 0;

        if (currentBalance < pricing.tokens) {
          throw new Error("__INSUFFICIENT_TOKENS__");
        }

        const newBalance = currentBalance - pricing.tokens;
        const walletRef = currentWallet.ref || currentWallet.doc.ref;

        transaction.set(
          walletRef,
          {
            companyName: companyData.name || currentWallet.data.companyName || "",
            companyDisplayName:
              companyData.companyDisplayName ||
              currentWallet.data.companyDisplayName ||
              "",
            balance: newBalance,
            updatedAt: timestamp,
            version: (Number(currentWallet.data.version) || 0) + 1,
          },
          { merge: true },
        );

        createCompanyWalletTransaction({
          transaction,
          walletId: walletRef.id,
          companyId,
          type: "DEDUCT",
          amount: pricing.tokens,
          previousBalance: currentBalance,
          newBalance,
          description: `${pricing.title} generation`,
          timestamp,
          metadata: {
            source: "leaflet_generation",
            resolution: pricing.resolution,
            productCode: pricing.code,
            flyerOutputPath,
          },
        });

        return {
          previousBalance: currentBalance,
          newBalance,
          chargedTokens: pricing.tokens,
          usedFreeAttempt: false,
          dailyFreeAttemptsUsed: currentFreeAttemptsUsed,
          dailyFreeAttemptsRemaining: currentFreeAttemptsRemaining,
        };
      });

      return res.status(200).json({
        success: true,
        data: {
          chargedTokens: billingResult.chargedTokens,
          pricing,
          flyerOutputPath,
          ...billingResult,
        },
      });
    } catch (error) {
      if (error.message === "__INSUFFICIENT_TOKENS__") {
        return res.status(402).json({
          success: false,
          message: "Insufficient tokens to complete flyer generation",
        });
      }

      console.error("Error consuming leaflet tokens:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to deduct leaflet tokens",
        error: error.message,
      });
    }
  });

  router.post("/flyer", authenticateToken, async (req, res) => {
    try {
      const { type, data } = req.body;
      const isSuperAdmin = req.user?.role === "super-admin";
      const noReward = isSuperAdmin && Boolean(data?.targetBudget?.noReward);

      const flyerRef = db.collection("flyers").doc();
      const flyerData = {
        type,
        ...data,
        createdAt: new Date().toISOString(),
        status: "active",
        noReward,
        hideCompanyDetail: isSuperAdmin,
      };
      flyerData.companyId = req.user.companyId || null;

      try {
        if (isSuperAdmin) {
          flyerData.companyDisplayName = MAILAVERSE_COMPANY_NAME;
          flyerData.companyName = MAILAVERSE_COMPANY_NAME;
          flyerData.companyIcon = MAILAVERSE_COMPANY_ICON;
        } else if (flyerData.companyId) {
          const companyDoc = await db
            .collection("companies")
            .doc(flyerData.companyId)
            .get();
          if (companyDoc.exists) {
            const companyInfo = companyDoc.data();
            flyerData.companyIcon = companyInfo.icon;
            flyerData.companyDisplayName =
              companyInfo.companyDisplayName || companyInfo.displayName || null;
            flyerData.companyName = companyInfo.name;
            flyerData.companyNature = companyInfo.nature;
            if (companyInfo.district) {
              flyerData.targetBudget = flyerData.targetBudget || {};
              flyerData.targetBudget.district = companyInfo.district;
            }
          }
        }
      } catch (error) {
        console.warn("Failed to fetch company info during flyer creation:", error);
      }

      let pool = 0;
      let eventCostPercent = 0;
      let eventUsagePercent = 0;
      let finalPool = 0;
      let maxUsers = 0;
      let lotteryEvent = null;

      if (!noReward) {
        const poolHkd = Number(data?.targetBudget?.budget) || 5000;
        const lotteryMetrics = calculateLotteryMetricsFromHkd(
          poolHkd,
          flyerData.companyNature,
        );
        pool = lotteryMetrics.pool;
        eventCostPercent = lotteryMetrics.eventCostPercent;
        eventUsagePercent = lotteryMetrics.eventUsagePercent;
        finalPool = lotteryMetrics.finalPool;
        maxUsers = lotteryMetrics.maxUsers;

        flyerData.lottery = {
          lotteryMoney: lotteryMetrics.lotteryMoney,
          maxUsers: lotteryMetrics.maxUsers,
          userReached: lotteryMetrics.userReached,
          remaining: lotteryMetrics.lotteryMoney,
          claims: 0,
          unit: "mailcoin",
          mailcoinHkdRate: lotteryMetrics.mailcoinHkdRate,
        };

        lotteryEvent = {
          pool: lotteryMetrics.pool,
          spreadingCoefficient: lotteryMetrics.spreadingCoefficient,
          lotteryFactor: lotteryMetrics.lotteryFactor,
          eventCostPercent: lotteryMetrics.eventCostPercent,
          eventUsagePercent: lotteryMetrics.eventUsagePercent,
          userReached: lotteryMetrics.userReached,
          finalPool: lotteryMetrics.finalPool,
          maxUsers: lotteryMetrics.maxUsers,
          eventMoney: lotteryMetrics.eventMoney,
          lotteryMoney: lotteryMetrics.lotteryMoney,
          claims: 0,
          remaining: lotteryMetrics.lotteryMoney,
          unit: "mailcoin",
          mailcoinHkdRate: lotteryMetrics.mailcoinHkdRate,
          createdAt: new Date().toISOString(),
          status: "active",
        };
      }

      let statsRef = null;
      let statsYear = null;
      let statsMonth = null;

      if (flyerData.companyId) {
        const date = new Date();
        statsYear = date.getFullYear();
        statsMonth = date.getMonth() + 1;
        const statsDocId = `${statsYear}-${String(statsMonth).padStart(2, "0")}`;

        statsRef = db
          .collection("companies")
          .doc(flyerData.companyId)
          .collection("statistics")
          .doc(statsDocId);
      }

      await db.runTransaction(async (transaction) => {
        let statsDoc = null;
        let currentWallet = null;

        if (statsRef) {
          statsDoc = await transaction.get(statsRef);
        }

        if (!isSuperAdmin && !noReward && flyerData.companyId) {
          currentWallet = await ensureCompanyWalletInTransaction({
            transaction,
            companyId: flyerData.companyId,
            companyName: flyerData.companyName || "",
            companyDisplayName: flyerData.companyDisplayName || "",
            initialBalance: 0,
          });
        }

        transaction.set(flyerRef, flyerData);

        if (flyerData.companyId) {
          await syncCompanyCouponLibraryEntry({
            db,
            companyId: flyerData.companyId,
            flyerId: flyerRef.id,
            flyerData,
            transaction,
          });
        }

        if (lotteryEvent) {
          const lotteryRef = db.collection("lottery").doc(flyerRef.id);
          transaction.set(lotteryRef, lotteryEvent);
        }

        if (statsRef) {
          if (statsDoc && statsDoc.exists) {
            const statsUpdate = {
              flyerCount: admin.firestore.FieldValue.increment(1),
              updatedAt: new Date().toISOString(),
            };

            if (!noReward) {
              statsUpdate.totalClaimCount =
                admin.firestore.FieldValue.increment(maxUsers);
              statsUpdate.totalEventMoney =
                admin.firestore.FieldValue.increment(finalPool);
            }

            transaction.update(statsRef, statsUpdate);
          } else {
            transaction.set(statsRef, {
              year: statsYear,
              month: statsMonth,
              flyerCount: 1,
              totalClaimCount: noReward ? 0 : maxUsers,
              totalEventMoney: noReward ? 0 : finalPool,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        }

        if (currentWallet) {
          const budgetHkd = roundMoneyAmount(Number(data?.targetBudget?.budget) || 0);
          const currentCreditBalanceHkd =
            Number(currentWallet.data.creditBalanceHkd) || 0;

          if (budgetHkd > 0 && currentCreditBalanceHkd >= budgetHkd) {
            const newCreditBalanceHkd = roundMoneyAmount(
              currentCreditBalanceHkd - budgetHkd,
            );
            const walletRef = currentWallet.ref || currentWallet.doc.ref;

            transaction.set(
              walletRef,
              {
                companyName:
                  flyerData.companyName || currentWallet.data.companyName || "",
                companyDisplayName:
                  flyerData.companyDisplayName ||
                  currentWallet.data.companyDisplayName ||
                  "",
                creditBalanceHkd: newCreditBalanceHkd,
                updatedAt: new Date().toISOString(),
                version: (Number(currentWallet.data.version) || 0) + 1,
              },
              { merge: true },
            );

            createCompanyWalletTransaction({
              transaction,
              walletId: walletRef.id,
              companyId: flyerData.companyId,
              type: "DEDUCT",
              amount: budgetHkd,
              previousBalance: currentCreditBalanceHkd,
              newBalance: newCreditBalanceHkd,
              balanceField: "creditBalanceHkd",
              unit: "HKD",
              description: `${type} flyer budget allocation`,
              metadata: {
                source: "flyer_budget_credit",
                flyerId: flyerRef.id,
                flyerType: type,
                budgetHkd,
              },
            });
          }
        }
      });

      const distributionAmount = noReward
        ? 0
        : Math.max(
            0,
            Math.floor(pool * (1 - eventUsagePercent) * (1 - eventCostPercent)),
          );

      let amountPerUser = 0;
      if (distributionAmount > 0) {
        const countSnapshot = await db
          .collection("users")
          .where("isActive", "==", true)
          .count()
          .get();

        const activeUsersCount = Math.max(countSnapshot.data().count, maxUsers);
        if (activeUsersCount > 0) {
          amountPerUser = Math.floor(distributionAmount / activeUsersCount);
        }
      }

      res.status(201).json({
        success: true,
        flyerId: flyerRef.id,
        type,
        message: `${type} flyer created successfully`,
        data: flyerData,
      });

      scheduleFlyerJob({
        flyerId: flyerRef.id,
        flyerType: type,
        flyerHeader: flyerData.header || "",
        companyIcon: flyerData.companyIcon || null,
        amountPerUser,
      }).catch((flyerJobError) => {
        console.error("Failed to schedule flyer job:", flyerJobError);
      });
    } catch (error) {
      console.error("Error creating flyer:", error);
      res.status(400).json({
        success: false,
        message: "Failed to create flyer",
        error: error.message,
      });
    }
  });

  router.put("/flyer/:flyerId", authenticateToken, async (req, res) => {
    try {
      const { flyerId } = req.params;
      const { data = {} } = req.body || {};
      const isSuperAdmin = req.user?.role === "super-admin";

      if (!flyerId) {
        return res.status(400).json({
          success: false,
          message: "Missing flyerId",
        });
      }

      const flyerRef = db.collection("flyers").doc(flyerId);
      const now = new Date().toISOString();

      await db.runTransaction(async (transaction) => {
        const flyerDoc = await transaction.get(flyerRef);

        if (!flyerDoc.exists) {
          throw new Error("__FLYER_NOT_FOUND__");
        }

        const existingFlyer = flyerDoc.data() || {};

        if (
          !isSuperAdmin &&
          existingFlyer.companyId &&
          existingFlyer.companyId !== req.user.companyId
        ) {
          throw new Error("__FORBIDDEN__");
        }

        const editableFieldsByType = {
          leaflet: [
            "header",
            "adContent",
            "tags",
          ],
          query: [],
          qr: [
            "adType",
            "location",
            "website",
            "startingDate",
            "header",
            "productDescriptions",
            "promotionMessage",
          ],
        };

        const editableFields = editableFieldsByType[existingFlyer.type] || [];
        const filteredData = Object.fromEntries(
          Object.entries(data).filter(([key]) => editableFields.includes(key)),
        );

        if (Object.keys(filteredData).length === 0) {
          throw new Error("__NO_EDITABLE_FIELDS__");
        }

        const flyerUpdate = {
          ...filteredData,
          updatedAt: now,
        };

        transaction.set(flyerRef, flyerUpdate, { merge: true });
      });

      const updatedFlyerDoc = await flyerRef.get();

      res.status(200).json({
        success: true,
        message: "Flyer updated successfully",
        data: {
          id: updatedFlyerDoc.id,
          ...updatedFlyerDoc.data(),
        },
      });
    } catch (error) {
      if (error.message === "__FLYER_NOT_FOUND__") {
        return res.status(404).json({
          success: false,
          message: "Flyer not found",
        });
      }

      if (error.message === "__FORBIDDEN__") {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to update this flyer",
        });
      }

      if (error.message === "__NO_EDITABLE_FIELDS__") {
        return res.status(400).json({
          success: false,
          message: "No editable flyer fields were provided",
        });
      }

      console.error("Error updating flyer:", error);
      res.status(400).json({
        success: false,
        message: "Failed to update flyer",
        error: error.message,
      });
    }
  });

  return router;
};
