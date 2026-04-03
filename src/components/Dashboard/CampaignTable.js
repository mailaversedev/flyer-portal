import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import "./CampaignTable.css";

const CampaignTable = ({ campaignData, loading }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  const getEditRoute = (campaign) => {
    const flyerType = campaign.flyerType || campaign.adType?.toLowerCase();

    if (flyerType === "leaflet") {
      return `/flyer/edit/leaflet/${campaign.id}`;
    }

    if (flyerType === "qr") {
      return `/flyer/edit/qr/${campaign.id}`;
    }

    return null;
  };

  const handleRowClick = (campaign) => {
    const route = getEditRoute(campaign);

    if (route) {
      navigate(route);
    }
  };

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
              {filteredData.map((campaign) => {
                const editRoute = getEditRoute(campaign);
                const isEditable = Boolean(editRoute);

                return (
                  <tr
                    key={campaign.id}
                    className={`campaign-row ${isEditable ? "campaign-row-editable" : "campaign-row-disabled"}`}
                    onClick={isEditable ? () => handleRowClick(campaign) : undefined}
                    onKeyDown={
                      isEditable
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleRowClick(campaign);
                            }
                          }
                        : undefined
                    }
                    tabIndex={isEditable ? 0 : undefined}
                    role={isEditable ? "button" : undefined}
                  >
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
                );
              })}
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
