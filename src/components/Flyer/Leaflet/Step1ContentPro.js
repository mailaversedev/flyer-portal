import React, { useId, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { Plus, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import ColorInputField from "./ColorInputField";
import { getProLeafletValidationErrors } from "../../../utils/LeafletValidationUtil";
import { normalizeTypographyEntries } from "../../../utils/LeafletNormalizationUtil";
import "./Step1Content.css";

const Step1ContentPro = forwardRef(
  ({
    data, onUpdate, isSuperAdminUser = false, merchantOptions = [],
    getValidationErrors = getProLeafletValidationErrors,
    showGenerationControls = true, showTags = true, showLogo = true,
    copyLabels = {}, copyLimits = {},
  }, ref) => {
    const { t } = useTranslation();
    const [newTag, setNewTag] = useState("");
    const [errors, setErrors] = useState({});
    const inputId = useId();
    const referenceInputRef = useRef(null);
    const logoInputRef = useRef(null);
    const productInputRef = useRef(null);
    const tags = data.tags || [];
    const typographyEntries = normalizeTypographyEntries(data.typography);

  const proAspectRatios = [
    { value: "1:1", label: "1:1 (1080 x 1080)" },
    { value: "2:3", label: "2:3 (1080 x 1620)" },
    { value: "3:2", label: "3:2 (1620 x 1080)" },
    { value: "3:4", label: "3:4 (1080 x 1440)" },
    { value: "4:3", label: "4:3 (1440 x 1080)" },
    { value: "4:5", label: "4:5 (1080 x 1350)" },
    { value: "5:4", label: "5:4 (1350 x 1080)" },
    { value: "9:16", label: "9:16 (1080 x 1920)" },
    { value: "16:9", label: "16:9 (1920 x 1080)" },
    { value: "21:9", label: "21:9 (2520 x 1080)" },
  ];
    const validateRequiredFields = () => {
      const newErrors = getValidationErrors(data);

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

    const selectedCompanyId = data.companyId || "";

    const handleAddTag = () => {
      const nextTag = newTag.trim();

      if (!nextTag || tags.includes(nextTag)) {
        return;
      }

      onUpdate({
        ...data,
        tags: [...tags, nextTag],
      });
      setNewTag("");
    };

    const handleRemoveTag = (tagToRemove) => {
      onUpdate({
        ...data,
        tags: tags.filter((tag) => tag !== tagToRemove),
      });
    };

    const handleTypographyChange = (index, field, value) => {
      const updatedTypography = typographyEntries.map((entry, rowIndex) =>
        rowIndex === index ? { ...entry, [field]: value } : entry,
      );

      handleInputChange("typography", updatedTypography);
    };

    const handleAddTypographyRow = () => {
      handleInputChange("typography", [...typographyEntries, { key: "", value: "" }]);
    };

    const handleRemoveTypographyRow = (index) => {
      if (index < 2) {
        return;
      }

      const updatedTypography = typographyEntries.filter((_, rowIndex) => rowIndex !== index);
      handleInputChange("typography", updatedTypography);
    };

  const handleImageSelect = async (field, event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (files.some((file) => !file.type.startsWith("image/"))) {
      toast.error(t("qrGeneration.invalidImage"));
      return;
    }
    try {
      const images = await Promise.all(files.map((file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          file, name: file.name, size: file.size, preview: reader.result,
        });
        reader.onerror = () => reject(new Error(t("flyerContent.imageReadFailed")));
        reader.readAsDataURL(file);
      })));
      handleInputChange(field, field === "productPhoto" ? [...(data[field] || []), ...images] : images[0]);
    } catch (error) {
      toast.error(error.message || t("flyerContent.imageReadFailed"));
    }
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
        {isSuperAdminUser && (
          <div className="form-group full-width">
            <label className="form-label">{t("common.merchant")}</label>
            <div className="select-wrapper">
              <select
                aria-label={t("common.merchant")}
                className={`form-select ${errors.companyId ? "error" : ""}`}
                value={selectedCompanyId}
                onChange={(e) => handleInputChange("companyId", e.target.value)}
                disabled={merchantOptions.length === 0}
              >
                <option value="">{t("common.pleaseSelect")}</option>
                {merchantOptions.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.companyDisplayName || company.name || company.id}
                  </option>
                ))}
              </select>
              <ChevronRight className="select-icon" size={16} />
            </div>
            {errors.companyId && (
              <span className="error-message">{errors.companyId}</span>
            )}
          </div>
        )}

        {showGenerationControls && <>
        <div className="form-group">
          <label className="form-label">{t("leafletPro.aspectRatio")}</label>
          <div className="select-wrapper">
            <select
              className={`form-select ${errors.aspectRatio ? "error" : ""}`}
              aria-label={t("leafletPro.aspectRatio")}
              value={data.aspectRatio}
              onChange={(e) => handleInputChange("aspectRatio", e.target.value)}
            >
              <option value="">{t("leafletPro.selectRatio")}</option>
              {proAspectRatios.map((ratio) => (
                <option key={ratio.value} value={ratio.value}>
                  {ratio.label}
                </option>
              ))}
            </select>
            <ChevronRight className="select-icon" size={16} />
          </div>
          {errors.aspectRatio && (
            <span className="error-message">{errors.aspectRatio}</span>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">{t("leafletPro.resolution")}</label>
          <div className="select-wrapper">
            <select
              className="form-select"
              aria-label={t("leafletPro.resolution")}
              value={data.resolution || "2K"}
              onChange={(e) => handleInputChange("resolution", e.target.value)}
            >
              <option value="1K">1K</option>
              <option value="2K">2K</option>
            </select>
            <ChevronRight className="select-icon" size={16} />
          </div>
        </div>

        <div className="form-group full-width">
          <label className="form-label">{t("leafletPro.moodboard")}</label>
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
                ref={referenceInputRef}
                aria-label={t("leafletPro.moodboard")}
                accept="image/*"
                onChange={(event) => handleImageSelect("referenceFlyer", event)}
              />
              <button
                type="button"
                aria-label={t("leafletStandard.selectFile")}
                className="upload-area"
                onClick={() => referenceInputRef.current?.click()}
              >
                <Plus size={24} />
              </button>
            </>
          )}
        </div>

        <ColorInputField
          label={t("leafletPro.primaryColor")}
          field="primaryColor"
          value={data.primaryColor}
          placeholder="#FFFFFF"
          onChange={handleInputChange}
        />

        <ColorInputField
          label={t("leafletPro.secondaryColor")}
          field="secondaryColor"
          value={data.secondaryColor}
          placeholder="#A1B2C3"
          onChange={handleInputChange}
        />

        <div className="form-group">
          <label className="form-label">{t("leafletPro.typography")}</label>
          <div className="typography-editor">
            {typographyEntries.map((entry, index) => (
              <div className="typography-row" key={index}>
                <input
                  type="text"
                  className="form-input typography-key-input"
                  placeholder={t("leafletPro.typographyKey")}
                  value={entry.key}
                  onChange={(e) =>
                    handleTypographyChange(index, "key", e.target.value)
                  }
                />
                <input
                  type="text"
                  className="form-input typography-value-input"
                  placeholder={t("leafletPro.typographyPlaceholder")}
                  value={entry.value}
                  onChange={(e) =>
                    handleTypographyChange(index, "value", e.target.value)
                  }
                />
                {index >= 2 && (
                  <button
                    type="button"
                    className="typography-remove-row"
                    onClick={() => handleRemoveTypographyRow(index)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="typography-add-row"
              onClick={handleAddTypographyRow}
            >
              + {t("leafletPro.addTypographyRow")}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{t("leafletPro.brandVoice")}</label>
          <input
            type="text"
            className="form-input"
            placeholder={t("leafletPro.brandVoicePlaceholder")}
            value={data.brandVoice || ""}
            onChange={(e) => handleInputChange("brandVoice", e.target.value)}
          />
        </div>

        {showLogo && <div className="form-group full-width">
          <label className="form-label">{t("leafletPro.uploadLogo")}</label>
          {data.logoImage ? (
            <SingleImageDisplay
              imageObj={data.logoImage}
              field="logoImage"
              onRemove={handleRemoveImage}
            />
          ) : (
            <>
              <input
                type="file"
                style={{ display: "none" }}
                ref={logoInputRef}
                aria-label={t("leafletPro.uploadLogo")}
                accept="image/*"
                onChange={(event) => handleImageSelect("logoImage", event)}
              />
              <button
                type="button"
                className="file-select"
                onClick={() => logoInputRef.current?.click()}
              >
                <span>{t("leafletPro.selectLogoFile")}</span>
                <ChevronRight size={16} />
              </button>
            </>
          )}
        </div>}
        </>}

      </div>

      <div className="content-section">
        <h3 className="section-title">{t("leafletPro.copyContent")}</h3>

        <div className="form-grid">
          <div className="form-group full-width">
            <label className="form-label" htmlFor={`${inputId}-header`}>{copyLabels.header || t("leafletPro.copyLine")}</label>
            <input
              id={`${inputId}-header`}
              maxLength={copyLimits.header}
              type="text"
              className={`form-input ${errors.header ? "error" : ""}`}
              placeholder={t("leafletPro.copyLinePlaceholder")}
              value={data.header || ""}
              onChange={(e) => handleInputChange("header", e.target.value)}
            />
            {errors.header && (
              <span className="error-message">{errors.header}</span>
            )}
          </div>

          <div className="form-group full-width">
            <label className="form-label" htmlFor={`${inputId}-description`}>{copyLabels.adContent || t("leafletPro.adContent")}</label>
            <textarea
              id={`${inputId}-description`}
              maxLength={copyLimits.adContent}
              className={`form-textarea ${errors.adContent ? "error" : ""}`}
              placeholder={t("leafletPro.adContentPlaceholder")}
              rows={4}
              value={data.adContent || ""}
              onChange={(e) => handleInputChange("adContent", e.target.value)}
            />
            {errors.adContent && (
              <span className="error-message">{errors.adContent}</span>
            )}
          </div>

          {showGenerationControls && <>
          <div className="form-group full-width">
            <label className="form-label" htmlFor={`${inputId}-prompts`}>{t("leafletPro.prompts")}</label>
            <textarea
              id={`${inputId}-prompts`}
              className={`form-textarea ${errors.flyerPrompts ? "error" : ""}`}
              placeholder={t("leafletPro.promptsPlaceholder")}
              rows={6}
              value={data.flyerPrompts || ""}
              onChange={(e) => handleInputChange("flyerPrompts", e.target.value)}
            />
            {errors.flyerPrompts && (
              <span className="error-message">{errors.flyerPrompts}</span>
            )}
          </div>

          <div className="form-group full-width">
            <label className="form-label">
              {t("leafletPro.uploadProduct")}{" "}
              <span className="counter">{(data.productPhoto || []).length}/5</span>
            </label>
            <input
              ref={productInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              aria-label={t("leafletPro.uploadProduct")}
              onChange={(event) => handleImageSelect("productPhoto", event)}
            />
            <button
              type="button"
              className="file-select"
              onClick={() => productInputRef.current?.click()}
            >
              <span>{t("leafletStandard.selectFile")}</span>
              <ChevronRight size={16} />
            </button>
            <ThumbnailRow images={data.productPhoto} field="productPhoto" />
          </div>
          </>}

          {showTags && <div className="form-group">
            <label className="form-label">{t("leafletPro.tagOptional")}</label>
            <div className="tag-input-container">
              <div className="tag-input">
                <span className="hash">#</span>
                <input
                  type="text"
                  placeholder={t("qrGeneration.pleaseEnter")}
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
              </div>
              {tags.length > 0 && (
                <div className="tags-display">
                  {tags.map((tag, index) => (
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
          </div>}
        </div>
      </div>
    </div>
  );
});

Step1ContentPro.validateRequiredFields = (
  data,
  setErrorsCallback = null,
) => {
  const errors = getProLeafletValidationErrors(data);

  if (setErrorsCallback) {
    setErrorsCallback(errors);
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export default Step1ContentPro;
