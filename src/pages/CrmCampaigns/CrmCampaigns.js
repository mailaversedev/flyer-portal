import React, { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router";
import {
  Eye,
  List,
  ListOrdered,
  LoaderCircle,
  Mail,
  RefreshCcw,
  Send,
  Underline,
  Italic,
  Bold,
  Link as LinkIcon,
  Quote,
  Eraser,
  Copy,
} from "lucide-react";

import ApiService from "../../services/ApiService";
import { isSuperAdmin } from "../../utils/AuthUtil";
import "./CrmCampaigns.css";

const POLL_INTERVAL_MS = 10000;
const DEFAULT_TEMPLATE = `
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

const EMPTY_SUMMARY = {
  totalContacts: 0,
  eligibleEmailContacts: 0,
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

const stripHtml = (html = "") =>
  `${html}`
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildPreviewDocument = (html) => `<!doctype html>
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

const getStatusLabel = (status) => {
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

const getStatusTone = (status) => {
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

const CrmCampaigns = () => {
  const editorRef = useRef(null);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState(DEFAULT_TEMPLATE.trim());
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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
      const nextCampaigns = campaignsResponse?.success && Array.isArray(campaignsResponse.data)
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
      setError("");
    } catch (loadError) {
      console.error("Failed to load CRM campaign data", loadError);
      if (!background) {
        setError(loadError.message || "Failed to load CRM campaign data.");
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
    } catch (loadError) {
      console.error("Failed to load CRM campaign detail", loadError);
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

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    if (editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html;
    }
  }, [html]);

  if (!isSuperAdmin()) {
    return <Navigate to="/platform-admin" replace />;
  }

  const applyEditorCommand = (command, value = null) => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.focus();
    document.execCommand(command, false, value);
    setHtml(editorRef.current.innerHTML);
  };

  const handleFormatBlock = (event) => {
    const value = event.target.value;
    if (!value) {
      return;
    }

    applyEditorCommand("formatBlock", value);
    event.target.value = "";
  };

  const handleInsertLink = () => {
    const url = window.prompt("Enter the full URL", "https://");

    if (!url) {
      return;
    }

    applyEditorCommand("createLink", url);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const trimmedSubject = subject.trim();
    if (!trimmedSubject) {
      setError("Email subject is required.");
      return;
    }

    if (!stripHtml(html)) {
      setError("Email content is required.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await ApiService.createCrmEmailCampaign({
        subject: trimmedSubject,
        html,
      });

      if (!response?.success || !response?.data) {
        throw new Error(response?.message || "Failed to queue CRM email campaign.");
      }

      setSuccess("CRM email campaign queued successfully.");
      setSelectedCampaignId(response.data.id);
      await Promise.all([
        loadDashboard(),
        loadSelectedCampaign(response.data.id),
      ]);
    } catch (submitError) {
      console.error("Failed to queue CRM email campaign", submitError);
      setError(submitError.message || "Failed to queue CRM email campaign.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReuseCampaign = (campaign) => {
    setSubject(campaign.subject || "");
    setHtml(campaign.html || DEFAULT_TEMPLATE.trim());
    setSuccess(`Loaded "${campaign.subject || "Untitled campaign"}" into the editor.`);
    setError("");
  };

  const renderCampaignCard = (campaign) => {
    const isSelected = campaign.id === selectedCampaignId;

    return (
      <article
        key={campaign.id}
        className={`crm-campaigns-list-item ${isSelected ? "is-selected" : ""}`}
      >
        <button
          type="button"
          className="crm-campaigns-list-card"
          onClick={() => setSelectedCampaignId(campaign.id)}
        >
          <div className="crm-campaigns-list-card-top">
            <div>
              <h3>{campaign.subject || "Untitled campaign"}</h3>
              <p>{formatDateTime(campaign.createdAt)}</p>
            </div>
            <span className={`crm-campaigns-status crm-campaigns-status--${getStatusTone(campaign.status)}`}>
              {getStatusLabel(campaign.status)}
            </span>
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
          onClick={() => handleReuseCampaign(campaign)}
        >
          <Copy size={16} />
          Use template
        </button>
      </article>
    );
  };

  return (
    <div className="crm-campaigns-page">
      <div className="crm-campaigns-hero">
        <div>
          <p className="crm-campaigns-eyebrow">Super Admin CRM</p>
          <h1>CRM Email Campaigns</h1>
          <p className="crm-campaigns-subtitle">
            Compose promotional email HTML, preview the final output, queue the
            campaign, and monitor delivery progress from one screen.
          </p>
        </div>

        <button
          type="button"
          className="crm-campaigns-secondary-button"
          onClick={() => loadDashboard()}
        >
          <RefreshCcw size={16} />
          Refresh
        </button>
      </div>

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

      {error ? <div className="crm-campaigns-message error">{error}</div> : null}
      {success ? <div className="crm-campaigns-message success">{success}</div> : null}

      <div className="crm-campaigns-grid">
        <section className="crm-campaigns-card crm-campaigns-composer-card">
          <div className="crm-campaigns-section-header">
            <div>
              <h2>Compose campaign</h2>
              <p>Use the rich editor to produce the HTML that will be sent to recipients.</p>
            </div>
          </div>

          <form className="crm-campaigns-form" onSubmit={handleSubmit}>
            <label className="crm-campaigns-field">
              <span>Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Example: April promotion for Mailaverse customers"
                maxLength={160}
                required
              />
            </label>

            <div className="crm-campaigns-editor-shell">
              <div className="crm-campaigns-toolbar">
                <select defaultValue="" onChange={handleFormatBlock}>
                  <option value="">Format</option>
                  <option value="p">Paragraph</option>
                  <option value="h1">Heading 1</option>
                  <option value="h2">Heading 2</option>
                  <option value="blockquote">Quote</option>
                </select>
                <button type="button" onClick={() => applyEditorCommand("bold")} aria-label="Bold">
                  <Bold size={16} />
                </button>
                <button type="button" onClick={() => applyEditorCommand("italic")} aria-label="Italic">
                  <Italic size={16} />
                </button>
                <button type="button" onClick={() => applyEditorCommand("underline")} aria-label="Underline">
                  <Underline size={16} />
                </button>
                <button type="button" onClick={() => applyEditorCommand("insertUnorderedList")} aria-label="Bullet list">
                  <List size={16} />
                </button>
                <button type="button" onClick={() => applyEditorCommand("insertOrderedList")} aria-label="Numbered list">
                  <ListOrdered size={16} />
                </button>
                <button type="button" onClick={() => applyEditorCommand("formatBlock", "blockquote")} aria-label="Quote">
                  <Quote size={16} />
                </button>
                <button type="button" onClick={handleInsertLink} aria-label="Insert link">
                  <LinkIcon size={16} />
                </button>
                <button type="button" onClick={() => applyEditorCommand("removeFormat")} aria-label="Clear formatting">
                  <Eraser size={16} />
                </button>
              </div>

              <div
                ref={editorRef}
                className="crm-campaigns-editor"
                contentEditable
                suppressContentEditableWarning
                onInput={(event) => setHtml(event.currentTarget.innerHTML)}
              />
            </div>

            <div className="crm-campaigns-form-actions">
              <button
                type="button"
                className="crm-campaigns-secondary-button"
                onClick={() => {
                  setSubject("");
                  setHtml(DEFAULT_TEMPLATE.trim());
                  setSuccess("");
                  setError("");
                }}
              >
                Reset draft
              </button>
              <button type="submit" className="crm-campaigns-primary-button" disabled={submitting || loading}>
                {submitting ? <LoaderCircle size={16} className="crm-campaigns-spin" /> : <Send size={16} />}
                {submitting ? "Queueing..." : "Queue campaign"}
              </button>
            </div>
          </form>
        </section>

        <div className="crm-campaigns-side-column">
          <section className="crm-campaigns-card crm-campaigns-preview-card">
            <div className="crm-campaigns-section-header">
              <div>
                <h2>Preview</h2>
                <p>The preview uses the HTML that will be sent by the backend.</p>
              </div>
              <Eye size={18} />
            </div>

            <div className="crm-campaigns-preview-subject">
              <Mail size={16} />
              <span>{subject.trim() || "Email subject preview"}</span>
            </div>

            <iframe
              title="CRM campaign preview"
              className="crm-campaigns-preview-frame"
              srcDoc={buildPreviewDocument(html)}
            />
          </section>

          <section className="crm-campaigns-card crm-campaigns-selected-card">
            <div className="crm-campaigns-section-header">
              <div>
                <h2>Selected campaign</h2>
                <p>Poll delivery progress without leaving the composer.</p>
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
                  <span className={`crm-campaigns-status crm-campaigns-status--${getStatusTone(selectedCampaign.status)}`}>
                    {getStatusLabel(selectedCampaign.status)}
                  </span>
                </div>
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
              <div className="crm-campaigns-empty-state">Select a campaign to inspect its status.</div>
            )}
          </section>
        </div>
      </div>

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
          <div className="crm-campaigns-empty-state">No CRM email campaigns have been created yet.</div>
        ) : (
          <div className="crm-campaigns-list-grid">{campaigns.map(renderCampaignCard)}</div>
        )}
      </section>
    </div>
  );
};

export default CrmCampaigns;