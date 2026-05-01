import React, { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import {
  Bold,
  Eraser,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  LoaderCircle,
  Mail,
  Quote,
  Send,
  Underline,
} from "lucide-react";

import ApiService from "../../services/ApiService";
import { isSuperAdmin } from "../../utils/AuthUtil";
import {
  CrmCampaignHero,
  CrmCampaignPreviewCard,
  CrmCampaignSelectedCard,
  CrmCampaignSummaryGrid,
  DEFAULT_TEMPLATE,
  SIMPLE_EMAIL_RE,
  stripHtml,
  useCrmCampaignDashboard,
} from "./CrmCampaigns.shared";
import "./CrmCampaigns.css";

const CrmCampaignCreatePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const editorRef = useRef(null);
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState(DEFAULT_TEMPLATE.trim());
  const [testRecipientEmail, setTestRecipientEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const {
    campaigns,
    loadDashboard,
    loadError,
    selectedCampaign,
    summary,
  } = useCrmCampaignDashboard();

  useEffect(() => {
    if (!editorRef.current) {
      return;
    }

    if (editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html;
    }
  }, [html]);

  useEffect(() => {
    const draft = location.state?.draft;

    if (draft) {
      setSubject(draft.subject || "");
      setHtml(draft.html || DEFAULT_TEMPLATE.trim());
      setTestRecipientEmail(draft.testRecipientEmail || "");
      setSuccess(location.state?.successMessage || "");
    } else {
      setSubject("");
      setHtml(DEFAULT_TEMPLATE.trim());
      setTestRecipientEmail("");
      setError("");
      setSuccess("");
    }

    if (location.state) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  if (!isSuperAdmin()) {
    return <Navigate to="/platform-admin" replace />;
  }

  const resetDraft = () => {
    setSubject("");
    setHtml(DEFAULT_TEMPLATE.trim());
    setTestRecipientEmail("");
    setError("");
    setSuccess("");
  };

  const validateDraft = ({ requireTestRecipient = false } = {}) => {
    const trimmedSubject = subject.trim();
    const trimmedTestRecipientEmail = testRecipientEmail.trim().toLowerCase();

    if (!trimmedSubject) {
      setError("Email subject is required.");
      return null;
    }

    if (!stripHtml(html)) {
      setError("Email content is required.");
      return null;
    }

    if (requireTestRecipient && !trimmedTestRecipientEmail) {
      setError("A test recipient email is required.");
      return null;
    }

    if (trimmedTestRecipientEmail && !SIMPLE_EMAIL_RE.test(trimmedTestRecipientEmail)) {
      setError("Test recipient email must be a valid email address.");
      return null;
    }

    return {
      trimmedSubject,
      trimmedTestRecipientEmail,
    };
  };

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

    const draft = validateDraft();
    if (!draft) {
      return;
    }

    try {
      setSubmitting(true);
      const response = await ApiService.createCrmEmailCampaign({
        subject: draft.trimmedSubject,
        html,
      });

      if (!response?.success || !response?.data) {
        throw new Error(response?.message || "Failed to queue CRM email campaign.");
      }

      navigate("/crm-campaigns", {
        state: {
          selectedCampaignId: response.data.id,
          successMessage: "CRM email campaign queued successfully.",
        },
      });
    } catch (submitError) {
      console.error("Failed to queue CRM email campaign", submitError);
      setError(submitError.message || "Failed to queue CRM email campaign.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendTestEmail = async () => {
    setError("");
    setSuccess("");

    const draft = validateDraft({ requireTestRecipient: true });
    if (!draft) {
      return;
    }

    try {
      setTestSubmitting(true);
      const response = await ApiService.createCrmEmailCampaign({
        subject: draft.trimmedSubject,
        html,
        testRecipientEmail: draft.trimmedTestRecipientEmail,
      });

      if (!response?.success || !response?.data) {
        throw new Error(response?.message || "Failed to queue CRM test email.");
      }

      navigate("/crm-campaigns", {
        state: {
          selectedCampaignId: response.data.id,
          successMessage: `CRM test email queued for ${draft.trimmedTestRecipientEmail}.`,
        },
      });
    } catch (submitError) {
      console.error("Failed to queue CRM test email", submitError);
      setError(submitError.message || "Failed to queue CRM test email.");
    } finally {
      setTestSubmitting(false);
    }
  };

  const currentError = error || loadError;

  return (
    <div className="crm-campaigns-page">
      <CrmCampaignHero
        onRefresh={() => loadDashboard()}
      />

      <CrmCampaignSummaryGrid campaigns={campaigns} summary={summary} />

      {currentError ? <div className="crm-campaigns-message error">{currentError}</div> : null}
      {success ? <div className="crm-campaigns-message success">{success}</div> : null}

      <div className="crm-campaigns-grid">
        <section className="crm-campaigns-card crm-campaigns-composer-card">
          <div className="crm-campaigns-section-header">
            <div>
              <h2>Compose campaign</h2>
              <p>Use the rich editor to produce the HTML for a bulk campaign or a single-recipient test email.</p>
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

            <label className="crm-campaigns-field">
              <span>Test recipient</span>
              <div className="crm-campaigns-inline-field-row">
                <input
                  type="email"
                  value={testRecipientEmail}
                  onChange={(event) => setTestRecipientEmail(event.target.value)}
                  placeholder="example@domain.com"
                />
                <button
                  type="button"
                  className="crm-campaigns-ghost-button"
                  onClick={handleSendTestEmail}
                  disabled={testSubmitting || submitting || loadError}
                >
                  {testSubmitting ? <LoaderCircle size={16} className="crm-campaigns-spin" /> : <Mail size={16} />}
                  {testSubmitting ? "Queueing test..." : "Send test"}
                </button>
              </div>
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
              <div className="crm-campaigns-form-action-group">
                <button
                  type="button"
                  className="crm-campaigns-secondary-button"
                  onClick={() => {
                    setError("");
                    setSuccess("");
                    navigate("/crm-campaigns");
                  }}
                >
                  Back to campaigns
                </button>
                <button
                  type="button"
                  className="crm-campaigns-secondary-button"
                  onClick={resetDraft}
                >
                  Reset draft
                </button>
              </div>
              <button type="submit" className="crm-campaigns-primary-button" disabled={submitting || testSubmitting || loadError}>
                {submitting ? <LoaderCircle size={16} className="crm-campaigns-spin" /> : <Send size={16} />}
                {submitting ? "Queueing..." : "Queue campaign"}
              </button>
            </div>
          </form>
        </section>

        <div className="crm-campaigns-side-column">
          <CrmCampaignPreviewCard
            description="The preview uses the draft HTML that will be sent by the backend."
            previewHtml={html}
            previewSubject={subject.trim() || "Email subject preview"}
          />
          <CrmCampaignSelectedCard selectedCampaign={selectedCampaign} />
        </div>
      </div>
    </div>
  );
};

export default CrmCampaignCreatePage;