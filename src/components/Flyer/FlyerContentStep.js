import React, { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import Step1ContentPro from "./Leaflet/Step1ContentPro";
import "./FlyerContentStep.css";

const FlyerContentStep = forwardRef(({
  data, children, uploadedFile, onUsePrompt,
  generationHint, ...editorProps
}, ref) => {
  const { t } = useTranslation();

  return (
    <div className="flyer-content-step">
      <div className="flyer-content-form">
        {uploadedFile && (
          <div className="flyer-content-actions">
            <span className="flyer-content-hint">{uploadedFile.name}</span>
            {onUsePrompt && (
              <button type="button" className="nav-button back-button" onClick={onUsePrompt}>
                {t("qrGeneration.usePrompt")}
              </button>
            )}
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
