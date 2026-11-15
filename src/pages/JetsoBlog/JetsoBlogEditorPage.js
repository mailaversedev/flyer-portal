import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import ApiService from "../../services/ApiService";
import { isSuperAdmin } from "../../utils/AuthUtil";
import BlogRichTextEditor from "./BlogRichTextEditor";
import {
  BLOG_IMAGE_MAX_BYTES,
  BLOG_IMAGE_TYPES,
  blogDraftSignature,
  emptyBlogDraft,
  getJetsoPostUrl,
  normalizeBlogDraft,
  pruneEmptyTranslations,
  toBlogDraftPayload,
  toIsoDateTime,
  toLocalDateTimeValue,
  validateBlogDraft,
} from "./blogUtils";
import "./JetsoBlog.css";

const unwrapData = (response) => response?.data || response;
const clone = (value) => JSON.parse(JSON.stringify(value));

const JetsoBlogEditorPage = () => {
  const { t } = useTranslation();
  const { postId: routePostId } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const postId = routePostId || record?.id || null;
  const isNew = !postId;
  const [draft, setDraft] = useState(emptyBlogDraft);
  const [baseline, setBaseline] = useState(() => JSON.stringify(emptyBlogDraft()));
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [acting, setActing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewMode, setPreviewMode] = useState("desktop");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverError, setCoverError] = useState("");
  const [bodyUploadState, setBodyUploadState] = useState({});
  const [scheduleValue, setScheduleValue] = useState("");
  const [hasTranslation, setHasTranslation] = useState({ en: false, "zh-Hant-HK": false });
  const [tagInput, setTagInput] = useState("");
  const latestDraft = useRef(draft);
  const revisionRef = useRef(null);
  const dirtyRef = useRef(false);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);

  const serializedDraft = useMemo(() => blogDraftSignature(draft), [draft]);
  const dirty = serializedDraft !== blogDraftSignature(JSON.parse(baseline));
  const formLocked = saving || publishing || acting || record?.status === "archived";
  dirtyRef.current = dirty;

  const setDraftValue = useCallback((updater) => {
    setDraft((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      latestDraft.current = next;
      generationRef.current += 1;
      return next;
    });
  }, []);

  const localizeValidationError = (message) => {
    const messages = {
      "Enter an article title.": "jetsoBlog.titleRequired",
      "Add a cover image before publishing.": "jetsoBlog.coverRequired",
      "Add article description before publishing.": "jetsoBlog.descriptionRequired",
      "Scheduled publication must be in the future.": "jetsoBlog.scheduleMustBeFuture",
      "Enter a title for each authored translation.": "jetsoBlog.translationTitleRequired",
      "Article content exceeds the 500 KiB limit.": "jetsoBlog.contentTooLarge",
      "Use no more than 20 inline images across translations.": "jetsoBlog.tooManyImages",
      "Wait for image uploads to finish before publishing.": "jetsoBlog.uploadInProgress",
    };
    return messages[message] ? t(messages[message]) : message;
  };

  const resetFromRecord = useCallback((nextRecord) => {
    const nextDraft = normalizeBlogDraft(nextRecord?.draft);
    revisionRef.current = nextRecord?.revision ?? null;
    latestDraft.current = nextDraft;
    setRecord(nextRecord);
    setDraft(nextDraft);
    setBaseline(JSON.stringify(nextDraft));
    setScheduleValue(toLocalDateTimeValue(nextDraft.scheduledAt));
    setHasTranslation({
      en: Boolean(nextDraft.translations?.en),
      "zh-Hant-HK": Boolean(nextDraft.translations?.["zh-Hant-HK"]),
    });
    setTagInput((nextDraft.tags || []).join(", "));
    generationRef.current += 1;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const guard = () => {
      if (!dirtyRef.current) return false;
      return window.confirm(t("jetsoBlog.unsavedConfirm"));
    };
    const beforeUnload = (event) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const clickGuard = (event) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href], .user-info") : null;
      if (!target || target.getAttribute("target") === "_blank") return;
      if (target instanceof HTMLAnchorElement) {
        const destination = new URL(target.href, window.location.href);
        if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
      }
      if (!guard()) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }
    };
    const popGuard = () => {
      if (dirtyRef.current && !window.confirm(t("jetsoBlog.unsavedConfirm"))) {
        window.history.go(1);
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", clickGuard, true);
    window.addEventListener("popstate", popGuard);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", clickGuard, true);
      window.removeEventListener("popstate", popGuard);
    };
  }, [t]);

  useEffect(() => {
    if (!isSuperAdmin()) return undefined;
    let active = true;
    ApiService.getAdminCompanies().then((response) => {
      if (active) setCompanies(response?.data || []);
    }).catch(() => {
      if (active) setCompanies([]);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (isNew || !isSuperAdmin() || record?.id === postId) return undefined;
    let active = true;
    setLoading(true);
    ApiService.getJetsoBlogPost(postId).then((response) => {
      if (active) resetFromRecord(unwrapData(response));
    }).catch((loadError) => {
      if (active) setError(loadError.message || t("jetsoBlog.loadFailed"));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [isNew, postId, record?.id, resetFromRecord, t]);

  if (!isSuperAdmin()) return <Navigate to="/platform-admin" replace />;
  if (loading) return <main className="jetso-blog-page"><p>{t("jetsoBlog.loading")}</p></main>;
  if (postId && !record && error) {
    return <main className="jetso-blog-page"><div className="jetso-blog-message error" role="alert">{error}</div><Link to="/jetso-blog">{t("jetsoBlog.backToList")}</Link></main>;
  }

  const changeField = (field, value) => setDraftValue((current) => ({ ...current, [field]: value }));
  const uploadFile = async (file) => {
    if (!BLOG_IMAGE_TYPES.includes(file.type)) throw new Error(t("jetsoBlog.imageTypeError"));
    if (file.size > BLOG_IMAGE_MAX_BYTES) throw new Error(t("jetsoBlog.imageSizeError"));
    const response = await ApiService.uploadJetsoBlogImage(file);
    const uploaded = unwrapData(response);
    if (!uploaded?.url) throw new Error(t("jetsoBlog.imageUploadFailed"));
    return uploaded;
  };

  const handleCoverUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setCoverUploading(true);
    setCoverError("");
    try {
      const uploaded = await uploadFile(file);
      changeField("coverPhoto", uploaded.url);
    } catch (uploadError) {
      setCoverError(uploadError.message || t("jetsoBlog.imageUploadFailed"));
    } finally {
      setCoverUploading(false);
    }
  };

  const updateTranslation = (locale, field, value) => setDraftValue((current) => ({
    ...current,
    translations: {
      ...current.translations,
      [locale]: {
        ...(current.translations?.[locale] || {}),
        [field]: value,
        ...(field === "body" ? { bodyHtml: "", bodyText: "" } : {}),
      },
    },
  }));

  const removeTranslation = (locale) => setDraftValue((current) => {
    const translations = { ...current.translations };
    delete translations[locale];
    return { ...current, translations };
  });

  const updateTags = (value) => {
    setTagInput(value);
    const tags = [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 20);
    changeField("tags", tags);
  };

  const getCurrentDraft = () => ({
    ...clone(latestDraft.current),
    translations: pruneEmptyTranslations(latestDraft.current.translations),
    scheduledAt: record?.status === "published" ? (latestDraft.current.scheduledAt || null) : toIsoDateTime(scheduleValue),
  });

  const saveDraft = async ({ navigateAfter = false } = {}) => {
    const nextDraft = toBlogDraftPayload(getCurrentDraft());
    const validationErrors = validateBlogDraft(nextDraft);
    if (coverUploading || Object.values(bodyUploadState).some((state) => state.uploading)) {
      validationErrors.push(t("jetsoBlog.uploadInProgress"));
    }
    if (record?.status !== "published" && nextDraft.scheduledAt && new Date(nextDraft.scheduledAt).getTime() <= Date.now()) {
      validationErrors.push(t("jetsoBlog.scheduleMustBeFuture"));
    }
    if (coverError || Object.values(bodyUploadState).some((state) => state.failed)) {
      validationErrors.push(t("jetsoBlog.failedUpload"));
    }
    if (validationErrors.length) {
      setError(localizeValidationError(validationErrors[0]));
      return null;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const requestGeneration = generationRef.current;
    const sentJson = JSON.stringify(nextDraft);
    try {
      const response = isNew
        ? await ApiService.createJetsoBlogPost(nextDraft)
        : await ApiService.updateJetsoBlogPost(postId, revisionRef.current, nextDraft);
      const savedRecord = unwrapData(response);
      if (!savedRecord?.id) throw new Error(t("jetsoBlog.saveFailed"));
      revisionRef.current = savedRecord.revision;
      setRecord(savedRecord);
      const savedDraft = normalizeBlogDraft(savedRecord.draft || nextDraft);
      setBaseline(JSON.stringify(savedDraft));
      if (generationRef.current === requestGeneration) {
        latestDraft.current = savedDraft;
        setDraft(savedDraft);
        setScheduleValue(toLocalDateTimeValue(savedDraft.scheduledAt));
        setTagInput((savedDraft.tags || []).join(", "));
      } else {
        setBaseline(sentJson);
      }
      setNotice(t("jetsoBlog.saved"));
      if (navigateAfter && isNew) {
        navigate(`/jetso-blog/${encodeURIComponent(savedRecord.id)}/edit`, { replace: true });
      }
      return savedRecord;
    } catch (saveError) {
      setError(saveError.message || t("jetsoBlog.saveFailed"));
      return null;
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const saveAndPublish = async () => {
    const publishValidation = validateBlogDraft(toBlogDraftPayload(getCurrentDraft()), { forPublish: true });
    if (coverUploading || Object.values(bodyUploadState).some((state) => state.uploading)) {
      publishValidation.push(t("jetsoBlog.uploadInProgress"));
    }
    if (coverError || Object.values(bodyUploadState).some((state) => state.failed)) {
      publishValidation.push(t("jetsoBlog.failedUpload"));
    }
    if (publishValidation.length) {
      setError(localizeValidationError(publishValidation[0]));
      return;
    }
    setPublishing(true);
    setError("");
    try {
      let savedRecord = record;
      if (dirty || isNew) savedRecord = await saveDraft();
      if (!savedRecord) return;
      const response = await ApiService.publishJetsoBlogPost(savedRecord.id, revisionRef.current);
      const publishedRecord = unwrapData(response);
      if (publishedRecord?.revision !== undefined) revisionRef.current = publishedRecord.revision;
      if (publishedRecord?.draft) resetFromRecord(publishedRecord);
      else setRecord((current) => ({ ...current, ...publishedRecord }));
      setNotice(t(publishedRecord?.draft?.scheduledAt ? "jetsoBlog.scheduledSuccess" : "jetsoBlog.publishedSuccess"));
      if (isNew) navigate(`/jetso-blog/${encodeURIComponent(savedRecord.id)}/edit`, { replace: true });
    } catch (publishError) {
      setError(publishError.message || t("jetsoBlog.publishFailed"));
    } finally {
      setPublishing(false);
    }
  };

  const runRecordAction = async (action, confirmKey, successKey) => {
    if (!window.confirm(t(confirmKey))) return;
    setActing(true);
    setError("");
    try {
      let actionRecord = record;
      if (dirty) {
        actionRecord = await saveDraft();
        if (!actionRecord) return;
      }
      const response = await action.call(ApiService, actionRecord.id, revisionRef.current);
      const updatedRecord = unwrapData(response);
      if (updatedRecord?.revision !== undefined) revisionRef.current = updatedRecord.revision;
      if (updatedRecord?.draft) resetFromRecord(updatedRecord);
      else setRecord((current) => ({ ...current, ...updatedRecord }));
      setNotice(t(successKey));
    } catch (actionError) {
      setError(actionError.message || t("jetsoBlog.actionFailed"));
    } finally {
      setActing(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    setError("");
    try {
      const response = await ApiService.previewJetsoBlogPost(toBlogDraftPayload(getCurrentDraft()));
      const data = unwrapData(response);
      if (typeof data?.html !== "string") throw new Error(t("jetsoBlog.previewFailed"));
      setPreviewHtml(data.html);
    } catch (previewError) {
      setError(previewError.message || t("jetsoBlog.previewFailed"));
    } finally {
      setPreviewing(false);
    }
  };

  const handleCancel = () => {
    if (dirty && !window.confirm(t("jetsoBlog.unsavedConfirm"))) return;
    navigate("/jetso-blog");
  };

  const canPublish = !formLocked && !coverUploading && !coverError && !Object.values(bodyUploadState).some((state) => state.uploading || state.failed);
  const publishLabel = record?.status === "published" ? t("jetsoBlog.updatePublished") : scheduleValue ? t("jetsoBlog.schedulePost") : t("jetsoBlog.publish");

  return (
    <main className="jetso-blog-page jetso-blog-editor-page">
      <div className="jetso-blog-breadcrumb">
        <Link to="/jetso-blog">{t("jetsoBlog.title")}</Link><span>/</span><span>{isNew ? t("jetsoBlog.newPost") : t("jetsoBlog.editPost")}</span>
      </div>
      <header className="jetso-blog-page-header">
        <div>
          <p className="jetso-blog-eyebrow">{t("jetsoBlog.eyebrow")}</p>
          <h2>{isNew ? t("jetsoBlog.newPost") : t("jetsoBlog.editPost")}</h2>
          {record && <span className={`jetso-blog-status jetso-blog-status-${record.status}`}>{t(`jetsoBlog.statusLabels.${record.status}`, record.status)}</span>}
        </div>
        <div className="jetso-blog-top-actions">
          {record?.status === "published" && <a className="jetso-blog-secondary-button" href={getJetsoPostUrl(record.id)} target="_blank" rel="noreferrer">{t("jetsoBlog.openPublic")}</a>}
          <button type="button" className="jetso-blog-secondary-button" onClick={handlePreview} disabled={previewing || formLocked}>
            {previewing ? t("jetsoBlog.previewing") : t("jetsoBlog.preview")}
          </button>
        </div>
      </header>

      {error && <div className="jetso-blog-message error" role="alert">{error}</div>}
      {notice && <div className="jetso-blog-message success" role="status">{notice}</div>}

      <div className="jetso-blog-form-layout">
        <div className="jetso-blog-form-main">
          <section className="jetso-blog-form-card">
            <h3>{t("jetsoBlog.articleDetails")}</h3>
            <label className="jetso-blog-field">
              {t("jetsoBlog.titleField")}
              <input value={draft.header} onChange={(event) => changeField("header", event.target.value)} maxLength={180} disabled={formLocked} />
            </label>
            <label className="jetso-blog-field">
              {t("jetsoBlog.excerpt")}
              <textarea value={draft.excerpt} onChange={(event) => changeField("excerpt", event.target.value)} rows={3} maxLength={500} disabled={formLocked} />
            </label>
            <div className="jetso-blog-field">
              <span>{t("jetsoBlog.coverPhoto")}</span>
              <div className="jetso-blog-cover-controls">
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCoverUpload} disabled={coverUploading || formLocked} />
                {coverUploading && <span>{t("jetsoBlog.uploading")}</span>}
                {draft.coverPhoto && <button type="button" className="jetso-blog-text-button" onClick={() => { changeField("coverPhoto", ""); setCoverError(""); }} disabled={formLocked}>{t("jetsoBlog.removeCover")}</button>}
              </div>
              {coverError && <p className="jetso-blog-inline-error" role="alert">{coverError}</p>}
              {draft.coverPhoto && <img className="jetso-blog-cover-preview" src={draft.coverPhoto} alt={t("jetsoBlog.coverPreview")} />}
            </div>
            <label className="jetso-blog-field">
              {t("jetsoBlog.tags")}
              <input value={tagInput} onChange={(event) => updateTags(event.target.value)} placeholder={t("jetsoBlog.tagsHint")} disabled={formLocked} />
            </label>
            <div className="jetso-blog-field">
              <span>{t("jetsoBlog.content")}</span>
              <BlogRichTextEditor
                label={t("jetsoBlog.content")}
                value={draft.body}
                onChange={(body) => setDraftValue((current) => ({ ...current, body, bodyHtml: "", bodyText: "" }))}
                onUploadImage={uploadFile}
                onUploadStateChange={(state) => setBodyUploadState((current) => ({ ...current, primary: state }))}
                disabled={formLocked}
              />
            </div>
          </section>

          <section className="jetso-blog-form-card">
            <h3>{t("jetsoBlog.translations")}</h3>
            <p className="jetso-blog-form-hint">{t("jetsoBlog.translationsHint")}</p>
            {["en", "zh-Hant-HK"].map((locale) => (
              <div className="jetso-blog-translation" key={locale}>
                <label className="jetso-blog-checkbox">
                  <input
                    type="checkbox"
                    checked={hasTranslation[locale]}
                    disabled={formLocked}
                    onChange={(event) => {
                      setHasTranslation((current) => ({ ...current, [locale]: event.target.checked }));
                      if (event.target.checked) {
                        setDraftValue((current) => ({
                          ...current,
                          translations: { ...current.translations, [locale]: current.translations[locale] || { header: "", excerpt: "", body: { version: 1, doc: { type: "doc", content: [{ type: "paragraph" }] } } } },
                        }));
                      } else {
                        removeTranslation(locale);
                        setBodyUploadState((current) => {
                          const next = { ...current };
                          delete next[locale];
                          return next;
                        });
                      }
                    }}
                  />
                  {locale === "en" ? t("jetsoBlog.englishTranslation") : t("jetsoBlog.chineseTranslation")}
                </label>
                {hasTranslation[locale] && (
                  <div className="jetso-blog-translation-fields">
                    <label className="jetso-blog-field">{t("jetsoBlog.titleField")}
                      <input value={draft.translations[locale]?.header || ""} onChange={(event) => updateTranslation(locale, "header", event.target.value)} maxLength={180} disabled={formLocked} />
                    </label>
                    <label className="jetso-blog-field">{t("jetsoBlog.excerpt")}
                      <textarea value={draft.translations[locale]?.excerpt || ""} onChange={(event) => updateTranslation(locale, "excerpt", event.target.value)} rows={2} maxLength={500} disabled={formLocked} />
                    </label>
                    <div className="jetso-blog-field"><span>{t("jetsoBlog.content")}</span>
                      <BlogRichTextEditor
                        key={locale}
                        label={`${t("jetsoBlog.content")} ${locale}`}
                        value={draft.translations[locale]?.body}
                        onChange={(body) => updateTranslation(locale, "body", body)}
                        onUploadImage={uploadFile}
                        onUploadStateChange={(state) => setBodyUploadState((current) => ({ ...current, [locale]: state }))}
                        disabled={formLocked}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        </div>

        <aside className="jetso-blog-form-aside">
          <section className="jetso-blog-form-card">
            <h3>{t("jetsoBlog.publishSettings")}</h3>
            <label className="jetso-blog-field">
              {t("jetsoBlog.merchantAttribution")}
              <select
                value={draft.companyId || ""}
                onChange={(event) => {
                  const companyId = event.target.value || null;
                  setDraftValue((current) => ({
                    ...current,
                    companyId,
                    hideCompanyDetail: companyId
                      ? (current.companyId ? current.hideCompanyDetail : false)
                      : true,
                  }));
                }}
                disabled={formLocked}
              >
                <option value="">{t("jetsoBlog.noMerchant")}</option>
                {companies.map((company) => <option value={company.id} key={company.id}>{company.name || company.displayName || company.id}</option>)}
              </select>
            </label>
            <label className="jetso-blog-checkbox">
              <input type="checkbox" checked={Boolean(draft.hideCompanyDetail)} onChange={(event) => changeField("hideCompanyDetail", event.target.checked)} disabled={formLocked || !draft.companyId} />
              {t("jetsoBlog.hideMerchant")}
            </label>
            <label className="jetso-blog-field">
              {t("jetsoBlog.schedule")}
              <input
                type="datetime-local"
                value={scheduleValue}
                onChange={(event) => {
                  setScheduleValue(event.target.value);
                  changeField("scheduledAt", toIsoDateTime(event.target.value));
                }}
                disabled={formLocked || record?.status === "published"}
              />
            </label>
            {record?.status === "published" && <p className="jetso-blog-form-hint">{t("jetsoBlog.publishedScheduleHint")}</p>}
            <p className="jetso-blog-revision">{record ? `${t("jetsoBlog.revision")} ${record.revision}` : t("jetsoBlog.notSaved")}</p>
          </section>
        </aside>
      </div>

      <footer className="jetso-blog-sticky-actions">
        <span className={dirty ? "is-dirty" : "is-clean"}>{dirty ? t("jetsoBlog.unsavedChanges") : t("jetsoBlog.allChangesSaved")}</span>
        <div>
          {record?.status === "published" && (
            <button type="button" className="jetso-blog-danger-button" onClick={() => runRecordAction(ApiService.unpublishJetsoBlogPost, "jetsoBlog.confirmUnpublish", "jetsoBlog.unpublishedSuccess")} disabled={formLocked}>
              {t("jetsoBlog.unpublish")}
            </button>
          )}
          {record && record.status !== "archived" && (
            <button type="button" className="jetso-blog-danger-button" onClick={() => runRecordAction(ApiService.archiveJetsoBlogPost, "jetsoBlog.confirmArchive", "jetsoBlog.archivedSuccess")} disabled={formLocked}>
              {t("jetsoBlog.archive")}
            </button>
          )}
          <button type="button" className="jetso-blog-secondary-button" onClick={handleCancel} disabled={saving || publishing || acting}>{t("common.cancel")}</button>
          <button type="button" className="jetso-blog-secondary-button" onClick={() => saveDraft({ navigateAfter: true })} disabled={formLocked}>
            {saving ? t("jetsoBlog.saving") : t("jetsoBlog.saveDraft")}
          </button>
          <button type="button" className="jetso-blog-primary-button" onClick={saveAndPublish} disabled={!canPublish}>
            {publishing ? t("jetsoBlog.publishing") : publishLabel}
          </button>
        </div>
      </footer>

      {previewHtml && (
        <div className="jetso-blog-preview-overlay" role="dialog" aria-modal="true" aria-label={t("jetsoBlog.preview")}>
          <div className="jetso-blog-preview-panel">
            <div className="jetso-blog-preview-header">
              <h3>{t("jetsoBlog.preview")}</h3>
              <div>
                <button type="button" className={previewMode === "desktop" ? "is-selected" : ""} onClick={() => setPreviewMode("desktop")}>{t("jetsoBlog.desktop")}</button>
                <button type="button" className={previewMode === "mobile" ? "is-selected" : ""} onClick={() => setPreviewMode("mobile")}>{t("jetsoBlog.mobile")}</button>
                <button type="button" className="jetso-blog-preview-close" onClick={() => setPreviewHtml("")} aria-label={t("jetsoBlog.closePreview")}>×</button>
              </div>
            </div>
            <div className={`jetso-blog-preview-frame-wrap is-${previewMode}`}>
              <iframe title={t("jetsoBlog.preview")} srcDoc={previewHtml} sandbox="" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default JetsoBlogEditorPage;
