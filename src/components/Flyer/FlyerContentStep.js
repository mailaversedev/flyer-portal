import React, { forwardRef, useRef } from "react";
import { useTranslation } from "react-i18next";
import Step1ContentPro from "./Leaflet/Step1ContentPro";
import "./FlyerContentStep.css";

const FlyerContentStep = forwardRef(({
  data, children, uploadedFile, onFileSelect, onUsePrompt,
  generationHint, ...editorProps
}, ref) => {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  return (
    <div className="flyer-content-step">
      <div className="flyer-content-form">
        {onFileSelect && (
          <div className="flyer-content-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              aria-label={t("qrGeneration.upload")}
              onChange={onFileSelect}
              hidden
            />
            <button type="button" className="nav-button back-button" onClick={() => fileInputRef.current?.click()}>
              {t("qrGeneration.upload")}
            </button>
            {uploadedFile && <>
              <span className="flyer-content-hint">{uploadedFile.name}</span>
              <button type="button" className="nav-button back-button" onClick={onUsePrompt}>
                {t("qrGeneration.usePrompt")}
              </button>
            </>}
          </div>
        )}
        <Step1ContentPro
          {...editorProps}
          ref={ref}
          data={data}
          showGenerationControls={!uploadedFile}
        />
        {generationHint && !uploadedFile && <p className="flyer-content-hint">{generationHint}</p>}
        {children}
      </div>
    </div>
  );
});

export default FlyerContentStep;
