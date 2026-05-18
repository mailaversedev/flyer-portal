const express = require("express");
const admin = require("firebase-admin");
const multer = require("multer");

const { authenticateToken } = require("./auth");
const { getLeafletTokenCost } = require("../config/billingConfig");
const { calculateLotteryMetricsFromHkd } = require("../config/lotteryConfig");
const {
  processQueuedFlyerJobs,
  cleanupExpiredFlyerJobs,
  scheduleFlyerJob,
} = require("../services/flyerJobService");
const {
  isCompanyCouponAvailable,
  mapCompanyCouponDoc,
  syncCompanyCouponLibraryEntry,
} = require("../services/companyCouponLibrary");
const {
  createCompanyWalletIfMissing,
  createCompanyWalletTransaction,
  ensureCompanyWalletInTransaction,
} = require("../services/companyWalletService");

const router = express.Router();
const db = admin.firestore();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});
const MAILAVERSE_COMPANY_NAME = "Mailaverse";
const MAILAVERSE_COMPANY_ICON = "https://static.wixstatic.com/media/255d46_b08eb7f7e1134cd8b8d5758d0ab3d99e~mv2.png/v1/fill/w_61,h_55,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/Mailaverse%20Logo.png";
const PRO_LEAFLET_GENERATION_ENDPOINT =
  "https://flyergenie-backend-pro-91102396327.europe-west1.run.app/api/generate-image";

const appendUploadedFile = (formData, fieldName, file) => {
  if (!file) {
    return;
  }

  formData.append(
    fieldName,
    new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" }),
    file.originalname || `${fieldName}.bin`,
  );
};

const appendRemoteImage = async (formData, fieldName, remoteUrl, fallbackName) => {
  if (!remoteUrl) {
    return;
  }

  try {
    const response = await fetch(remoteUrl);

    if (!response.ok) {
      return;
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const arrayBuffer = await response.arrayBuffer();

    formData.append(
      fieldName,
      new Blob([arrayBuffer], { type: contentType }),
      fallbackName,
    );
  } catch (error) {
    console.warn(`Failed to fetch remote asset for ${fieldName}:`, error);
  }
};

async function processFlyerJobsHandler(req, res) {
  try {
    const secret = req.header("x-job-secret");
    const expectedSecret = process.env.NOTIFICATION_JOB_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized worker request",
      });
    }

    const maxJobs = Math.max(1, Math.min(20, Number(req.body?.maxJobs) || 3));
    const [processResult, cleanupResult] = await Promise.all([
      processQueuedFlyerJobs(maxJobs),
      cleanupExpiredFlyerJobs(500),
    ]);

    res.status(200).json({
      success: true,
      data: {
        ...processResult,
        deletedExpired: cleanupResult.deleted,
      },
    });
  } catch (error) {
    console.error("Error running flyer job worker:", error);
    res.status(500).json({
      success: false,
      message: "Failed to run flyer job worker",
      error: error.message,
    });
  }
}

router.post("/flyer-jobs/process", processFlyerJobsHandler);
router.post("/notification-jobs/process", processFlyerJobsHandler);

router.post(
  "/flyer/leaflet/generate",
  authenticateToken,
  upload.fields([
    { name: "logoImage", maxCount: 1 },
    { name: "referenceFlyer", maxCount: 1 },
    { name: "productPhoto", maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(403).json({
          success: false,
          message: "Flyer generation is available to company users only",
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
          message: `Insufficient tokens. ${pricing.title} requires ${pricing.tokens} token${pricing.tokens > 1 ? "s" : ""}.`,
          data: {
            requiredTokens: pricing.tokens,
            availableTokens,
            pricing,
          },
        });
      }

      const files = req.files || {};
      const upstreamFormData = new FormData();

      upstreamFormData.append("Product_Name", req.body?.productName || "");
      upstreamFormData.append("Query_Context", req.body?.flyerPrompts || "");
      upstreamFormData.append("Aspect_Ratio", req.body?.aspectRatio || "1:1");
      upstreamFormData.append("Resolution", pricing.resolution);
      upstreamFormData.append(
        "Logo_Position",
        req.body?.logoPosition || "natural placement",
      );
      upstreamFormData.append("Copy_Line", req.body?.header || "");
      upstreamFormData.append(
        "Copy_Position",
        req.body?.copyPosition || "natural placement",
      );
      upstreamFormData.append("Body_Copy", req.body?.bodyCopy || "");
      upstreamFormData.append(
        "Body_Copy_Position",
        req.body?.bodyCopyPosition || "natural placement",
      );

      if (req.body?.primaryColor) {
        upstreamFormData.append("Primary_Color", req.body.primaryColor);
      }
      if (req.body?.secondaryColor) {
        upstreamFormData.append("Secondary_Color", req.body.secondaryColor);
      }
      if (req.body?.typography) {
        upstreamFormData.append("Typography", req.body.typography);
      }
      if (req.body?.brandVoice) {
        upstreamFormData.append("Brand_Voice", req.body.brandVoice);
      }
      if (req.body?.campaignMoodboard) {
        upstreamFormData.append("Campaign_Moodboard", req.body.campaignMoodboard);
      }

      appendUploadedFile(upstreamFormData, "logo_image", files.logoImage?.[0]);
      if (!files.logoImage?.[0]) {
        await appendRemoteImage(
          upstreamFormData,
          "logo_image",
          companyData.icon,
          `${companyId}.png`,
        );
      }

      appendUploadedFile(
        upstreamFormData,
        "reference_image_file",
        files.referenceFlyer?.[0],
      );
      appendUploadedFile(upstreamFormData, "product_image", files.productPhoto?.[0]);

      const upstreamResponse = await fetch(PRO_LEAFLET_GENERATION_ENDPOINT, {
        method: "POST",
        body: upstreamFormData,
      });

      if (!upstreamResponse.ok) {
        const upstreamError = await upstreamResponse.text();
        throw new Error(
          `Flyer generation failed: ${upstreamResponse.status} ${upstreamResponse.statusText}${upstreamError ? ` - ${upstreamError}` : ""}`,
        );
      }

      const generationResult = await upstreamResponse.json();

      if (!generationResult.image_urls || generationResult.image_urls.length === 0) {
        throw new Error("Flyer generation did not return any image output");
      }

      const timestamp = new Date().toISOString();
      const billingResult = await db.runTransaction(async (transaction) => {
        const currentWallet = await ensureCompanyWalletInTransaction({
          transaction,
          companyId,
          companyName: companyData.name || "",
          companyDisplayName: companyData.companyDisplayName || "",
          initialBalance: 0,
          timestamp,
        });
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
          },
        });

        return {
          previousBalance: currentBalance,
          newBalance,
        };
      });

      return res.status(200).json({
        success: true,
        flyer_output_path: generationResult.image_urls[0],
        billing: {
          chargedTokens: pricing.tokens,
          pricing,
          ...billingResult,
        },
        ...generationResult,
      });
    } catch (error) {
      if (error.message === "__INSUFFICIENT_TOKENS__") {
        return res.status(402).json({
          success: false,
          message: "Insufficient tokens to complete flyer generation",
        });
      }

      console.error("Error generating leaflet via backend:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to generate leaflet",
        error: error.message,
      });
    }
  },
);

// POST /api/flyer - Create flyer (leaflet, query, or qr code)
router.post("/flyer", authenticateToken, async (req, res) => {
  try {
    const { type, data } = req.body;
    const isSuperAdmin = req.user?.role === "super-admin";
    const noReward = isSuperAdmin && Boolean(data?.targetBudget?.noReward);

    // 1. Prepare Flyer Data
    // Generate ID first so we can use it in the transaction
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

    // Fetch company info to embed in flyer (denormalization)
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
        }
      }
    } catch (error) {
      console.warn(
        "Failed to fetch company info during flyer creation:",
        error,
      );
      // Continue without it, don't fail the whole creation
    }

    // 2. Prepare Lottery Data
    let pool = 0;
    let eventCostPercent = 0;
    let eventUsagePercent = 0;
    let finalPool = 0;
    let maxUsers = 0;
    let lotteryEvent = null;

    if (!noReward) {
      const poolHkd = data?.targetBudget?.budget || 5000;
      const lotteryMetrics = calculateLotteryMetricsFromHkd(poolHkd);
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

    // 3. Prepare Stats Data (if applicable)
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

    // 4. Execute Core Transaction (Flyer + Lottery + Stats)
    await db.runTransaction(async (transaction) => {
      // Reads must come before writes
      let statsDoc = null;
      if (statsRef) {
        statsDoc = await transaction.get(statsRef);
      }

      // Create Flyer
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

      // Create Lottery Event
      if (lotteryEvent) {
        const lotteryRef = db.collection("lottery").doc(flyerRef.id);
        transaction.set(lotteryRef, lotteryEvent);
      }

      // Update Stats (if applicable)
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
    });

    // 5. Calculate distribution amount correctly using count() to avoid fetching all documents.
    // The actual wallet distribution will now happen asynchronously in the flyer job background worker.
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

      /**
       * to handle small user base where count can be less than maxUsers,
       * we take the max of both to ensure the distribution amount is not too large per user.
       */
      const activeUsersCount = Math.max(countSnapshot.data().count, maxUsers);
      if (activeUsersCount > 0) {
        amountPerUser = Math.floor(distributionAmount / activeUsersCount);
      }
    }

    const response = {
      success: true,
      flyerId: flyerRef.id,
      type: type,
      message: `${type} flyer created successfully`,
      data: flyerData,
    };

    res.status(201).json(response);

    scheduleFlyerJob({
      flyerId: flyerRef.id,
      flyerType: type,
      flyerHeader: flyerData.header || "",
      companyIcon: flyerData.companyIcon || null,
      amountPerUser: amountPerUser,
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

// PUT /api/flyer/:flyerId - Update flyer details
router.put("/flyer/:flyerId", authenticateToken, async (req, res) => {
  try {
    const { flyerId } = req.params;
    const { data = {} } = req.body || {};

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
        existingFlyer.companyId &&
        existingFlyer.companyId !== req.user.companyId
      ) {
        throw new Error("__FORBIDDEN__");
      }

      const editableFieldsByType = {
        leaflet: [
          "header",
          "subheader",
          "adContent",
          "promotionMessage",
          "productDescriptions",
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

// GET /api/company/:companyId - Get single company by ID
router.get("/company/:companyId", async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Missing companyId",
      });
    }

    const companyDoc = await db.collection("companies").doc(companyId).get();
    if (!companyDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const company = companyDoc.data() || {};

    res.status(200).json({
      success: true,
      data: {
        id: companyDoc.id,
        companyDisplayName:
          typeof company.companyDisplayName === "string"
            ? company.companyDisplayName
            : typeof company.displayName === "string"
              ? company.displayName
              : null,
        name: company.name || "",
        icon: company.icon || null,
        address: company.address || null,
        contact: company.contact || null,
        nature: company.nature || null,
        coverPhotos: Array.isArray(company.coverPhotos)
          ? company.coverPhotos
              .filter((photo) => typeof photo === "string" && photo.trim())
              .slice(0, 5)
          : [],
        introduction:
          typeof company.introduction === "string" ? company.introduction : null,
        website: typeof company.website === "string" ? company.website : null,
        createdAt: company.createdAt || null,
        updatedAt: company.updatedAt || null,
        isActive: typeof company.isActive === "boolean" ? company.isActive : true,
      },
    });
  } catch (error) {
    console.error("Error fetching company by ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch company",
      error: error.message,
    });
  }
});

// GET /api/company/me/coupons - Get reusable coupons for the authenticated company
router.get("/company/me/coupons", authenticateToken, async (req, res) => {
  try {
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    const snapshot = await db
      .collection("companies")
      .doc(companyId)
      .collection("coupons")
      .orderBy("updatedAt", "desc")
      .get();

    res.status(200).json({
      success: true,
      data: snapshot.docs.map((doc) => mapCompanyCouponDoc(doc)),
    });
  } catch (error) {
    console.error("Error fetching company coupons:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch company coupons",
      error: error.message,
    });
  }
});

// GET /api/company/:companyId/coupons - Get public company coupon library
router.get("/company/:companyId/coupons", async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Missing companyId",
      });
    }

    const companyDoc = await db.collection("companies").doc(companyId).get();
    if (!companyDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    const snapshot = await db
      .collection("companies")
      .doc(companyId)
      .collection("coupons")
      .orderBy("updatedAt", "desc")
      .get();

    const coupons = snapshot.docs
      .map((doc) => mapCompanyCouponDoc(doc))
      .filter((coupon) => isCompanyCouponAvailable(coupon));

    res.status(200).json({
      success: true,
      data: coupons,
    });
  } catch (error) {
    console.error("Error fetching company coupon library:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch company coupons",
      error: error.message,
    });
  }
});

// GET /api/flyer/:flyerId - Get single flyer by ID
router.get("/flyer/:flyerId", authenticateToken, async (req, res) => {
  try {
    const { flyerId } = req.params;

    if (!flyerId) {
      return res.status(400).json({
        success: false,
        message: "Missing flyerId",
      });
    }

    const flyerDoc = await db.collection("flyers").doc(flyerId).get();
    if (!flyerDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Flyer not found",
      });
    }

    const flyerData = flyerDoc.data() || {};

    if (flyerData.companyId && flyerData.companyId !== req.user.companyId) {
      return res.status(404).json({
        success: false,
        message: "Flyer not found",
      });
    }

    const flyer = {
      id: flyerDoc.id,
      ...flyerData,
    };

    try {
      const lotteryDoc = await db.collection("lottery").doc(flyerId).get();
      if (lotteryDoc.exists) {
        flyer.lottery = lotteryDoc.data();
      }
    } catch (lotteryError) {
      console.warn("Error fetching lottery metadata for single flyer:", lotteryError);
    }

    res.status(200).json({
      success: true,
      data: flyer,
    });
  } catch (error) {
    console.error("Error fetching flyer by ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch flyer",
      error: error.message,
    });
  }
});

// GET /api/flyers - Get all flyers with pagination and sorting
router.get("/flyers", async (req, res) => {
  try {
    const {
      limit = "100",
      after,
      sortBy = "createdAt",
      direction = "desc",
      companyId,
    } = req.query;

    // Convert limit to number and validate
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 1000) {
      return res.status(400).json({
        success: false,
        message: "Invalid limit. Must be a number between 1 and 1000.",
      });
    }

    // Validate direction
    if (!["asc", "desc"].includes(direction.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid direction. Must be "asc" or "desc".',
      });
    }

    // Valid sortBy fields
    const validSortFields = ["createdAt", "updatedAt", "type", "status"];
    if (!validSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sortBy field. Must be one of: ${validSortFields.join(
          ", ",
        )}.`,
      });
    }

    let query = db.collection("flyers");

    if (companyId) {
      query = query.where("companyId", "==", companyId);
    }

    // Apply sorting
    query = query.orderBy(sortBy, direction.toLowerCase());

    // Apply cursor-based pagination if 'after' is provided
    if (after) {
      try {
        const afterDoc = await db.collection("flyers").doc(after).get();
        if (!afterDoc.exists) {
          return res.status(400).json({
            success: false,
            message: "Invalid cursor. Document not found.",
          });
        }
        query = query.startAfter(afterDoc);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid cursor format.",
        });
      }
    }

    // Apply limit
    query = query.limit(limitNum);

    // Execute query
    const snapshot = await query.get();

    const flyers = [];
    snapshot.forEach((doc) => {
      flyers.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Fetch related lottery metadata
    if (flyers.length > 0) {
      try {
        const lotteryRefs = flyers.map((flyer) =>
          db.collection("lottery").doc(flyer.id),
        );
        const lotterySnapshots = await db.getAll(...lotteryRefs);

        lotterySnapshots.forEach((lotteryDoc, index) => {
          if (lotteryDoc.exists) {
            flyers[index].lottery = lotteryDoc.data();
          }
        });
      } catch (err) {
        console.warn("Error fetching lottery metadata:", err);
        // gracefully continue without lottery data
      }
    }

    // Get the last document for next cursor (if there are results)
    let nextCursor = null;
    if (flyers.length === limitNum && flyers.length > 0) {
      nextCursor = flyers[flyers.length - 1].id;
    }

    const response = {
      success: true,
      data: flyers,
      pagination: {
        nextCursor: nextCursor,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching flyers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch flyers",
      error: error.message,
    });
  }
});

// POST /api/flyer/:flyerId/answers - Submit survey answers
router.post("/flyer/:flyerId/answers", authenticateToken, async (req, res) => {
  try {
    const { flyerId } = req.params;
    const { answers } = req.body;

    if (!flyerId || !answers) {
      return res.status(400).json({
        success: false,
        message: "Missing flyerId or answers",
      });
    }

    const answerRef = db
      .collection("flyers")
      .doc(flyerId)
      .collection("answers")
      .doc(req.user.userId);

    const timestamp = new Date().toISOString();
    const answerData = {
      flyerId,
      userId: req.user.userId,
      answers,
      updatedAt: timestamp,
    };

    const doc = await answerRef.get();

    if (doc.exists) {
      await answerRef.update(answerData);
    } else {
      answerData.createdAt = timestamp;
      await answerRef.set(answerData);
    }

    res.status(200).json({
      success: true,
      message: "Survey answers submitted successfully",
    });
  } catch (error) {
    console.error("Error submitting survey answers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit survey answers",
      error: error.message,
    });
  }
});

// GET /api/flyer/:flyerId/answer-status - Check if user submitted answer
router.get("/flyer/:flyerId/answer-status", authenticateToken, async (req, res) => {
  try {
    const { flyerId } = req.params;
    const userId = req.user.userId;

    if (!flyerId) {
      return res.status(400).json({
        success: false,
        message: "Missing flyerId",
      });
    }

    const answerDoc = await db
      .collection("flyers")
      .doc(flyerId)
      .collection("answers")
      .doc(userId)
      .get();

    if (answerDoc.exists) {
      res.status(200).json({
        success: true,
        submitted: true,
        data: answerDoc.data(),
      });
    } else {
      res.status(200).json({
        success: true,
        submitted: false,
      });
    }
  } catch (error) {
    console.error("Error checking answer status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check answer status",
      error: error.message,
    });
  }
});

module.exports = router;
