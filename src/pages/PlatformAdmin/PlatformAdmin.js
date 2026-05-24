import React, { useState } from "react";
import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";

import ApiService from "../../services/ApiService";
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
  const {
    users,
    companies,
    flyers,
    totalUsersCount,
    setFlyers,
    loading,
    error,
  } = usePlatformAdminData();
  const [updatingFlyerId, setUpdatingFlyerId] = useState("");
  const [statusFeedback, setStatusFeedback] = useState(null);

  if (!isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleUpdateFlyerStatus = async (flyerId, status) => {
    try {
      setUpdatingFlyerId(flyerId);
      setStatusFeedback(null);

      const response = await ApiService.updateAdminFlyerStatus(flyerId, status);

      setFlyers((prev) =>
        prev.map((flyer) =>
          flyer.id === flyerId
            ? {
                ...flyer,
                status: response.data?.status || status,
                updatedAt: response.data?.updatedAt || new Date().toISOString(),
              }
            : flyer,
        ),
      );
      setStatusFeedback({
        type: "success",
        message: t("adminPage.flyerStatusUpdateSuccess"),
      });
    } catch (updateError) {
      console.error("Failed to update flyer status", updateError);
      setStatusFeedback({
        type: "error",
        message: updateError.message || t("adminPage.flyerStatusUpdateError"),
      });
    } finally {
      setUpdatingFlyerId("");
    }
  };

  return (
    <div className="platform-admin-page">
      {statusFeedback && (
        <div
          className={`platform-admin-feedback-popup ${statusFeedback.type === "error" ? "error" : "success"}`}
          role="status"
          aria-live="polite"
        >
          <span>{statusFeedback.message}</span>
          <button
            type="button"
            className="platform-admin-feedback-close"
            onClick={() => setStatusFeedback(null)}
            aria-label={t("adminPage.dismissFeedback")}
          >
            ×
          </button>
        </div>
      )}

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
            <PlatformAdminFlyersTable
              flyers={flyers}
              t={t}
              onUpdateFlyerStatus={handleUpdateFlyerStatus}
              updatingFlyerId={updatingFlyerId}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PlatformAdmin;