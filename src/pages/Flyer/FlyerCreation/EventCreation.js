import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import ApiService from "../../../services/ApiService";
import { isSuperAdmin } from "../../../utils/AuthUtil";
import TargetBudget from "../../../components/Flyer/TargetBudget";
import FlyerContentStep from "../../../components/Flyer/FlyerContentStep";
import { createCreativeDefaults, getCreativeValidationErrors, mergeFlyerContent, withoutCreativeFiles } from "../../../utils/FlyerContentUtil";
import eventUtils from "../../../utils/EventCreationUtil";
import "./Leaflet.css";
import "./EventCreation.css";

const initial = {
  ...createCreativeDefaults(),
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
  const [uploadedFile] = useState(location.state?.uploadedFile || null);
  const [iconPreview, setIconPreview] = useState("");
  const [step, setStep] = useState(1);
  const [history, setHistory] = useState([]);
  const [data, setData] = useState(initial);
  const [companies, setCompanies] = useState([]);
  const [busy, setBusy] = useState(false);
  const step1Ref = useRef(null);
  const updateContent = (updates) =>
    setData((previous) => mergeFlyerContent(previous, updates, Boolean(uploadedFile)));
  const update = (key, value) =>
    updateContent({ [key]: value });
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
    if (!isSuperAdmin()) {
      navigate("/flyer", { replace: true });
      return;
    }
    ApiService.getAdminCompanies()
      .then((response) => {
        if (!response.success) throw new Error(t("eventCreation.loadMerchantsFailed"));
        setCompanies((response.data || []).filter((company) => company.isActive !== false));
      })
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
    if (step === 1 && !step1Ref.current?.validateRequiredFields()) return;
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
        const response = await ApiService.createEvent({ ...withoutCreativeFiles(payload), companyIcon });
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
      }
      if (!coverPhoto) {
        if (!data.flyerPrompts.trim())
          throw new Error(t("eventCreation.promptRequired"));
        const image = await ApiService.generateLeaflet(
          data,
          { company: { ...merchant, icon: defaultIcon } },
        );
        coverPhoto = image.images?.[0]?.url || image.flyer_output_path;
        if (!coverPhoto) throw new Error(t("eventCreation.imageFailed"));
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
      <form onSubmit={submit} className="step-content" aria-label={t("eventCreation.title")}>
        <fieldset disabled={busy} className="event-fields">
        {step === 1 ? <FlyerContentStep
          ref={step1Ref}
          data={data}
          onUpdate={updateContent}
          showTags={false}
          showDesignFields={false}
          promptLabel={t("eventCreation.imagePrompt")}
          copyLabels={{
            header: t("eventCreation.eventTitle"),
            adContent: t("eventCreation.description"),
          }}
          copyLimits={{ header: 160, adContent: 5000 }}
          getValidationErrors={(values) => {
            const errors = uploadedFile || values.coverPhoto ? {} : getCreativeValidationErrors(values, t);
            for (const field of ["header", "adContent"]) {
              if (!values[field]?.trim()) errors[field] = t("eventCreation.requiredDetails");
            }
            return errors;
          }}
          uploadedFile={uploadedFile}
          generationHint={t("leafletCreation.tokenIndicatorSuperAdmin")}
        >
        <div className="content-section">
        <h3 className="section-title">{t("eventCreation.detailsStep")}</h3>
        <div className="form-grid">
        <div className="form-group">
          <label className="form-label">{t("eventCreation.merchant")}</label>
          <select
            className="form-select"
            aria-label={t("eventCreation.merchant")}
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
              else if (file) toast.error(t("qrGeneration.invalidImage"));
              event.target.value = "";
            }} />
            {data.logoImage && <button type="button" className="action-button secondary" onClick={() => update("logoImage", null)}>{t("eventCreation.resetIcon")}</button>}
          </div>
          <p className="event-hint">{t("eventCreation.iconHint")}</p>
        </div>
          <div className="form-group">
            <label className="form-label" htmlFor="event-venue">{t("eventCreation.venue")}</label>
            <input
              id="event-venue"
              className="form-input"
              required
              maxLength={300}
              value={data.venue}
              onChange={(event) => update("venue", event.target.value)}
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
        </div>
        </div>
        </FlyerContentStep> : <TargetBudget
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
