import React from "react";
import { useNavigate } from "react-router";
import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import "./PromotionalBanner.css";

const PromotionalBanner = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="promotional-banner">
      <div className="banner-content">
        <h2 className="banner-title">{t("dashboard.createFlyers")}</h2>
        <p className="banner-subtitle">
          {t("dashboard.createFlyersSubtitle")}
        </p>
      </div>
      <button className="start-button" onClick={() => navigate("/flyer")}>
        <Play size={16} fill="currentColor" />
        {t("dashboard.start")}
      </button>
    </div>
  );
};

export default PromotionalBanner;
