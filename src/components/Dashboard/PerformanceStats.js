import React from "react";
import { useTranslation } from "react-i18next";
import "./PerformanceStats.css";

const PerformanceStats = ({ statsData }) => {
  const { t } = useTranslation();
  const stats = [
    {
      value: "100%",
      label: t("dashboard.avgDistributedRate"),
      color: "#10b981",
    },
    {
      value: statsData && statsData.avgBrowseRate ? `${statsData.avgBrowseRate}%` : "-",
      label: t("dashboard.avgBrowseRate"),
      color: "#3b82f6",
    },
    {
      value: statsData && statsData.totalCouponDownloaded ? statsData.totalCouponDownloaded : "-", 
      label: t("dashboard.totalCouponDownloaded"),
      color: "#8b5cf6",
    },
    {
      value: "-", // Not available yet
      label: t("dashboard.costPerBrowse"),
      color: "#f59e0b",
    },
  ];

  return (
    <div className="performance-stats">
      <h3 className="stats-title">{t("dashboard.overallPerformance")}</h3>
      <div className="stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-value" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PerformanceStats;
