const express = require("express");
const admin = require("firebase-admin");

const { authenticateToken } = require("./auth");
const { serializeVoucher } = require("./voucher");
const {
  enqueueCrmEmailCampaign,
  getCrmContactSummary,
  getCrmEmailCampaign,
  listCrmEmailCampaigns,
} = require("../services/crmEmailCampaignService");
const {
  createCompanyWalletTransaction,
  ensureCompanyWalletInTransaction,
} = require("../services/companyWalletService");

const router = express.Router();
const db = admin.firestore();

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const CRM_EMAIL_SUBJECT_MAX_LENGTH = 160;
const CRM_EMAIL_HTML_MAX_LENGTH = 200000;
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CRM_CONTACTS_COLLECTION = "crm_contacts";
const AUDIENCE_SOURCE_USERS = "users";
const AUDIENCE_SOURCE_CRM = "crm_contacts";

const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== "super-admin") {
    return res.status(403).json({
      success: false,
      message: "Super admin access is required",
    });
  }

  next();
};

const normalizeLimit = (value) => {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
};

const normalizeString = (value) => `${value || ""}`.trim();
const normalizeMoneyAmount = (value) => {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
};

const encodeNextToken = (value) => {
  if (!value) {
    return null;
  }

  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
};

const decodeNextToken = (value) => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch (_error) {
    return null;
  }
};

const buildAudienceQuery = ({ collectionName, direction, limit, cursor }) => {
  let query = db
    .collection(collectionName)
    .orderBy(admin.firestore.FieldPath.documentId(), direction)
    .limit(limit + 1);

  if (cursor?.id) {
    query = query.startAfter(cursor.id);
  }

  return query;
};

const serializeAdminUser = (doc) => {
  const data = doc.data() || {};

  return {
    id: doc.id,
    username: data.username || "",
    displayName: data.displayName || "",
    createdAt: data.createdAt || null,
    lastLoginAt: data.lastLoginAt || null,
    status: data.isActive !== false ? "active" : "inactive",
    location: data.location || null,
    source: "user",
  };
};

const serializeCrmContact = (doc) => {
  const data = doc.data() || {};
  const baseLocation =
    data.location && typeof data.location === "object" ? data.location : {};

  return {
    id: doc.id,
    username: data.email || "",
    displayName: data.name || "",
    createdAt: data.createdAt || null,
    lastLoginAt: null,
    status: "engaged",
    location: {
      countryCity: baseLocation.countryCity || data.countryCity || "",
      district: baseLocation.district || data.district || "",
      buildingEstate:
        baseLocation.buildingEstate ||
        baseLocation.address ||
        data.address ||
        "",
    },
    source: "crm_contact",
  };
};

const fetchAudienceSegment = async ({ source, direction, limit, cursor }) => {
  const collectionName =
    source === AUDIENCE_SOURCE_CRM ? CRM_CONTACTS_COLLECTION : AUDIENCE_SOURCE_USERS;
  const snapshot = await buildAudienceQuery({
    collectionName,
    direction,
    limit,
    cursor,
  }).get();
  const docs = snapshot.docs;
  const hasMore = docs.length > limit;
  const visibleDocs = hasMore ? docs.slice(0, limit) : docs;
  const serialize =
    source === AUDIENCE_SOURCE_CRM ? serializeCrmContact : serializeAdminUser;
  const entries = visibleDocs.map((doc) => serialize(doc));
  const lastDoc = visibleDocs.at(-1);

  return {
    entries,
    hasMore,
    cursor: lastDoc ? { id: lastDoc.id } : null,
  };
};

router.use(authenticateToken, requireSuperAdmin);

router.get("/crm-contacts/summary", async (req, res) => {
  try {
    const summary = await getCrmContactSummary();

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching CRM contact summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch CRM contact summary",
      error: error.message,
    });
  }
});

router.get("/crm-email-campaigns", async (req, res) => {
  try {
    const limit = normalizeLimit(req.query.limit);
    const campaigns = await listCrmEmailCampaigns(limit);

    res.status(200).json({
      success: true,
      data: campaigns,
    });
  } catch (error) {
    console.error("Error fetching CRM email campaigns:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch CRM email campaigns",
      error: error.message,
    });
  }
});

router.get("/crm-email-campaigns/:campaignId", async (req, res) => {
  try {
    const campaign = await getCrmEmailCampaign(req.params.campaignId);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "CRM email campaign not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: campaign,
    });
  } catch (error) {
    console.error("Error fetching CRM email campaign:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch CRM email campaign",
      error: error.message,
    });
  }
});

router.post("/crm-email-campaigns", async (req, res) => {
  try {
    const subject = normalizeString(req.body?.subject);
    const html = `${req.body?.html || ""}`.trim();
    const testRecipientEmail = normalizeString(req.body?.testRecipientEmail).toLowerCase();

    if (!subject) {
      return res.status(400).json({
        success: false,
        message: "Email subject is required",
      });
    }

    if (!html) {
      return res.status(400).json({
        success: false,
        message: "Email HTML template is required",
      });
    }

    if (subject.length > CRM_EMAIL_SUBJECT_MAX_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Email subject must be ${CRM_EMAIL_SUBJECT_MAX_LENGTH} characters or fewer`,
      });
    }

    if (html.length > CRM_EMAIL_HTML_MAX_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Email HTML template must be ${CRM_EMAIL_HTML_MAX_LENGTH} characters or fewer`,
      });
    }

    if (testRecipientEmail && !SIMPLE_EMAIL_RE.test(testRecipientEmail)) {
      return res.status(400).json({
        success: false,
        message: "Test recipient email must be a valid email address",
      });
    }

    const campaign = await enqueueCrmEmailCampaign({
      subject,
      html,
      testRecipientEmail,
      createdBy: {
        id: req.user?.userId || req.user?.id || "",
        username: req.user?.username || "",
        role: req.user?.role || "",
      },
    });

    return res.status(201).json({
      success: true,
      message: testRecipientEmail
        ? "CRM test email queued successfully"
        : "CRM email campaign queued successfully",
      data: campaign,
    });
  } catch (error) {
    console.error("Error creating CRM email campaign:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create CRM email campaign",
      error: error.message,
    });
  }
});

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

router.get("/companies", async (req, res) => {
  try {
    const limit = normalizeLimit(req.query.limit);
    const direction = req.query.direction === "asc" ? "asc" : "desc";

    const snapshot = await db
      .collection("companies")
      .orderBy("createdAt", direction)
      .limit(limit)
      .get();

    const walletSnapshot = await db
      .collection("wallets")
      .where("ownerType", "==", "company")
      .where("isActive", "==", true)
      .get();

    const walletByCompanyId = new Map();
    walletSnapshot.docs.forEach((walletDoc) => {
      const walletData = walletDoc.data() || {};

      if (walletData.companyId && !walletByCompanyId.has(walletData.companyId)) {
        walletByCompanyId.set(walletData.companyId, {
          walletId: walletDoc.id,
          balance: Number(walletData.balance) || 0,
          creditBalanceHkd: Number(walletData.creditBalanceHkd) || 0,
          creditCurrency: walletData.creditCurrency || "HKD",
          updatedAt: walletData.updatedAt || null,
        });
      }
    });

    const companies = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      const wallet = walletByCompanyId.get(doc.id) || null;

      return {
        id: doc.id,
        companyDisplayName: data.companyDisplayName || "",
        name: data.name || "",
        nature: data.nature || "",
        contact: data.contact || "",
        address: data.address || "",
        website: data.website || "",
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
        isActive: data.isActive !== false,
        walletId: wallet?.walletId || null,
        walletBalance: wallet?.balance || 0,
        walletCreditBalanceHkd: wallet?.creditBalanceHkd || 0,
        walletCreditCurrency: wallet?.creditCurrency || "HKD",
        walletUpdatedAt: wallet?.updatedAt || null,
      };
    });

    res.status(200).json({
      success: true,
      data: companies,
    });
  } catch (error) {
    console.error("Error fetching admin company list:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch companies",
      error: error.message,
    });
  }
});

router.post("/companies/:companyId/manage-wallet", async (req, res) => {
  try {
    const { companyId } = req.params;
    const amountHkd = normalizeMoneyAmount(req.body?.amountHkd ?? req.body?.amount);
    const note = normalizeString(req.body?.note);
    const receiptImageUrl = normalizeString(req.body?.receiptImageUrl);

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Company ID is required",
      });
    }

    if (!amountHkd) {
      return res.status(400).json({
        success: false,
        message: "Grant amount must be a positive HKD value",
      });
    }

    if (!receiptImageUrl) {
      return res.status(400).json({
        success: false,
        message: "Receipt image is required",
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
    const timestamp = new Date().toISOString();

    const result = await db.runTransaction(async (transaction) => {
      const wallet = await ensureCompanyWalletInTransaction({
        transaction,
        companyId,
        companyName: companyData.name || "",
        companyDisplayName: companyData.companyDisplayName || "",
        initialBalance: 0,
        timestamp,
      });
      const walletRef = wallet.ref || wallet.doc.ref;
      const previousBalance = Number(wallet.data.balance) || 0;
      const previousCreditBalanceHkd = Number(wallet.data.creditBalanceHkd) || 0;
      const newCreditBalanceHkd = previousCreditBalanceHkd + amountHkd;

      transaction.set(
        walletRef,
        {
          companyName: companyData.name || wallet.data.companyName || "",
          companyDisplayName:
            companyData.companyDisplayName ||
            wallet.data.companyDisplayName ||
            "",
          creditBalanceHkd: newCreditBalanceHkd,
          updatedAt: timestamp,
          version: (Number(wallet.data.version) || 0) + 1,
        },
        { merge: true },
      );

      createCompanyWalletTransaction({
        transaction,
        walletId: walletRef.id,
        companyId,
        type: "ADD",
        amount: amountHkd,
        previousBalance: previousCreditBalanceHkd,
        newBalance: newCreditBalanceHkd,
        balanceField: "creditBalanceHkd",
        unit: "HKD",
        description: note || "Offline wallet credit grant",
        timestamp,
        metadata: {
          source: "super_admin_credit_grant",
          grantedBy: req.user?.username || req.user?.userId || "",
          note,
          receiptImageUrl,
          tokenBalanceSnapshot: previousBalance,
        },
      });

      return {
        walletId: walletRef.id,
        previousBalance,
        newBalance: previousBalance,
        previousCreditBalanceHkd,
        newCreditBalanceHkd,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Wallet credit updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error managing company wallet:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update company wallet",
      error: error.message,
    });
  }
});

router.get("/vouchers", async (req, res) => {
  try {
    const limit = normalizeLimit(req.query.limit);
    const direction = req.query.direction === "asc" ? "asc" : "desc";

    const snapshot = await db
      .collection("vouchers")
      .orderBy("createdAt", direction)
      .limit(limit)
      .get();

    res.status(200).json({
      success: true,
      data: snapshot.docs.map((doc) => serializeVoucher(doc)),
    });
  } catch (error) {
    console.error("Error fetching admin voucher list:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch vouchers",
      error: error.message,
    });
  }
});

router.post("/vouchers", async (req, res) => {
  try {
    const {
      value,
      cost,
      merchant,
      merchantIcon,
      expiryDate,
      totalNumber,
      qrCode,
      promotionCode,
      colors,
      terms,
    } = req.body || {};

    const normalizedValue = `${value || ""}`.trim();
    const normalizedMerchant = `${merchant || ""}`.trim();
    const normalizedMerchantIcon = `${merchantIcon || ""}`.trim();
    const normalizedPromotionCode = `${promotionCode || ""}`.trim();
    const normalizedTerms = `${terms || ""}`.trim();
    const normalizedQrCode = `${qrCode || ""}`.trim();
    const normalizedCost = Number.parseInt(cost, 10);
    const normalizedTotalNumber = Number.parseInt(totalNumber, 10);
    const normalizedExpiryDate = `${expiryDate || ""}`.trim();
    const normalizedColors = Array.isArray(colors)
      ? colors
          .map((color) => `${color || ""}`.trim())
          .filter((color) => color.length > 0)
          .slice(0, 4)
      : [];

    if (
      !normalizedValue ||
      !normalizedMerchant ||
      !normalizedTerms
    ) {
      return res.status(400).json({
        success: false,
        message: "Value, merchant, and terms are required",
      });
    }

    if (!Number.isFinite(normalizedCost) || normalizedCost <= 0) {
      return res.status(400).json({
        success: false,
        message: "Cost must be a positive integer",
      });
    }

    if (!Number.isFinite(normalizedTotalNumber) || normalizedTotalNumber <= 0) {
      return res.status(400).json({
        success: false,
        message: "Total number must be a positive integer",
      });
    }

    if (normalizedExpiryDate) {
      const parsedExpiryDate = new Date(normalizedExpiryDate);

      if (Number.isNaN(parsedExpiryDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Expiry date is invalid",
        });
      }
    }

    const timestamp = new Date().toISOString();
    const voucherRef = db.collection("vouchers").doc();
    const voucherData = {
      value: normalizedValue,
      cost: normalizedCost,
      merchant: normalizedMerchant,
      merchantIcon: normalizedMerchantIcon,
      expiryDate: normalizedExpiryDate,
      totalNumber: normalizedTotalNumber,
      qrCode: normalizedQrCode,
      promotionCode: normalizedPromotionCode,
      colors:
        normalizedColors.length > 0
          ? normalizedColors
          : ["#EF3239", "#F76B1C"],
      terms: normalizedTerms,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await voucherRef.set(voucherData);

    const createdVoucher = await voucherRef.get();

    res.status(201).json({
      success: true,
      message: "Voucher created successfully",
      data: serializeVoucher(createdVoucher),
    });
  } catch (error) {
    console.error("Error creating voucher:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create voucher",
      error: error.message,
    });
  }
});

router.get("/flyers", async (req, res) => {
  try {
    const limit = normalizeLimit(req.query.limit);
    const direction = req.query.direction === "asc" ? "asc" : "desc";

    const snapshot = await db
      .collection("flyers")
      .orderBy("createdAt", direction)
      .limit(limit)
      .get();

    const flyers = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (flyers.length > 0) {
      try {
        const lotteryRefs = flyers.map((flyer) => db.collection("lottery").doc(flyer.id));
        const lotterySnapshots = await db.getAll(...lotteryRefs);

        lotterySnapshots.forEach((lotteryDoc, index) => {
          if (lotteryDoc.exists) {
            flyers[index].lottery = lotteryDoc.data();
          }
        });
      } catch (lotteryError) {
        console.warn("Error fetching admin flyer lottery metadata:", lotteryError);
      }
    }

    res.status(200).json({
      success: true,
      data: flyers,
    });
  } catch (error) {
    console.error("Error fetching admin flyer list:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch flyers",
      error: error.message,
    });
  }
});

router.post("/flyers/:flyerId/status", async (req, res) => {
  try {
    const { flyerId } = req.params;
    const nextStatus = normalizeString(req.body?.status).toLowerCase();

    if (!flyerId) {
      return res.status(400).json({
        success: false,
        message: "Flyer ID is required",
      });
    }

    if (!["active", "inactive"].includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status must be active or inactive",
      });
    }

    const flyerRef = db.collection("flyers").doc(flyerId);
    const flyerDoc = await flyerRef.get();

    if (!flyerDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Flyer not found",
      });
    }

    await flyerRef.set(
      {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    const updatedFlyerDoc = await flyerRef.get();

    return res.status(200).json({
      success: true,
      message: "Flyer status updated successfully",
      data: {
        id: updatedFlyerDoc.id,
        ...updatedFlyerDoc.data(),
      },
    });
  } catch (error) {
    console.error("Error updating admin flyer status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update flyer status",
      error: error.message,
    });
  }
});

module.exports = router;