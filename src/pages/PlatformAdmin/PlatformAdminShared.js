import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import ApiService from "../../services/ApiService";

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toLocaleString();
};

const formatLocation = (location) => {
  if (!location || typeof location !== "object") {
    return "-";
  }

  const segments = [
    location.countryCity,
    location.district,
    location.buildingEstate,
  ].filter(Boolean);

  return segments.length > 0 ? segments.join(", ") : "-";
};

const getFlyerStatusLabel = (status) => {
  if (status === "active") {
    return "Live";
  }

  if (!status) {
    return "Draft";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
};

export const usePlatformAdminData = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [flyers, setFlyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAdminData = async () => {
      try {
        setLoading(true);
        setError("");

        const [usersResponse, companiesResponse, flyersResponse] = await Promise.all([
          ApiService.getAdminUsers(),
          ApiService.getAdminCompanies(),
          ApiService.getAdminFlyers(),
        ]);

        setUsers(usersResponse.success ? usersResponse.data : []);
        setCompanies(companiesResponse.success ? companiesResponse.data : []);
        setFlyers(flyersResponse.success ? flyersResponse.data : []);
      } catch (loadError) {
        console.error("Failed to load platform admin data", loadError);
        setError(t("adminPage.loadError"));
      } finally {
        setLoading(false);
      }
    };

    loadAdminData();
  }, [t]);

  return {
    users,
    companies,
    flyers,
    setCompanies,
    loading,
    error,
  };
};

export const PlatformAdminSummary = ({ users, companies, flyers, t }) => (
  <div className="platform-admin-summary">
    <div className="platform-admin-card">
      <span className="platform-admin-label">{t("adminPage.totalUsers")}</span>
      <strong className="platform-admin-value">{users.length}</strong>
    </div>
    <div className="platform-admin-card">
      <span className="platform-admin-label">{t("adminPage.totalFlyers")}</span>
      <strong className="platform-admin-value">{flyers.length}</strong>
    </div>
    <div className="platform-admin-card">
      <span className="platform-admin-label">{t("adminPage.totalCompanies")}</span>
      <strong className="platform-admin-value">{companies.length}</strong>
    </div>
  </div>
);

export const PlatformAdminUsersTable = ({ users, t }) => (
  <table className="campaigns-table">
    <thead>
      <tr>
        <th>{t("adminPage.username")}</th>
        <th>{t("adminPage.displayName")}</th>
        <th>{t("adminPage.status")}</th>
        <th>{t("adminPage.location")}</th>
        <th>{t("adminPage.registeredAt")}</th>
        <th>{t("adminPage.lastLogin")}</th>
      </tr>
    </thead>
    <tbody>
      {users.map((user) => (
        <tr key={user.id} className="campaign-row-disabled">
          <td>{user.username || "-"}</td>
          <td>{user.displayName || "-"}</td>
          <td>
            <span className={`status ${user.isActive ? "live" : "completed"}`}>
              {user.isActive ? t("adminPage.active") : t("adminPage.inactive")}
            </span>
          </td>
          <td className="platform-admin-text-cell">{formatLocation(user.location)}</td>
          <td>{formatDate(user.createdAt)}</td>
          <td>{formatDate(user.lastLoginAt)}</td>
        </tr>
      ))}
      {users.length === 0 && (
        <tr>
          <td colSpan="6" className="platform-admin-empty-cell">
            {t("adminPage.noUsers")}
          </td>
        </tr>
      )}
    </tbody>
  </table>
);

export const PlatformAdminCompaniesTable = ({
  companies,
  grantAmounts,
  grantingCompanyId,
  onGrantAmountChange,
  onGrantTokens,
  t,
}) => (
  <div className="platform-admin-company-panel">
    <table className="campaigns-table">
      <thead>
        <tr>
          <th>{t("adminPage.companyDisplayName")}</th>
          <th>{t("adminPage.status")}</th>
          <th>{t("adminPage.industry")}</th>
          <th>{t("adminPage.contact")}</th>
          <th>{t("adminPage.companyTokens")}</th>
          <th>{t("adminPage.grantTokens")}</th>
          <th>{t("adminPage.createdAt")}</th>
          <th>{t("adminPage.walletUpdatedAt")}</th>
        </tr>
      </thead>
      <tbody>
        {companies.map((company) => (
          <tr key={company.id} className="campaign-row-disabled">
            <td className="platform-admin-text-cell">
              {company.companyDisplayName || "-"}
            </td>
            <td>
              <span className={`status ${company.isActive ? "live" : "completed"}`}>
                {company.isActive ? t("adminPage.active") : t("adminPage.inactive")}
              </span>
            </td>
            <td>{company.nature || "-"}</td>
            <td>{company.contact || "-"}</td>
            <td>{company.walletBalance ?? 0}</td>
            <td>
              <div className="platform-admin-grant-controls">
                <input
                  type="number"
                  min="1"
                  value={grantAmounts[company.id] || ""}
                  onChange={(event) => onGrantAmountChange(company.id, event.target.value)}
                  placeholder={t("adminPage.grantAmountPlaceholder")}
                  className="platform-admin-grant-input"
                />
                <button
                  type="button"
                  className="platform-admin-grant-button"
                  onClick={() => onGrantTokens(company.id)}
                  disabled={grantingCompanyId === company.id}
                >
                  {grantingCompanyId === company.id
                    ? t("adminPage.granting")
                    : t("adminPage.grantButton")}
                </button>
              </div>
            </td>
            <td>{formatDate(company.createdAt)}</td>
            <td>{formatDate(company.walletUpdatedAt)}</td>
          </tr>
        ))}
        {companies.length === 0 && (
          <tr>
            <td colSpan="8" className="platform-admin-empty-cell">
              {t("adminPage.noCompanies")}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

export const PlatformAdminFlyersTable = ({ flyers, t }) => {
  const formattedFlyers = flyers.map((flyer) => {
    const lottery = flyer.lottery || {};
    const coupon = flyer.coupon || {};
    const maxUsers = Number(lottery.maxUsers) || 0;
    const claims = Number(lottery.claims) || 0;
    const browseRate = maxUsers > 1 ? (claims / (maxUsers - 1)) * 100 : 0;
    const totalReached = Number(lottery.userReached) || 0;
    const downloadCount = Number(coupon.downloadCount) || 0;
    const downloadRate = totalReached > 0 ? (downloadCount / totalReached) * 100 : 0;
    const companyName =
      flyer.companyDisplayName || flyer.companyName || flyer.companyId || "-";

    return {
      id: flyer.id,
      companyName,
      adTitle: flyer.header || `${t("adminPage.untitledFlyer")} ${flyer.id.slice(0, 6)}`,
      status: getFlyerStatusLabel(flyer.status),
      adType: flyer.type
        ? flyer.type.charAt(0).toUpperCase() + flyer.type.slice(1)
        : "-",
      totalReached,
      browseRate: browseRate > 0 ? `${browseRate.toFixed(2)}%` : "-",
      totalBudget: lottery.pool ? `HK$${(lottery.pool * 0.02).toFixed(2)}` : "-",
      remainingPool: lottery.remaining
        ? `HK$${(lottery.remaining * 0.02).toFixed(2)}`
        : "-",
      downloadRate: downloadRate > 0 ? `${downloadRate.toFixed(2)}%` : "-",
      createdAt: formatDate(flyer.createdAt),
    };
  });

  return (
    <table className="campaigns-table">
      <thead>
        <tr>
          <th>{t("adminPage.company")}</th>
          <th>{t("dashboard.adTitle")}</th>
          <th>{t("dashboard.status")}</th>
          <th>{t("dashboard.adType")}</th>
          <th>{t("dashboard.totalReached")}</th>
          <th>{t("dashboard.browseRate")}</th>
          <th>{t("dashboard.totalBudget")}</th>
          <th>{t("dashboard.remainingPool")}</th>
          <th>{t("dashboard.downloadRate")}</th>
          <th>{t("adminPage.createdAt")}</th>
        </tr>
      </thead>
      <tbody>
        {formattedFlyers.map((flyer) => (
          <tr key={flyer.id} className="campaign-row-disabled">
            <td className="platform-admin-text-cell">{flyer.companyName}</td>
            <td className="ad-title" title={flyer.adTitle}>
              {flyer.adTitle}
            </td>
            <td>
              <span className={`status ${flyer.status.toLowerCase()}`}>
                {flyer.status}
              </span>
            </td>
            <td>{flyer.adType}</td>
            <td>{flyer.totalReached}</td>
            <td>{flyer.browseRate}</td>
            <td>{flyer.totalBudget}</td>
            <td>{flyer.remainingPool}</td>
            <td>{flyer.downloadRate}</td>
            <td>{flyer.createdAt}</td>
          </tr>
        ))}
        {formattedFlyers.length === 0 && (
          <tr>
            <td colSpan="10" className="platform-admin-empty-cell">
              {t("adminPage.noFlyers")}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};