import React, { useCallback, useEffect, useState } from "react";

import { Copy, Eye, Mail, Plus, RefreshCcw } from "lucide-react";

import ApiService from "../../services/ApiService";

export const POLL_INTERVAL_MS = 10000;
export const DEFAULT_TEMPLATE = `
  <section style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 32px 24px; color: #111827;">
    <p style="margin: 0 0 12px; font-size: 14px; letter-spacing: 0.12em; text-transform: uppercase; color: #2563eb;">Mailaverse CRM</p>
    <h1 style="margin: 0 0 16px; font-size: 32px; line-height: 1.2;">Your next campaign starts here</h1>
    <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.7; color: #374151;">Draft your promotional message here. Use the toolbar to style the content and the preview panel to verify the final email layout before you queue the campaign.</p>
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.7; color: #374151;">You can include headings, lists, links, and highlighted offers.</p>
    <ul style="margin: 0; padding-left: 20px; color: #374151; line-height: 1.8;">
      <li>Announce new offers</li>
      <li>Share seasonal promotions</li>
      <li>Drive traffic back to your channels</li>
    </ul>
  </section>
`;

export const EMPTY_PREVIEW_TEMPLATE = `
  <section style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 48px 24px; color: #111827; text-align: center;">
    <h1 style="margin: 0 0 12px; font-size: 28px; line-height: 1.2;">Select a campaign</h1>
    <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #4b5563;">Choose an existing campaign below or open the composer to build a new one.</p>
  </section>
`;

export const EMPTY_SUMMARY = {
  totalContacts: 0,
  eligibleEmailContacts: 0,
};

export const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

export const stripHtml = (html = "") =>
  `${html}`
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

export const buildPreviewDocument = (html) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }

      body {
        min-height: 100vh;
      }
    </style>
  </head>
  <body>
    ${html}
  </body>
</html>`;

export const getStatusLabel = (status) => {
  switch (status) {
    case "processing":
      return "Processing";
    case "completed":
      return "Completed";
    case "completed_with_failures":
      return "Completed with failures";
    case "failed":
      return "Failed";
    case "queued":
    default:
      return "Queued";
  }
};

export const getStatusTone = (status) => {
  switch (status) {
    case "processing":
      return "processing";
    case "completed":
      return "completed";
    case "completed_with_failures":
      return "warning";
    case "failed":
      return "failed";
    case "queued":
    default:
      return "queued";
  }
};

export function useCrmCampaignDashboard() {
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadDashboard = useCallback(async (options = {}) => {
    const { background = false } = options;

    if (!background) {
      setLoading(true);
    }

    try {
      const [summaryResponse, campaignsResponse] = await Promise.all([
        ApiService.getCrmContactSummary(),
        ApiService.getCrmEmailCampaigns(30),
      ]);

      const nextSummary = summaryResponse?.success
        ? summaryResponse.data || EMPTY_SUMMARY
        : EMPTY_SUMMARY;
      const nextCampaigns =
        campaignsResponse?.success && Array.isArray(campaignsResponse.data)
          ? campaignsResponse.data
          : [];

      setSummary(nextSummary);
      setCampaigns(nextCampaigns);
      setSelectedCampaignId((current) => {
        if (nextCampaigns.some((campaign) => campaign.id === current)) {
          return current;
        }

        return nextCampaigns[0]?.id || "";
      });
      setLoadError("");
    } catch (error) {
      console.error("Failed to load CRM campaign data", error);
      if (!background) {
        setLoadError(error.message || "Failed to load CRM campaign data.");
      }
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, []);

  const loadSelectedCampaign = useCallback(async (campaignId) => {
    if (!campaignId) {
      setSelectedCampaign(null);
      return;
    }

    try {
      const response = await ApiService.getCrmEmailCampaign(campaignId);
      if (response?.success) {
        setSelectedCampaign(response.data || null);
      }
    } catch (error) {
      console.error("Failed to load CRM campaign detail", error);
    }
  }, []);

  useEffect(() => {
    loadDashboard();

    const intervalId = window.setInterval(() => {
      loadDashboard({ background: true });
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadDashboard]);

  useEffect(() => {
    loadSelectedCampaign(selectedCampaignId);

    if (!selectedCampaignId) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      loadSelectedCampaign(selectedCampaignId);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadSelectedCampaign, selectedCampaignId]);

  return {
    campaigns,
    loadDashboard,
    loadError,
    loading,
    selectedCampaign,
    selectedCampaignId,
    setSelectedCampaignId,
    summary,
  };
}

export function CrmCampaignHero({ onCreateCampaign, onRefresh }) {
  return (
    <div className="crm-campaigns-hero">
      <div>
        <p className="crm-campaigns-eyebrow">Super Admin CRM</p>
        <h1>CRM Email Campaigns</h1>
        <p className="crm-campaigns-subtitle">
          Review created campaigns first, then open the composer when you are
          ready to draft a new bulk email or queue a single-recipient test.
        </p>
      </div>

      <div className="crm-campaigns-hero-actions">
        <button
          type="button"
          className="crm-campaigns-secondary-button"
          onClick={onRefresh}
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
        {onCreateCampaign ? (
          <button
            type="button"
            className="crm-campaigns-primary-button"
            onClick={onCreateCampaign}
          >
            <Plus size={16} />
            Create new campaign
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CrmCampaignSummaryGrid({ campaigns, summary }) {
  return (
    <div className="crm-campaigns-summary-grid">
      <div className="crm-campaigns-summary-card">
        <span>Total imported contacts</span>
        <strong>{summary.totalContacts || 0}</strong>
      </div>
      <div className="crm-campaigns-summary-card">
        <span>Email-eligible contacts</span>
        <strong>{summary.eligibleEmailContacts || 0}</strong>
      </div>
      <div className="crm-campaigns-summary-card">
        <span>Campaigns created</span>
        <strong>{campaigns.length}</strong>
      </div>
    </div>
  );
}

export function CrmCampaignPreviewCard({ description, previewHtml, previewSubject }) {
  return (
    <section className="crm-campaigns-card crm-campaigns-preview-card">
      <div className="crm-campaigns-section-header">
        <div>
          <h2>Preview</h2>
          <p>{description}</p>
        </div>
        <Eye size={18} />
      </div>

      <div className="crm-campaigns-preview-subject">
        <Mail size={16} />
        <span>{previewSubject}</span>
      </div>

      <iframe
        title="CRM campaign preview"
        className="crm-campaigns-preview-frame"
        srcDoc={buildPreviewDocument(previewHtml)}
      />
    </section>
  );
}

export function CrmCampaignSelectedCard({
  description = "Poll delivery progress without leaving the composer.",
  selectedCampaign,
  title = "Selected campaign",
}) {
  return (
    <section className="crm-campaigns-card crm-campaigns-selected-card">
      <div className="crm-campaigns-section-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      {selectedCampaign ? (
        <div className="crm-campaigns-selected-content">
          <div className="crm-campaigns-selected-row">
            <span>Subject</span>
            <strong>{selectedCampaign.subject || "Untitled campaign"}</strong>
          </div>
          <div className="crm-campaigns-selected-row">
            <span>Status</span>
            <span
              className={`crm-campaigns-status crm-campaigns-status--${getStatusTone(selectedCampaign.status)}`}
            >
              {getStatusLabel(selectedCampaign.status)}
            </span>
          </div>
          <div className="crm-campaigns-selected-row">
            <span>Type</span>
            <strong>
              {selectedCampaign.mode === "test" ? "Test email" : "Bulk campaign"}
            </strong>
          </div>
          {selectedCampaign.testRecipientEmail ? (
            <div className="crm-campaigns-selected-row">
              <span>Test recipient</span>
              <strong>{selectedCampaign.testRecipientEmail}</strong>
            </div>
          ) : null}
          <div className="crm-campaigns-selected-grid">
            <div>
              <span>Total</span>
              <strong>{selectedCampaign.totalRecipients || 0}</strong>
            </div>
            <div>
              <span>Sent</span>
              <strong>{selectedCampaign.sentCount || 0}</strong>
            </div>
            <div>
              <span>Failed</span>
              <strong>{selectedCampaign.failedCount || 0}</strong>
            </div>
            <div>
              <span>Pending</span>
              <strong>{selectedCampaign.pendingCount || 0}</strong>
            </div>
          </div>
          <div className="crm-campaigns-selected-row">
            <span>Created</span>
            <strong>{formatDateTime(selectedCampaign.createdAt)}</strong>
          </div>
          <div className="crm-campaigns-selected-row">
            <span>Completed</span>
            <strong>{formatDateTime(selectedCampaign.completedAt)}</strong>
          </div>
          <div className="crm-campaigns-selected-row">
            <span>Created by</span>
            <strong>{selectedCampaign.createdBy?.username || "-"}</strong>
          </div>
          {selectedCampaign.lastError ? (
            <div className="crm-campaigns-inline-alert">
              Last error: {selectedCampaign.lastError}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="crm-campaigns-empty-state">
          Select a campaign to inspect its status.
        </div>
      )}
    </section>
  );
}

export function CrmCampaignListItem({
  campaign,
  isSelected,
  onReuseCampaign,
  onSelectCampaign,
}) {
  return (
    <article
      key={campaign.id}
      className={`crm-campaigns-list-item ${isSelected ? "is-selected" : ""}`}
    >
      <button
        type="button"
        className="crm-campaigns-list-card"
        onClick={() => onSelectCampaign(campaign.id)}
      >
        <div className="crm-campaigns-list-card-top">
          <div>
            <h3>{campaign.subject || "Untitled campaign"}</h3>
            <p>{formatDateTime(campaign.createdAt)}</p>
          </div>
          <span
            className={`crm-campaigns-status crm-campaigns-status--${getStatusTone(campaign.status)}`}
          >
            {getStatusLabel(campaign.status)}
          </span>
        </div>

        <div className="crm-campaigns-list-meta">
          <span className="crm-campaigns-list-mode">
            {campaign.mode === "test" ? "Test email" : "Bulk campaign"}
          </span>
          {campaign.testRecipientEmail ? (
            <span className="crm-campaigns-list-recipient">
              {campaign.testRecipientEmail}
            </span>
          ) : null}
        </div>

        <div className="crm-campaigns-list-stats">
          <span>{campaign.totalRecipients || 0} recipients</span>
          <span>{campaign.sentCount || 0} sent</span>
          <span>{campaign.failedCount || 0} failed</span>
          <span>{campaign.pendingCount || 0} pending</span>
        </div>
      </button>

      <button
        type="button"
        className="crm-campaigns-ghost-button"
        onClick={() => onReuseCampaign(campaign)}
      >
        <Copy size={16} />
        Use template
      </button>
    </article>
  );
}

export function CrmCampaignListSection({
  campaigns,
  loading,
  onReuseCampaign,
  onSelectCampaign,
  selectedCampaignId,
}) {
  return (
    <section className="crm-campaigns-card crm-campaigns-list-section">
      <div className="crm-campaigns-section-header">
        <div>
          <h2>Created campaigns</h2>
          <p>Recent campaigns stay live here while the worker processes each batch.</p>
        </div>
      </div>

      {loading ? (
        <div className="crm-campaigns-empty-state">Loading campaigns...</div>
      ) : campaigns.length === 0 ? (
        <div className="crm-campaigns-empty-state">
          No CRM email campaigns have been created yet.
        </div>
      ) : (
        <div className="crm-campaigns-list-grid">
          {campaigns.map((campaign) => (
            <CrmCampaignListItem
              key={campaign.id}
              campaign={campaign}
              isSelected={campaign.id === selectedCampaignId}
              onReuseCampaign={onReuseCampaign}
              onSelectCampaign={onSelectCampaign}
            />
          ))}
        </div>
      )}
    </section>
  );
}