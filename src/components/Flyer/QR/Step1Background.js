import React from "react";
import { useTranslation } from "react-i18next";
import QRDetails from "./QRDetails";

const Step1Background = ({ qrData, errors, handleInputChange }) => {
  const { t } = useTranslation();

  return (
    <div className="step1-background-qr">
      <div className="background-layout">
        <div className="background-form">
          <div className="asset-lock-note">{t("creation.assetLocked")}</div>
          <QRDetails data={qrData} errors={errors} onChange={handleInputChange} includeCopy />
        </div>
        <div className="preview-panel">
          <div className="preview-container">
            <img src={qrData.coverPhoto} alt="Cover preview" className="preview-image" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step1Background;
