import React from "react";
import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";

import { isSuperAdmin } from "../../utils/AuthUtil";
import {
  PlatformAdminFlyersTable,
  PlatformAdminSummary,
  usePlatformAdminData,
} from "./PlatformAdminShared";
import "../../components/Dashboard/CampaignTable.css";
import "./PlatformAdmin.css";

const PlatformAdmin = () => {
  const { t } = useTranslation();
  const { users, companies, flyers, totalUsersCount, loading, error } = usePlatformAdminData();

  if (!isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="platform-admin-page">
      <PlatformAdminSummary
        users={users}
        companies={companies}
        flyers={flyers}
        totalUsersCount={totalUsersCount}
        t={t}
      />

      <div className="campaign-table">
        <div className="table-container">
          {loading ? (
            <div className="table-loading">{t("adminPage.loading")}</div>
          ) : error ? (
            <div className="table-loading">{error}</div>
          ) : (
            <PlatformAdminFlyersTable flyers={flyers} t={t} />
          )}
        </div>
      </div>
    </div>
  );
};

export default PlatformAdmin;