import React, { useEffect, useState } from "react";
import { Link } from "react-router";
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

const formatHkd = (value) => `HK$${(Number(value) || 0).toFixed(2)}`;

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
  const [totalUsersCount, setTotalUsersCount] = useState(0);
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

        const nextUsers = usersResponse?.success
          ? usersResponse.data?.entries || usersResponse.data?.users || []
          : [];

        setUsers(nextUsers);
        setCompanies(companiesResponse.success ? companiesResponse.data : []);
        setFlyers(flyersResponse.success ? flyersResponse.data : []);
        setTotalUsersCount(
          usersResponse?.success
            ? Number(usersResponse.summary?.totalAudience) || nextUsers.length
            : 0,
        );
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
    totalUsersCount,
    setFlyers,
    setCompanies,
    loading,
    error,
  };
};

const getUserStatusMeta = (user, t) => {
  const normalizedStatus = `${user?.status || ""}`.trim().toLowerCase();

  if (normalizedStatus === "engaged") {
    return {
      className: "engaged",
      label: t("adminPage.engaged"),
    };
  }

  if (normalizedStatus === "inactive") {
    return {
      className: "completed",
      label: t("adminPage.inactive"),
    };
  }

  return {
    className: "live",
    label: t("adminPage.active"),
  };
};

export const PlatformAdminSummary = ({
  users,
  companies,
  flyers,
  totalUsersCount,
  t,
}) => (
  <div className="platform-admin-summary">
    <div className="platform-admin-card">
      <span className="platform-admin-label">{t("adminPage.totalUsers")}</span>
      <strong className="platform-admin-value">{totalUsersCount ?? users.length}</strong>
    </div>
    <div className="platform-admin-card">
      <span className="platform-admin-label">{t("adminPage.totalFlyers")}</span>
      <strong className="platform-admin-value">{flyers.length}</strong>
    </div>
    <div className="platform-admin-card">
      <span className="platform-admin-label">{t("adminPage.totalCompanies")}</span>
      <strong className="platform-admin-value">{companies.length}</strong>
    </div>
    <div className="platform-admin-card">
      <Link
        to="/platform-admin/credit-requests"
        className="platform-admin-card-link"
      >
        <span className="platform-admin-label">Credit Requests</span>
        <strong className="platform-admin-value">View &rarr;</strong>
      </Link>
    </div>
  </div>
);

export const PlatformAdminUsersTable = ({ users, t, emptyMessage = null }) => (
  <table className="campaigns-table platform-admin-users-table">
    <thead>
      <tr>
        <th className="platform-admin-user-column">{t("adminPage.username")}</th>
        <th className="platform-admin-name-column">{t("adminPage.displayName")}</th>
        <th className="platform-admin-status-column">{t("adminPage.status")}</th>
        <th className="platform-admin-location-column">{t("adminPage.location")}</th>
        <th className="platform-admin-timestamp-column">{t("adminPage.registeredAt")}</th>
        <th className="platform-admin-timestamp-column">{t("adminPage.lastLogin")}</th>
      </tr>
    </thead>
    <tbody>
      {users.map((user) => (
        <tr key={`${user.source || "user"}-${user.id}`} className="campaign-row-disabled">
          <td className="platform-admin-user-column">{user.username || "-"}</td>
          <td className="platform-admin-name-column">{user.displayName || "-"}</td>
          <td className="platform-admin-status-column">
            <span className={`status ${getUserStatusMeta(user, t).className}`}>
              {getUserStatusMeta(user, t).label}
            </span>
          </td>
          <td className="platform-admin-text-cell platform-admin-location-column">
            {formatLocation(user.location)}
          </td>
          <td className="platform-admin-timestamp-column">{formatDate(user.createdAt)}</td>
          <td className="platform-admin-timestamp-column">{formatDate(user.lastLoginAt)}</td>
        </tr>
      ))}
      {users.length === 0 && (
        <tr>
          <td colSpan="6" className="platform-admin-empty-cell">
            {emptyMessage || t("adminPage.noUsers")}
          </td>
        </tr>
      )}
    </tbody>
  </table>
);

export const PlatformAdminCompaniesTable = ({
  companies,
  managingCompanyId,
  onManageCompany,
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
          <th>{t("adminPage.companyWalletCredit")}</th>
          <th>{t("adminPage.createdAt")}</th>
          <th>{t("adminPage.walletUpdatedAt")}</th>
          <th>{t("adminPage.actions")}</th>
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
            <td>{formatHkd(company.walletCreditBalanceHkd)}</td>
            <td>
              {formatDate(company.createdAt)}
            </td>
            <td>{formatDate(company.walletUpdatedAt)}</td>
            <td>
              <button
                type="button"
                className="platform-admin-manage-button"
                onClick={() => onManageCompany(company)}
                disabled={managingCompanyId === company.id}
              >
                {managingCompanyId === company.id
                  ? t("adminPage.managingWallet")
                  : t("adminPage.manageWalletButton")}
              </button>
            </td>
          </tr>
        ))}
        {companies.length === 0 && (
          <tr>
            <td colSpan="9" className="platform-admin-empty-cell">
              {t("adminPage.noCompanies")}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

export const PlatformAdminFlyersTable = ({
  flyers,
  t,
  onOpenFlyer,
  onUpdateFlyerStatus,
  onDeleteFlyer,
  deletingFlyerId = "",
  updatingFlyerId = "",
}) => {
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
      flyerType: flyer.type || "",
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
      rawStatus: flyer.status || "",
    };
  });

  const getEditRoute = (flyer) => {
    const flyerType = `${flyer.flyerType || flyer.adType || ""}`.trim().toLowerCase();

    if (flyerType === "leaflet") {
      return `/flyer/edit/leaflet/${flyer.id}`;
    }

    if (flyerType === "qr") {
      return `/flyer/edit/qr/${flyer.id}`;
    }

    return null;
  };

  const handleRowClick = (flyer) => {
    const route = getEditRoute(flyer);

    if (route && onOpenFlyer) {
      onOpenFlyer(route);
    }
  };

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
          <th>{t("adminPage.actions")}</th>
        </tr>
      </thead>
      <tbody>
        {formattedFlyers.map((flyer) => {
          const editRoute = getEditRoute(flyer);
          const isEditable = Boolean(editRoute);

          return (
          <tr
            key={flyer.id}
            className={`campaign-row ${isEditable ? "campaign-row-editable" : "campaign-row-disabled"}`}
            onClick={isEditable ? () => handleRowClick(flyer) : undefined}
            onKeyDown={
              isEditable
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleRowClick(flyer);
                    }
                  }
                : undefined
            }
            tabIndex={isEditable ? 0 : undefined}
            role={isEditable ? "button" : undefined}
          >
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
            <td>
              <div className="platform-admin-flyer-action-group">
                <button
                  type="button"
                  className="platform-admin-flyer-action-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onUpdateFlyerStatus(
                      flyer.id,
                      flyer.rawStatus === "active" ? "inactive" : "active",
                    );
                  }}
                  disabled={updatingFlyerId === flyer.id || deletingFlyerId === flyer.id}
                >
                  {updatingFlyerId === flyer.id
                    ? t("adminPage.updatingStatus")
                    : flyer.rawStatus === "active"
                      ? t("adminPage.markInactive")
                      : t("adminPage.markActive")}
                </button>
                <button
                  type="button"
                  className="platform-admin-flyer-action-button danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteFlyer(flyer);
                  }}
                  disabled={deletingFlyerId === flyer.id || updatingFlyerId === flyer.id}
                >
                  {deletingFlyerId === flyer.id
                    ? t("adminPage.deletingFlyer")
                    : t("adminPage.deleteFlyer")}
                </button>
              </div>
            </td>
          </tr>
        );})}
        {formattedFlyers.length === 0 && (
          <tr>
            <td colSpan="11" className="platform-admin-empty-cell">
              {t("adminPage.noFlyers")}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};