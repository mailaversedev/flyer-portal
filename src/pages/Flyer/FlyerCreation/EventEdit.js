import React, { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import ApiService from "../../../services/ApiService";
import { isSuperAdmin } from "../../../utils/AuthUtil";
import eventUtils from "../../../utils/EventCreationUtil";
import "./Leaflet.css";
import "./EventCreation.css";

const { MAILAVERSE_ORGANIZER, eventDateToIso, eventDateToLocal, eventEnrollmentLocked } = eventUtils;
const dates = [
  ["startsAt", "start"],
  ["endsAt", "end"],
  ["applicationDeadline", "deadline"],
];

const toForm = (record) => ({
  ...record,
  ...Object.fromEntries(dates.map(([field]) => [field, eventDateToLocal(record[field], record.timezone)])),
  capacity: record.capacity ?? "",
});

const EventEditForm = ({ flyerId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const allowed = isSuperAdmin();
  const [record, setRecord] = useState(null);
  const [changes, setChanges] = useState({});
  const [companies, setCompanies] = useState([]);
  const [merchantsLoaded, setMerchantsLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    ApiService.getFlyerById(flyerId).then((response) => {
      if (!response.success || response.data?.type !== "event") throw new Error(t("eventCreation.loadFailed"));
      if (active) setRecord({ ...response.data, id: flyerId });
    }).catch(() => {
      if (active) setLoadFailed(true);
    });
    return () => { active = false; };
  }, [allowed, flyerId, t]);

  const canEditEnrollment = record?.id === flyerId && !eventEnrollmentLocked(record);
  useEffect(() => {
    if (!allowed || !canEditEnrollment) return;
    let active = true;
    ApiService.getAdminCompanies().then((response) => {
      if (!response.success) throw new Error(response.message);
      if (active) {
        setCompanies(response.data.filter((company) => company.isActive !== false));
        setMerchantsLoaded(true);
      }
    }).catch(() => {
      if (active) toast.error(t("eventCreation.loadMerchantsFailed"));
    });
    return () => { active = false; };
  }, [allowed, canEditEnrollment, t]);

  if (!allowed) return <Navigate to="/flyer" replace />;
  const back = () => navigate("/platform-admin");
  const original = record?.id === flyerId ? toForm(record) : null;
  const data = original && { ...original, ...changes };
  const update = (key, value) => setChanges((previous) => ({ ...previous, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (busy || !data) return;
    setError("");
    setBusy(true);
    try {
      const payload = Object.fromEntries(Object.entries(changes).filter(([key, value]) => value !== original[key]));
      if ("timezone" in payload) payload.timezone = payload.timezone.trim();
      for (const [field] of dates) {
        if (field in payload || "timezone" in payload) {
          payload[field] = eventDateToIso(data[field], data.timezone.trim());
        }
      }
      if ("capacity" in payload) payload.capacity = payload.capacity === "" ? null : Number(payload.capacity);
      if (!Object.keys(payload).length) return;
      const response = await ApiService.updateFlyer(flyerId, payload);
      if (!response.success) throw new Error(response.message);
      toast.success(t("eventCreation.updated"));
      back();
    } catch (err) {
      setError(["invalidDates", "invalidTimezone"].includes(err.message)
        ? t(`eventCreation.${err.message}`)
        : err.message || t("eventCreation.updateFailed"));
    } finally {
      setBusy(false);
    }
  };

  const organizers = [MAILAVERSE_ORGANIZER, ...companies.filter(({ id }) => id !== MAILAVERSE_ORGANIZER.id)];
  if (data && !organizers.some(({ id }) => id === record.companyId)) {
    organizers.push({ id: record.companyId, name: record.companyDisplayName || record.companyName || record.companyId });
  }

  return (
    <div className="flyer-creation event-creation">
      <div className="creation-container">
        <h1>{t("eventCreation.edit")}</h1>
        {loadFailed ? <p role="alert">{t("eventCreation.loadFailed")}</p> :
          !data ? <p>{t("creation.loadingFlyer")}</p> : (
          <form className="step-content" onSubmit={submit}>
            <fieldset className="event-fields" disabled={busy}>
              <div className={`event-details-layout${record.coverPhoto ? " has-preview" : ""}`}>
                <div className="event-details-form">
                  {[
                    ["header", "eventTitle", "input", 160],
                    ["adContent", "description", "textarea", 5000],
                    ["venue", "venue", "input", 300],
                  ].map(([field, label, Input, maxLength]) => (
                    <div className="form-group" key={field}>
                      <label className="form-label" htmlFor={`edit-event-${field}`}>{t(`eventCreation.${label}`)}</label>
                      <Input id={`edit-event-${field}`} className={Input === "textarea" ? "form-textarea" : "form-input"}
                        required maxLength={maxLength} value={data[field]} onChange={(event) => update(field, event.target.value)} />
                    </div>
                  ))}
                  <fieldset className="event-fields" disabled={!canEditEnrollment}>
                    {!canEditEnrollment && <p className="event-hint">{t("eventCreation.enrollmentLocked")}</p>}
                    <div className="form-group">
                      <label className="form-label" htmlFor="edit-event-organizer">{t("eventCreation.merchant")}</label>
                      <select id="edit-event-organizer" className="form-select" disabled={!merchantsLoaded || record.rewardPolicy === "event_checkin_v1"}
                        value={data.companyId} onChange={(event) => update("companyId", event.target.value)}>
                        {organizers.map((company) => <option key={company.id} value={company.id}>{company.companyDisplayName || company.name}</option>)}
                      </select>
                    </div>
                    {[
                      ...dates.map(([field, label]) => [field, label, "datetime-local"]),
                      ["timezone", "timezone", "text"],
                      ["capacity", "capacity", "number"],
                    ].map(([field, label, type]) => (
                      <div className="form-group" key={field}>
                        <label className="form-label" htmlFor={`edit-event-${field}`}>{t(`eventCreation.${label}`)}</label>
                        <input id={`edit-event-${field}`} className="form-input" type={type}
                          required={type !== "number"} min={type === "number" ? 1 : undefined}
                          value={data[field]} onChange={(event) => update(field, event.target.value)} />
                      </div>
                    ))}
                    <div className="form-group">
                      <label className="event-confirmation-label">
                        <input type="checkbox" checked={data.confirmationRequired} disabled={record.rewardPolicy === "event_checkin_v1"}
                          onChange={(event) => update("confirmationRequired", event.target.checked)} />
                        <span>{t("eventCreation.confirmationRequired")}</span>
                      </label>
                    </div>
                  </fieldset>
                </div>
                {record.coverPhoto && <div className="event-details-preview">
                  <p className="event-hint">{t("creation.assetLocked")}</p>
                  <img className="event-upload-preview-image" src={record.coverPhoto} alt={t("eventCreation.preview")} />
                </div>}
              </div>
            </fieldset>
            {error && <p role="alert">{error}</p>}
            <div className="step-navigation">
              <button className="nav-button back-button" type="button" disabled={busy} onClick={back}>{t("creation.back")}</button>
              <button className="nav-button next-button" type="submit" disabled={busy}>
                {t(busy ? "creation.updating" : "creation.saveChanges")}
              </button>
            </div>
          </form>
        )}
        {!data && <button className="nav-button back-button" type="button" onClick={back}>{t("creation.back")}</button>}
      </div>
    </div>
  );
};

export default function EventEdit() {
  const { flyerId } = useParams();
  return <EventEditForm key={flyerId} flyerId={flyerId} />;
}
