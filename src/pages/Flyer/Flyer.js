import React, { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import FlyerDistributionCard from "../../components/Flyer/FlyerDistributionCard";
import "./Flyer.css";

const Flyer = () => {
  const { t } = useTranslation();
  const [showBanner, setShowBanner] = useState(false);

  const location = useLocation();
  const successMessage = location.state?.success
    ? location.state?.message || t("flyerPage.successCreated")
    : null;

  useEffect(() => {
    if (successMessage) {
      setShowBanner(true);
      const timer = setTimeout(() => setShowBanner(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const flyerTypes = [
    {
      id: 1,
      title: t("flyerPage.leafletTitle"),
      subtitle: t("flyerPage.leafletSubtitle"),
      icon: "leaflet",
      primaryButton: t("flyerPage.leafletPrimary"),
      secondaryButton: t("flyerPage.leafletSecondary"),
      primaryRoute: "/flyer/create/leaflet",
      isPrimary: true,
    },
    {
      id: 2,
      title: t("flyerPage.surveyTitle"),
      subtitle: t("flyerPage.surveySubtitle"),
      icon: "survey",
      primaryButton: t("flyerPage.select"),
      primaryRoute: "/flyer/create/query",
      isPrimary: false,
    },
    {
      id: 3,
      title: t("flyerPage.qrTitle"),
      subtitle: t("flyerPage.qrSubtitle"),
      icon: "qr",
      primaryButton: t("flyerPage.select"),
      primaryRoute: "/flyer/create/qr",
      isPrimary: false,
    },
  ];

  return (
    <div className="flyer">
      <div className="flyer-header">
        <h1 className="flyer-title">{t("flyerPage.title")}</h1>
      </div>
      <div className="flyer-distribution-grid">
        {flyerTypes.map((type) => (
          <FlyerDistributionCard
            key={type.id}
            title={type.title}
            subtitle={type.subtitle}
            icon={type.icon}
            primaryButton={type.primaryButton}
            secondaryButton={type.secondaryButton}
            primaryRoute={type.primaryRoute}
            isPrimary={type.isPrimary}
          />
        ))}
      </div>
      {showBanner && (
        <div className="flyer-success-banner">{successMessage}</div>
      )}
    </div>
  );
};

export default Flyer;
