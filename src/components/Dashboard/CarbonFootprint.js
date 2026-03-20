import React from "react";
import { Recycle } from "lucide-react";
import "./CarbonFootprint.css";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

const CarbonFootprint = ({ metrics }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const counts = metrics?.typeCounts || {};
  const totalInteracted = metrics?.totalInteracted || 0;
  const carbonKg = (totalInteracted * 3.32) / 1000;
  const carbonKgDisplay = carbonKg.toLocaleString(i18n.language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="carbon-footprint">
      <div className="carbon-header">
        <h3 className="carbon-title">{t("dashboard.yourCarbonFootprint")}</h3>
        <div className="contribution-tabs">
          <button
            className="active tab"
            onClick={() => navigate("/marketplace")}
          >
            {t("common.marketplace")}
          </button>
        </div>
      </div>

      <div className="carbon-visual">
        <div className="carbon-circle">
          <div className="carbon-icon">
            <Recycle size={32} />
          </div>
          <div className="carbon-value">{carbonKgDisplay}</div>
          <div className="carbon-unit">KgCO2</div>
        </div>
        <div className="carbon-arc">
          <svg width="200" height="120" viewBox="0 0 200 120">
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#4b5563"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M 20 100 A 80 80 0 0 1 140 30"
              fill="none"
              stroke="#10b981"
              strokeWidth="8"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      <div className="carbon-metrics">
        <div className="carbon-metric">
          <span className="metric-label">{t("dashboard.readToEarn")}</span>
          <span className="metric-value">{counts.leaflet || 0}</span>
        </div>
        <div className="carbon-metric">
          <span className="metric-label">{t("dashboard.surveyToEarn")}</span>
          <span className="metric-value">{counts.query || 0}</span>
        </div>
        <div className="carbon-metric">
          <span className="metric-label">{t("dashboard.scanToEarn")}</span>
          <span className="metric-value">{counts.coupon || 0}</span>
        </div>
      </div>
    </div>
  );
};

export default CarbonFootprint;
