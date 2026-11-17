import React, { forwardRef, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Step1ContentPro from "./Leaflet/Step1ContentPro";
import "./FlyerContentStep.css";

const FlyerContentStep = forwardRef(({
  data, children, uploadedFile, onFileSelect, onUsePrompt,
  previewLabel, generationHint, ...editorProps
}, ref) => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [uploadedPreview, setUploadedPreview] = useState("");

  useEffect(() => {
    if (!uploadedFile) {
      setUploadedPreview("");
      return;
    }
    const preview = URL.createObjectURL(uploadedFile);
    setUploadedPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [uploadedFile]);

  return (
    <div className={`flyer-content-step ${onFileSelect ? "with-preview" : ""}`}>
      <div className="flyer-content-form">
        <Step1ContentPro
          {...editorProps}
          ref={ref}
          data={data}
          showGenerationControls={!uploadedFile}
        />
        {generationHint && !uploadedFile && <p className="flyer-content-hint">{generationHint}</p>}
        {children}
      </div>
      {onFileSelect && (
        <aside className="flyer-content-preview" aria-label={t("flyerContent.preview")}>
          {(uploadedPreview || data.coverPhoto) && (
            <img src={data.coverPhoto || uploadedPreview} alt={previewLabel || t("flyerContent.preview")} />
          )}
          {!uploadedPreview && !data.coverPhoto && <p className="flyer-content-hint">{t("qrGeneration.imagePlaceholder")}</p>}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            aria-label={t("qrGeneration.upload")}
            onChange={onFileSelect}
            hidden
          />
          <div className="flyer-content-actions">
            <button type="button" className="nav-button back-button" onClick={() => fileInputRef.current?.click()}>
              {t("qrGeneration.upload")}
            </button>
            {uploadedFile && (
              <button type="button" className="nav-button back-button" onClick={onUsePrompt}>
                {t("qrGeneration.usePrompt")}
              </button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
});

export default FlyerContentStep;
