import React from "react";
import { Upload } from "lucide-react";
import { useTranslation } from "react-i18next";

const Step1Background = ({
  qrData, errors, isEditMode, isSuperAdminUser, uploadedFile, uploadedPreview,
  handleInputChange, updateQrData, handleUpload, onUsePrompt,
}) => {
  const { t } = useTranslation();

  return (
    <div className="step1-background-qr">
      <div className="background-layout">
        <div className="background-form">
          <h3 className="section-title">{t("qrGeneration.backgroundInformation")}</h3>

          {isEditMode && (
            <div
              style={{
                marginBottom: "20px",
                padding: "12px 16px",
                border: "1px solid #4b5563",
                borderRadius: "8px",
                background: "rgba(30, 36, 51, 0.8)",
                color: "#cbd5e1",
                fontSize: "14px",
              }}
            >
              {t("creation.assetLocked")}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t("dashboard.adType")}</label>
            <div className="select-wrapper">
              <select
                className="form-select"
                value={qrData.adType}
                onChange={(event) =>
                  handleInputChange("adType", event.target.value)
                }
              >
                <option value="">{t("qrGeneration.pleaseSelect")}</option>
                <option value="promotional">{t("qrGeneration.promotional")}</option>
                <option value="informational">{t("qrGeneration.informational")}</option>
                <option value="event">{t("qrGeneration.event")}</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t("qrGeneration.location")}</label>
            <input
              type="text"
              className="form-input"
              placeholder={t("qrGeneration.locationPlaceholder")}
              value={qrData.location}
              onChange={(event) =>
                handleInputChange("location", event.target.value)
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              {t("qrGeneration.website")} <span style={{ color: "#ff4444" }}>*</span>
            </label>
            <input
              type="url"
              className={`form-input ${errors.website ? "error" : ""}`}
              placeholder={t("qrGeneration.websitePlaceholder")}
              value={qrData.website}
              onChange={(event) =>
                handleInputChange("website", event.target.value)
              }
              required
            />
            {errors.website && (
              <span className="error-message">{errors.website}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">{t("qrGeneration.startingDate")}</label>
            <input
              type="text"
              className="form-input"
              placeholder={t("qrGeneration.datePlaceholder")}
              value={qrData.startingDate}
              onChange={(event) =>
                handleInputChange("startingDate", event.target.value)
              }
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t("qrGeneration.header")}</label>
            <textarea
              className="form-textarea"
              placeholder={t("qrGeneration.pleaseEnter")}
              value={qrData.header}
              onChange={(event) =>
                handleInputChange("header", event.target.value)
              }
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t("qrGeneration.adContent")}</label>
            <textarea
              className="form-textarea"
              placeholder={t("qrGeneration.pleaseEnter")}
              value={qrData.productDescriptions}
              onChange={(event) =>
                handleInputChange("productDescriptions", event.target.value)
              }
              rows={5}
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t("qrGeneration.promotionMessage")}</label>
            <textarea
              className="form-textarea"
              placeholder={t("qrGeneration.pleaseEnter")}
              value={qrData.promotionMessage}
              onChange={(event) =>
                handleInputChange("promotionMessage", event.target.value)
              }
              rows={3}
            />
          </div>
          {!isEditMode && !uploadedFile && (
            <div className="form-group">
              <label className="form-label" htmlFor="qr-flyer-prompt">
                {t("qrGeneration.imagePrompt")}
              </label>
              <textarea
                id="qr-flyer-prompt"
                className="form-textarea"
                value={qrData.flyerPrompts}
                onChange={(event) => updateQrData({
                  flyerPrompts: event.target.value,
                  coverPhoto: null,
                })}
                rows={3}
              />
              <p className="qr-generation-hint">
                {isSuperAdminUser
                  ? t("leafletCreation.tokenIndicatorSuperAdmin")
                  : t("qrGeneration.generationCost")}
              </p>
            </div>
          )}
        </div>

        <div className="preview-panel">
          <div className="preview-container">
            <div className="preview-upload-area">
              {qrData.coverPhoto || uploadedPreview ? (
                <img
                  src={qrData.coverPhoto || uploadedPreview}
                  alt="Cover preview"
                  className="preview-image"
                />
              ) : (
                <div className="upload-placeholder">
                  <div className="upload-icon">
                    <Upload size={48} />
                  </div>
                  <div className="upload-text">
                    <p>
                      {t("qrGeneration.imagePlaceholder")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {!isEditMode && (
              <div className="preview-controls">
                <button className="upload-button" onClick={handleUpload}>
                  <Upload size={16} />
                  {t("qrGeneration.upload")}
                </button>
                {uploadedFile && (
                  <button className="upload-button" onClick={onUsePrompt}>
                    {t("qrGeneration.usePrompt")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step1Background;
