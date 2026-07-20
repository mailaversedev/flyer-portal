const express = require("express");

const {
  enqueueCrmEmailCampaign,
  getCrmContactSummary,
  getCrmEmailCampaign,
  listCrmEmailCampaigns,
} = require("../../services/crmEmailCampaignService");

module.exports = function createCrmRouter(context) {
  const {
    normalizeLimit,
    normalizeString,
    CRM_EMAIL_SUBJECT_MAX_LENGTH,
    CRM_EMAIL_HTML_MAX_LENGTH,
    SIMPLE_EMAIL_RE,
  } = context;

  const router = express.Router();

  router.get("/crm-contacts/summary", async (_req, res) => {
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
      const testRecipientEmail = normalizeString(
        req.body?.testRecipientEmail,
      ).toLowerCase();

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

  return router;
};
