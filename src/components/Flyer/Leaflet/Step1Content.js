import React, { useState, useImperativeHandle, forwardRef } from "react";
import { Plus, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import ColorInputField from "./ColorInputField";
import { getStandardLeafletValidationErrors } from "../../../utils/LeafletValidationUtil";
import "./Step1Content.css";

const Step1Content = forwardRef(({ data, onUpdate }, ref) => {
  const { t } = useTranslation();
  const [newTag, setNewTag] = useState("");
  const [errors, setErrors] = useState({});

  const validateRequiredFields = () => {
    const newErrors = getStandardLeafletValidationErrors(data);

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  useImperativeHandle(ref, () => ({
    validateRequiredFields,
  }));

  const handleInputChange = (field, value) => {
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    const updatedData = {
      ...data,
      [field]: value,
    };
    onUpdate(updatedData);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !data.tags.includes(newTag.trim())) {
      const updatedData = {
        ...data,
        tags: [...data.tags, newTag.trim()],
      };
      onUpdate(updatedData);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    const updatedData = {
      ...data,
      tags: data.tags.filter((tag) => tag !== tagToRemove),
    };
    onUpdate(updatedData);
  };

  const handleFileUpload = (field) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    if (field === "productPhoto") {
      input.multiple = true;
    }

    input.onchange = (event) => {
      const files = Array.from(event.target.files);

      if (field === "productPhoto") {
        const filePromises = files.map((file) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (loadEvent) =>
              resolve({
                file,
                name: file.name,
                size: file.size,
                preview: loadEvent.target.result,
              });
            reader.readAsDataURL(file);
          });
        });

        Promise.all(filePromises).then((fileObjects) => {
          const updatedData = {
            ...data,
            [field]: [...data[field], ...fileObjects],
          };
          onUpdate(updatedData);
        });
      } else {
        const file = files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (loadEvent) => {
            const updatedData = {
              ...data,
              [field]: {
                file,
                name: file.name,
                size: file.size,
                preview: loadEvent.target.result,
              },
            };
            onUpdate(updatedData);
          };
          reader.readAsDataURL(file);
        }
      }
    };
    input.click();
  };

  const handleRemoveImage = (field, index = null) => {
    if (field === "productPhoto" && index !== null) {
      const updatedData = {
        ...data,
        [field]: data[field].filter((_, itemIndex) => itemIndex !== index),
      };
      onUpdate(updatedData);
    } else {
      const updatedData = {
        ...data,
        [field]: null,
      };
      onUpdate(updatedData);
    }
  };

  const ThumbnailRow = ({ images, field }) => {
    if (!images || images.length === 0) return null;

    return (
      <div className="thumbnail-row">
        {images.map((imageObj, index) => (
          <div key={index} className="thumbnail-item">
            <img
              src={imageObj.preview}
              alt={imageObj.name}
              className="thumbnail-image"
            />
            <button
              type="button"
              className="thumbnail-remove"
              onClick={() => handleRemoveImage(field, index)}
            >
              ×
            </button>
            <div className="thumbnail-name">{imageObj.name}</div>
          </div>
        ))}
      </div>
    );
  };

  const SingleImageDisplay = ({ imageObj, field, onRemove }) => {
    if (!imageObj) return null;

    return (
      <div className="single-image-display">
        <img
          src={imageObj.preview}
          alt={imageObj.name}
          className="single-image"
        />
        <button
          type="button"
          className="single-image-remove"
          onClick={() => onRemove(field)}
        >
          ×
        </button>
        <div className="single-image-name">{imageObj.name}</div>
      </div>
    );
  };

  return (
    <div className="step1-content">
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">
            {t("leafletStandard.aspectRatio")}
            <span className="ratio-options">1:1 3:4 9:16</span>
          </label>
          <div className="select-wrapper">
            <select
              className={`form-select ${errors.aspectRatio ? "error" : ""}`}
              value={data.aspectRatio}
              onChange={(e) => handleInputChange("aspectRatio", e.target.value)}
            >
              <option value="">{t("qrGeneration.pleaseSelect")}</option>
              <option value="1:1">1:1</option>
              <option value="3:4">3:4</option>
              <option value="9:16">9:16</option>
            </select>
            <ChevronRight className="select-icon" size={16} />
          </div>
          {errors.aspectRatio && (
            <span className="error-message">{errors.aspectRatio}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">{t("leafletStandard.selectAdType")}</label>
          <div className="select-wrapper">
            <select
              className={`form-select ${errors.adType ? "error" : ""}`}
              value={data.adType}
              onChange={(e) => handleInputChange("adType", e.target.value)}
            >
              <option value="">{t("qrGeneration.pleaseSelect")}</option>
              <option value="promotional">{t("qrGeneration.promotional")}</option>
              <option value="informational">{t("qrGeneration.informational")}</option>
              <option value="event">{t("qrGeneration.event")}</option>
            </select>
            <ChevronRight className="select-icon" size={16} />
          </div>
          {errors.adType && <span className="error-message">{errors.adType}</span>}
        </div>

        <div className="form-group full-width">
          <label className="form-label">{t("leafletStandard.uploadReference")}</label>
          {data.referenceFlyer ? (
            <SingleImageDisplay
              imageObj={data.referenceFlyer}
              field="referenceFlyer"
              onRemove={handleRemoveImage}
            />
          ) : (
            <>
              <input
                type="file"
                style={{ display: "none" }}
                id="referenceFlyerInput"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      handleInputChange("referenceFlyer", {
                        file,
                        name: file.name,
                        size: file.size,
                        preview: event.target.result,
                      });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <div
                className="upload-area"
                onClick={() => document.getElementById("referenceFlyerInput").click()}
                tabIndex={0}
                role="button"
              >
                <Plus size={24} />
              </div>
            </>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">{t("leafletStandard.selectDesign")}</label>
          <div className="select-wrapper">
            <select
              className="form-select"
              value={data.designStyle}
              onChange={(e) => handleInputChange("designStyle", e.target.value)}
            >
              <option value="">{t("qrGeneration.pleaseSelect")}</option>
              <option value="modern">{t("leafletStandard.modern")}</option>
              <option value="classic">{t("leafletStandard.classic")}</option>
              <option value="minimalist">{t("leafletStandard.minimalist")}</option>
            </select>
            <ChevronRight className="select-icon" size={16} />
          </div>
        </div>

        <ColorInputField
          label={t("leafletStandard.themeColor")}
          field="themeColor"
          value={data.themeColor}
          placeholder="#FFFFFF"
          onChange={handleInputChange}
        />

        <div className="form-group full-width">
          <label className="form-label">{t("leafletStandard.uploadBackground")}</label>
          {data.backgroundPhoto ? (
            <SingleImageDisplay
              imageObj={data.backgroundPhoto}
              field="backgroundPhoto"
              onRemove={handleRemoveImage}
            />
          ) : (
            <>
              <input
                type="file"
                style={{ display: "none" }}
                id="backgroundPhotoInput"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      handleInputChange("backgroundPhoto", {
                        file,
                        name: file.name,
                        size: file.size,
                        preview: event.target.result,
                      });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <div
                className="upload-area"
                onClick={() => document.getElementById("backgroundPhotoInput").click()}
                tabIndex={0}
                role="button"
              >
                <Plus size={24} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="content-section">
        <h3 className="section-title">{t("leafletStandard.contentTitle")}</h3>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">{t("leafletStandard.header")}</label>
            <input
              type="text"
              className={`form-input ${errors.header ? "error" : ""}`}
              placeholder={t("qrGeneration.pleaseEnter")}
              value={data.header}
              onChange={(e) => handleInputChange("header", e.target.value)}
            />
            {errors.header && <span className="error-message">{errors.header}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">{t("leafletStandard.subheader")}</label>
            <input
              type="text"
              className="form-input"
              placeholder={t("qrGeneration.pleaseEnter")}
              value={data.subheader}
              onChange={(e) => handleInputChange("subheader", e.target.value)}
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">{t("leafletStandard.adContent")}</label>
            <textarea
              className={`form-textarea ${errors.adContent ? "error" : ""}`}
              placeholder={t("leafletStandard.adContentPlaceholder")}
              rows={4}
              value={data.adContent}
              onChange={(e) => handleInputChange("adContent", e.target.value)}
            />
            {errors.adContent && <span className="error-message">{errors.adContent}</span>}
          </div>

          <div className="form-group full-width">
            <label className="form-label">{t("leafletStandard.prompts")}</label>
            <textarea
              className={`form-textarea ${errors.flyerPrompts ? "error" : ""}`}
              placeholder={t("leafletStandard.promptsPlaceholder")}
              rows={6}
              value={data.flyerPrompts}
              onChange={(e) => handleInputChange("flyerPrompts", e.target.value)}
            />
            {errors.flyerPrompts && (
              <span className="error-message">{errors.flyerPrompts}</span>
            )}
          </div>

          <div className="form-group full-width">
            <label className="form-label">{t("leafletStandard.promotionMessage")}</label>
            <textarea
              className={`form-textarea ${errors.promotionMessage ? "error" : ""}`}
              placeholder={t("qrGeneration.pleaseEnter")}
              rows={3}
              value={data.promotionMessage}
              onChange={(e) => handleInputChange("promotionMessage", e.target.value)}
            />
            {errors.promotionMessage && (
              <span className="error-message">{errors.promotionMessage}</span>
            )}
          </div>

          <div className="form-group full-width">
            <label className="form-label">
              {t("leafletStandard.uploadProduct")} <span className="counter">{data.productPhoto.length}/5</span>
            </label>
            <div className="file-select" onClick={() => handleFileUpload("productPhoto")}>
              <span>{t("leafletStandard.selectFile")}</span>
              <ChevronRight size={16} />
            </div>
            <ThumbnailRow images={data.productPhoto} field="productPhoto" />
          </div>

          <div className="form-group full-width">
            <label className="form-label">{t("leafletStandard.productDescriptions")}</label>
            <input
              type="text"
              className={`form-input ${errors.productDescriptions ? "error" : ""}`}
              placeholder={t("qrGeneration.pleaseEnter")}
              value={data.productDescriptions}
              onChange={(e) => handleInputChange("productDescriptions", e.target.value)}
            />
            {errors.productDescriptions && (
              <span className="error-message">{errors.productDescriptions}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">{t("leafletStandard.tagOptional")}</label>
            <div className="tag-input-container">
              <div className="tag-input">
                <span className="hash">#</span>
                <input
                  type="text"
                  placeholder={t("qrGeneration.pleaseEnter")}
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddTag()}
                />
              </div>
              {data.tags.length > 0 && (
                <div className="tags-display">
                  {data.tags.map((tag, index) => (
                    <span key={index} className="tag">
                      #{tag}
                      <button
                        type="button"
                        className="tag-remove"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

Step1Content.validateRequiredFields = (data, setErrorsCallback = null) => {
  const errors = getStandardLeafletValidationErrors(data);

  if (setErrorsCallback) {
    setErrorsCallback(errors);
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export default Step1Content;
