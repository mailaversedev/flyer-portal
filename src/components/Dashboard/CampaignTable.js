import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "./CampaignTable.css";

const CampaignTable = ({ campaignData, loading }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("read");

  const tabs = [
    { key: "read", label: t("dashboard.readToEarn") },
    { key: "survey", label: t("dashboard.surveyToEarn") },
    { key: "scan", label: t("dashboard.scanToEarn") },
  ];

  const filteredData = campaignData.filter((campaign) => {
    if (activeTab === "read") return campaign.adType === "Leaflet";
    if (activeTab === "survey") return campaign.adType === "Query";
    if (activeTab === "scan") return campaign.adType === "Qr";
    return true;
  });

  return (
    <div className="campaign-table">
      <div className="table-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`table-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="table-container">
        {loading ? (
          <div className="table-loading">{t("dashboard.loadingCampaigns")}</div>
        ) : (
          <table className="campaigns-table">
            <thead>
              <tr>
                <th>{t("dashboard.thumbnail")}</th>
                <th>{t("dashboard.adTitle")}</th>
                <th>{t("dashboard.status")}</th>
                <th>{t("dashboard.adType")}</th>
                <th>{t("dashboard.totalReached")}</th>
                <th>{t("dashboard.browseRate")}</th>
                <th>{t("dashboard.totalBudget")}</th>
                <th>{t("dashboard.remainingPool")}</th>
                <th>{t("dashboard.costPerBrowse")}</th>
                <th>{t("dashboard.downloadRate")}</th>
                <th>{t("dashboard.convertedRate")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((campaign) => (
                <tr key={campaign.id}>
                  <td>
                    <div className="campaign-thumbnail">
                      {campaign.thumbnail &&
                      campaign.thumbnail.startsWith("http") ? (
                        <img
                          src={campaign.thumbnail}
                          alt="thumb"
                          className="thumbnail-img"
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 4,
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <span className="thumbnail-placeholder">{"📄"}</span>
                      )}
                    </div>
                  </td>
                  <td className="ad-title" title={campaign.adTitle}>
                    {campaign.adTitle.length > 30
                      ? campaign.adTitle.substring(0, 30) + "..."
                      : campaign.adTitle}
                  </td>
                  <td>
                    <span className={`status ${campaign.status.toLowerCase()}`}>
                      {campaign.status}
                    </span>
                  </td>
                  <td>{campaign.adType}</td>
                  <td>{campaign.totalReached}</td>
                  <td>{campaign.browseRate}</td>
                  <td>{campaign.totalBudget}</td>
                  <td>{campaign.remainingPool}</td>
                  <td>{campaign.costPerBrowse}</td>
                  <td>{campaign.downloadRate}</td>
                  <td>{campaign.convertedRate}</td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td
                    colSpan="11"
                    style={{ textAlign: "center", padding: "20px" }}
                  >
                    {t("dashboard.noCampaigns")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CampaignTable;
