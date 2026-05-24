import React from "react";
import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";

import { isSuperAdmin } from "../../utils/AuthUtil";
import {
  PlatformAdminUsersTable,
  usePlatformAdminData,
} from "./PlatformAdminShared";
import "../../components/Dashboard/CampaignTable.css";
import "./PlatformAdmin.css";

const PlatformAdminUsersPage = () => {
  const { t } = useTranslation();
  const { users, loading, error } = usePlatformAdminData();

  if (!isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="platform-admin-page">
      <div className="campaign-table">
        <div className="table-container">
          {loading ? (
            <div className="table-loading">{t("adminPage.loading")}</div>
          ) : error ? (
            <div className="table-loading">{error}</div>
          ) : (
            <PlatformAdminUsersTable users={users} t={t} />
          )}
        </div>
      </div>
    </div>
  );
};

export default PlatformAdminUsersPage;