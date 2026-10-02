import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import ApiService from "../../../services/ApiService";
import { isSuperAdmin } from "../../../utils/AuthUtil";
import TargetBudget from "../../../components/Flyer/TargetBudget";
import eventUtils from "../../../utils/EventCreationUtil";
import "./Leaflet.css";
import "./EventCreation.css";

const initial = {
  companyId: eventUtils.MAILAVERSE_ORGANIZER.id,
  header: "",
  adContent: "",
  venue: "",
  startsAt: "",
  endsAt: "",
  applicationDeadline: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  capacity: "",
  confirmationRequired: false,
  flyerPrompts: "",
  coverPhoto: "",
  logoImage: null,
  targetBudget: { noReward: true, district: "", propertyEstate: "", targetedGroup: "", scheduledAt: null },
};

const EventCreation = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [uploadedFile, setUploadedFile] = useState(location.state?.uploadedFile || null);
  const [uploadedPreview, setUploadedPreview] = useState("");
  const [iconPreview, setIconPreview] = useState("");
  const [step, setStep] = useState(1);
  const [history, setHistory] = useState([]);
  const [data, setData] = useState(initial);
  const [companies, setCompanies] = useState([]);
  const [busy, setBusy] = useState(false);
  const update = (key, value) =>
    setData((previous) => ({ ...previous, [key]: value, ...(step === 1 && !uploadedFile ? { coverPhoto: "" } : {}) }));
  const merchant = companies.find((company) => company.id === data.companyId) || eventUtils.MAILAVERSE_ORGANIZER;
  const defaultIcon = merchant.icon || eventUtils.MAILAVERSE_ORGANIZER.icon;

  useEffect(() => {
    if (!data.logoImage?.file) {
      setIconPreview("");
      return;
    }
    const preview = URL.createObjectURL(data.logoImage.file);
    setIconPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [data.logoImage]);

  useEffect(() => {
    if (!uploadedFile) {
      setUploadedPreview("");
      return;
    }
    const preview = URL.createObjectURL(uploadedFile);
    setUploadedPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [uploadedFile]);

  useEffect(() => {
    if (!isSuperAdmin()) {
      navigate("/flyer", { replace: true });
      return;
    }
    ApiService.getAdminCompanies()
      .then((response) => setCompanies((response.data || []).filter((company) => company.isActive !== false)))
      .catch(() => toast.error(t("eventCreation.loadMerchantsFailed")));
  }, [navigate, t]);

  const buildPayload = () => {
    const payload = {
      ...data,
      timezone: data.timezone.trim(),
      startsAt: eventUtils.eventDateToIso(data.startsAt, data.timezone.trim()),
      endsAt: eventUtils.eventDateToIso(data.endsAt, data.timezone.trim()),
      applicationDeadline: eventUtils.eventDateToIso(data.applicationDeadline, data.timezone.trim()),
      capacity: data.capacity === "" ? null : Number(data.capacity),
    };
    const invalid = eventUtils.validateEventDetails(payload);
    if (invalid) throw new Error(t(`eventCreation.${invalid.code}`));
    return payload;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const payload = buildPayload();
      if (step === 2) {
        let companyIcon = defaultIcon;
        if (data.logoImage?.file) {
          const uploaded = await ApiService.uploadFile(data.logoImage.file, "event-icon");
          if (!uploaded.success || !uploaded.url) throw new Error(t("eventCreation.iconFailed"));
          companyIcon = uploaded.url;
        }
        const response = await ApiService.createEvent({ ...payload, companyIcon, logoImage: undefined });
        if (!response.success) throw new Error(response.message || t("eventCreation.failed"));
        navigate("/flyer", {
          state: { success: true, message: t("eventCreation.created") },
        });
        return;
      }
      let coverPhoto = data.coverPhoto;
      if (!coverPhoto && uploadedFile) {
        const uploaded = await ApiService.uploadFilesFromData({
          coverPhoto: uploadedFile,
        });
        coverPhoto = uploaded.coverPhoto;
        if (!coverPhoto) throw new Error(t("eventCreation.failed"));
        update("coverPhoto", coverPhoto);
      }
      if (!coverPhoto) {
        if (!data.flyerPrompts.trim())
          throw new Error(t("eventCreation.promptRequired"));
        const image = await ApiService.generateLeaflet(
          { ...data, aspectRatio: "1:1", resolution: "1K" },
          { company: { ...merchant, icon: defaultIcon } },
        );
        coverPhoto = image.images?.[0]?.url || image.flyer_output_path;
        if (!coverPhoto) throw new Error(t("eventCreation.imageFailed"));
        update("coverPhoto", coverPhoto);
      }
      if (!/^https:\/\//.test(coverPhoto)) throw new Error(t("eventCreation.imageFailed"));
      setData((previous) => ({ ...previous, coverPhoto }));
      if (!uploadedFile) setHistory((previous) => [coverPhoto, ...previous.filter((url) => url !== coverPhoto)]);
      setStep(2);
    } catch (error) {
      const code = ["invalidDates", "invalidTimezone"].includes(error.message);
      toast.error(code ? t(`eventCreation.${error.message}`) : error.message || t("eventCreation.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flyer-creation event-creation">
      <div className="creation-container">
      <h1>{t("eventCreation.title")}</h1>
      <div className="step-header">
        <div className="step-indicators" role="group" aria-label={t("eventCreation.steps")}>
          <div className="step-indicator active" aria-current={step === 1 ? "step" : undefined}>
            <span className="step-number">1</span>
            <span className="step-label">{t("eventCreation.detailsStep")}</span>
          </div>
          <div className={`step-connector ${step >= 2 ? "active" : ""}`} aria-hidden="true" />
          <div className={`step-indicator ${step >= 2 ? "active" : ""}`} aria-current={step === 2 ? "step" : undefined}>
            <span className="step-number">2</span>
            <span className="step-label">{t("creation.targetBudget")}</span>
          </div>
        </div>
      </div>
      <form onSubmit={submit} className={`step-content ${step === 1 ? "step1-content" : ""}`} aria-label={t("eventCreation.title")}>
        <fieldset disabled={busy} className="event-fields">
        {step === 1 ? <div className={`event-details-layout ${uploadedPreview || data.coverPhoto ? "has-preview" : ""}`}>
        <div className="event-details-form">
        <div className="form-group">
          <label className="form-label">{t("eventCreation.merchant")}</label>
          <select
            className="form-select"
            required
            value={data.companyId}
            onChange={(event) => update("companyId", event.target.value)}
          >
            <option value={eventUtils.MAILAVERSE_ORGANIZER.id}>Mailaverse</option>
            {companies.filter((company) => company.id !== eventUtils.MAILAVERSE_ORGANIZER.id).map((company) => (
              <option key={company.id} value={company.id}>
                {company.companyDisplayName || company.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="event-icon">{t("eventCreation.icon")}</label>
          <div className="event-icon-picker">
            <img src={iconPreview || defaultIcon} alt={t("eventCreation.iconPreview")} />
            <input id="event-icon" type="file" accept="image/*" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file?.type.startsWith("image/")) update("logoImage", { file });
            }} />
            {data.logoImage && <button type="button" className="action-button secondary" onClick={() => update("logoImage", null)}>{t("eventCreation.resetIcon")}</button>}
          </div>
          <p className="event-hint">{t("eventCreation.iconHint")}</p>
        </div>
        {[
          ["header", "eventCreation.eventTitle"],
          ["venue", "eventCreation.venue"],
        ].map(([field, label]) => (
          <div className="form-group" key={field}>
            <label className="form-label">{t(label)}</label>
            <input
              className="form-input"
              required
              aria-label={t(label)}
              maxLength={field === "header" ? 160 : 300}
              value={data[field]}
              onChange={(event) => update(field, event.target.value)}
            />
          </div>
        ))}
        <div className="form-group">
          <label className="form-label">{t("eventCreation.description")}</label>
          <textarea
            className="form-textarea"
            required
            aria-label={t("eventCreation.description")}
            maxLength={5000}
            value={data.adContent}
            onChange={(event) => update("adContent", event.target.value)}
          />
        </div>
        {[
          ["startsAt", "eventCreation.start"],
          ["endsAt", "eventCreation.end"],
          ["applicationDeadline", "eventCreation.deadline"],
        ].map(([field, label]) => (
          <div className="form-group" key={field}>
            <label className="form-label">{t(label)}</label>
            <input
              className="form-input"
              type="datetime-local"
              required
              aria-label={t(label)}
              value={data[field]}
              onChange={(event) => update(field, event.target.value)}
            />
          </div>
        ))}
        <div className="form-group">
          <label className="form-label">{t("eventCreation.timezone")}</label>
          <input
            className="form-input"
            aria-label={t("eventCreation.timezone")}
            required
            value={data.timezone}
            onChange={(event) => update("timezone", event.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t("eventCreation.capacity")}</label>
          <input
            className="form-input"
            aria-label={t("eventCreation.capacity")}
            type="number"
            min="1"
            step="1"
            value={data.capacity}
            onChange={(event) => update("capacity", event.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="event-confirmation-label">
            <input
              type="checkbox"
              checked={data.confirmationRequired}
              onChange={(event) =>
                update("confirmationRequired", event.target.checked)
              }
            />
            <span>{t("eventCreation.confirmationRequired")}</span>
          </label>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="event-photo">{t("flyerPage.leafletSecondary")}</label>
          <input id="event-photo" type="file" accept="image/*" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file?.type.startsWith("image/")) {
              setUploadedFile(file);
              setData((previous) => ({ ...previous, coverPhoto: "" }));
            }
          }} />
          {uploadedFile && <button className="action-button secondary" type="button" onClick={() => {
            setUploadedFile(null);
            setData((previous) => ({ ...previous, coverPhoto: "" }));
          }}>{t("eventCreation.usePrompt")}</button>}
        </div>
        {!uploadedFile && (
          <div className="form-group">
            <label className="form-label">{t("eventCreation.imagePrompt")}</label>
            <textarea
              className="form-textarea"
              aria-label={t("eventCreation.imagePrompt")}
              value={data.flyerPrompts}
              onChange={(event) => update("flyerPrompts", event.target.value)}
            />
          </div>
        )}
        </div>
        {(uploadedPreview || data.coverPhoto) && (
          <aside className="event-details-preview" aria-label={t("eventCreation.preview")}>
            <div className="preview-container">
              <img
                src={data.coverPhoto || uploadedPreview}
                alt={t("eventCreation.preview")}
                className="event-upload-preview-image"
              />
            </div>
          </aside>
        )}
        </div> : <TargetBudget
          data={data}
          onUpdate={setData}
          history={history}
          isEvent
        />}
        </fieldset>
        <div className="step-navigation">
          <button className="nav-button back-button" disabled={busy} type="button" onClick={() => step === 2 ? setStep(1) : navigate("/flyer")}>{t("creation.back")}</button>
          <button className="nav-button next-button" disabled={busy} type="submit">
            {busy ? t(step === 1 ? "eventCreation.preparingImage" : "eventCreation.saving") : t(step === 1 ? "creation.next" : "eventCreation.create")}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
};

export default EventCreation;
