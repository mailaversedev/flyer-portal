import React, { useId } from "react";
import { useTranslation } from "react-i18next";

export const QRWebsiteField = ({ value, error, onChange }) => {
  const { t } = useTranslation();
  const id = useId();

  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{t("qrGeneration.website")}</label>
      <input
        id={id}
        className={`form-input ${error ? "error" : ""}`}
        type="url"
        required
        placeholder={t("qrGeneration.websitePlaceholder")}
        value={value || ""}
        onChange={(event) => onChange("website", event.target.value)}
      />
      {error && <span className="error-message">{error}</span>}
    </div>
  );
};

const QRDetails = ({ data, errors, onChange, includeCopy = false }) => {
  const { t } = useTranslation();
  const id = useId();
  const fields = [
    ["location", "location", "locationPlaceholder"],
    ["website", "website", "websitePlaceholder"],
    ["startingDate", "startingDate", "datePlaceholder"],
    ...(includeCopy ? [
      ["header", "header", "pleaseEnter"],
      ["productDescriptions", "adContent", "pleaseEnter"],
    ] : []),
    ["promotionMessage", "promotionMessage", "pleaseEnter"],
  ];

  return (
    <div className="content-section">
      <h3 className="section-title">{t("qrGeneration.backgroundInformation")}</h3>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label" htmlFor={`${id}-adType`}>{t("dashboard.adType")}</label>
          <select
            id={`${id}-adType`}
            className="form-select"
            value={data.adType || ""}
            onChange={(event) => onChange("adType", event.target.value)}
          >
            <option value="">{t("qrGeneration.pleaseSelect")}</option>
            {["promotional", "informational", "event"].map((type) => (
              <option key={type} value={type}>{t(`qrGeneration.${type}`)}</option>
            ))}
          </select>
        </div>
        {fields.map(([field, label, placeholder]) => {
          if (field === "website") {
            return <QRWebsiteField key={field} value={data.website} error={errors.website} onChange={onChange} />;
          }
          const multiline = ["header", "productDescriptions", "promotionMessage"].includes(field);
          const Input = multiline ? "textarea" : "input";
          return (
            <div className={`form-group ${multiline ? "full-width" : ""}`} key={field}>
              <label className="form-label" htmlFor={`${id}-${field}`}>{t(`qrGeneration.${label}`)}</label>
              <Input
                id={`${id}-${field}`}
                className={`${multiline ? "form-textarea" : "form-input"} ${errors[field] ? "error" : ""}`}
                {...(multiline ? { rows: 3 } : { type: "text" })}
                placeholder={t(`qrGeneration.${placeholder}`)}
                value={data[field] || ""}
                onChange={(event) => onChange(field, event.target.value)}
              />
              {errors[field] && <span className="error-message">{errors[field]}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QRDetails;
