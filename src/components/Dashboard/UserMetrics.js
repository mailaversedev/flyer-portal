import React from "react";
import { useTranslation } from "react-i18next";
import "./UserMetrics.css";

const UserMetrics = ({ totalInteracted, avgBrowseRate, totalCouponDownloaded }) => {
  const { t, i18n } = useTranslation();
  return (
    <div className="user-metrics">
      <div className="metrics-header">
        <h3 className="metrics-title">{t("dashboard.totalUsersReached")}</h3>
      </div>

      <div className="user-count">
        <span className="count">
          {totalInteracted ? totalInteracted.toLocaleString(i18n.language) : "0"}
        </span>
        <span className="growth positive">-</span>
      </div>

      <div className="metrics-breakdown">
        <div className="metric-item">
          <div className="metric-value">
            {avgBrowseRate ? `${avgBrowseRate}%` : "-"}
          </div>
          <div className="metric-label">{t("dashboard.browsed")}</div>
        </div>
        <div className="metric-item">
          <div className="metric-value">
            {totalCouponDownloaded}
          </div>
          <div className="metric-label">{t("dashboard.downloaded")}</div>
        </div>
        <div className="metric-item">
          <div className="metric-value">-</div>
          <div className="metric-label">{t("dashboard.converted")}</div>
        </div>
      </div>
    </div>
  );
};

export default UserMetrics;
