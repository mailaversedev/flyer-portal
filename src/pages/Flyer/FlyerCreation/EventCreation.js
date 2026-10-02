import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import ApiService from "../../../services/ApiService";
import { isSuperAdmin } from "../../../utils/AuthUtil";
import "./Leaflet.css";
import "./EventCreation.css";

const initial = {
  companyId: "",
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
};

const EventCreation = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const uploadedFile = location.state?.uploadedFile;
  const [uploadedPreview, setUploadedPreview] = useState("");
  const [data, setData] = useState(initial);
  const [companies, setCompanies] = useState([]);
  const [busy, setBusy] = useState(false);
  const update = (key, value) =>
    setData((previous) => ({ ...previous, [key]: value }));

  useEffect(() => {
    if (!uploadedFile) return;
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
      .then((response) => setCompanies(response.data || []))
      .catch(() => toast.error(t("eventCreation.loadMerchantsFailed")));
  }, [navigate, t]);

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
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
        const merchant = companies.find(
          (company) => company.id === data.companyId,
        );
        const image = await ApiService.generateLeaflet(
          { ...data, aspectRatio: "1:1", resolution: "1K" },
          { company: merchant },
        );
        coverPhoto = image.images?.[0]?.url || image.flyer_output_path;
        if (!coverPhoto) throw new Error(t("eventCreation.imageFailed"));
        update("coverPhoto", coverPhoto);
      }
      const response = await ApiService.createEvent({
        ...data,
        coverPhoto,
        startsAt: new Date(data.startsAt).toISOString(),
        endsAt: new Date(data.endsAt).toISOString(),
        applicationDeadline: new Date(data.applicationDeadline).toISOString(),
        capacity: data.capacity === "" ? null : Number(data.capacity),
      });
      if (response.success)
        navigate("/flyer", {
          state: { success: true, message: t("eventCreation.created") },
        });
    } catch (error) {
      toast.error(error.message || t("eventCreation.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flyer" style={{ maxWidth: 780, color: "white" }}>
      <h1>{t("eventCreation.title")}</h1>
      <form onSubmit={submit} className="step1-content" aria-label={t("eventCreation.title")}>
        <div className="form-group">
          <label className="form-label">{t("eventCreation.merchant")}</label>
          <select
            className="form-select"
            required
            value={data.companyId}
            onChange={(event) => update("companyId", event.target.value)}
          >
            <option value="">{t("eventCreation.chooseMerchant")}</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.companyDisplayName || company.name}
              </option>
            ))}
          </select>
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
            value={data.timezone}
            onChange={(event) => update("timezone", event.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t("eventCreation.capacity")}</label>
          <input
            className="form-input"
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
        {!uploadedFile && (
          <div className="form-group">
            <label className="form-label">{t("eventCreation.imagePrompt")}</label>
            <textarea
              className="form-textarea"
              value={data.flyerPrompts}
              onChange={(event) => update("flyerPrompts", event.target.value)}
            />
          </div>
        )}
        {(uploadedPreview || data.coverPhoto) && (
          <img
            src={data.coverPhoto || uploadedPreview}
            alt={t("eventCreation.preview")}
            style={{ maxWidth: 260, borderRadius: 12 }}
          />
        )}
        <button className="action-button primary" disabled={busy} type="submit">
          {busy ? t("eventCreation.saving") : t("eventCreation.create")}
        </button>
      </form>
    </div>
  );
};

export default EventCreation;
