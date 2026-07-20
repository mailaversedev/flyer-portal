import React, { useState, useImperativeHandle, forwardRef } from "react";
import { Plus, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import ColorInputField from "./ColorInputField";
import { getProLeafletValidationErrors } from "../../../utils/LeafletValidationUtil";
import { normalizeTypographyEntries } from "../../../utils/LeafletNormalizationUtil";
import "./Step1Content.css";

const Step1ContentPro = forwardRef(
  ({ data, onUpdate, isSuperAdminUser = false, merchantOptions = [] }, ref) => {
    const { t } = useTranslation();
    const [newTag, setNewTag] = useState("");
    const [errors, setErrors] = useState({});
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
      const newErrors = getProLeafletValidationErrors(data, {
        requireCompanySelection: isSuperAdminUser,
      });

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
        {isSuperAdminUser && (
          <div className="form-group full-width">
            <label className="form-label">{t("common.merchant")}</label>
            <div className="select-wrapper">
              <select
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

        <div className="form-group">
          <label className="form-label">{t("leafletPro.aspectRatio")}</label>
          <div className="select-wrapper">
            <select
              className={`form-select ${errors.aspectRatio ? "error" : ""}`}
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
                id="referenceFlyerInputPro"
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
                onClick={() =>
                  document.getElementById("referenceFlyerInputPro").click()
                }
                tabIndex={0}
                role="button"
              >
                <Plus size={24} />
              </div>
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
              <div className="typography-row" key={`${entry.key || "row"}-${index}`}>
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

        <div className="form-group full-width">
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
                id="logoImageInput"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      handleInputChange("logoImage", {
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
                className="file-select"
                onClick={() => document.getElementById("logoImageInput").click()}
              >
                <span>{t("leafletPro.selectLogoFile")}</span>
                <ChevronRight size={16} />
              </div>
            </>
          )}
        </div>

      </div>

      <div className="content-section">
        <h3 className="section-title">{t("leafletPro.copyContent")}</h3>

        <div className="form-grid">
          <div className="form-group full-width">
            <label className="form-label">{t("leafletPro.copyLine")}</label>
            <input
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
            <label className="form-label">{t("leafletPro.adContent")}</label>
            <textarea
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

          <div className="form-group full-width">
            <label className="form-label">{t("leafletPro.prompts")}</label>
            <textarea
              className={`form-textarea ${errors.flyerPrompts ? "error" : ""}`}
              placeholder={t("leafletPro.promptsPlaceholder")}
              rows={6}
              value={data.flyerPrompts}
              onChange={(e) => handleInputChange("flyerPrompts", e.target.value)}
            />
            {errors.flyerPrompts && (
              <span className="error-message">{errors.flyerPrompts}</span>
            )}
          </div>

          <div className="form-group full-width">
            <label className="form-label">
              {t("leafletPro.uploadProduct")}{" "}
              <span className="counter">{data.productPhoto.length}/5</span>
            </label>
            <div
              className="file-select"
              onClick={() => handleFileUpload("productPhoto")}
            >
              <span>{t("leafletStandard.selectFile")}</span>
              <ChevronRight size={16} />
            </div>
            <ThumbnailRow images={data.productPhoto} field="productPhoto" />
          </div>

          <div className="form-group">
            <label className="form-label">{t("leafletPro.tagOptional")}</label>
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
          </div>
        </div>
      </div>
    </div>
  );
});

Step1ContentPro.validateRequiredFields = (
  data,
  setErrorsCallback = null,
  options = {},
) => {
  const errors = getProLeafletValidationErrors(data, {
    requireCompanySelection:
      Boolean(options.requireCompanySelection) || Boolean(data?.isSuperAdminUser),
  });

  if (setErrorsCallback) {
    setErrorsCallback(errors);
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export default Step1ContentPro;
