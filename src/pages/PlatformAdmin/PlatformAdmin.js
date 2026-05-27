import React, { useState } from "react";
import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

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
  const navigate = useNavigate();
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
  const [deletingFlyerId, setDeletingFlyerId] = useState("");
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

  const handleDeleteFlyer = async (flyer) => {
    const flyerTitle = flyer?.header || `${t("adminPage.untitledFlyer")} ${flyer?.id?.slice(0, 6) || ""}`;

    if (!window.confirm(t("adminPage.deleteFlyerConfirm", { title: flyerTitle }))) {
      return;
    }

    try {
      setDeletingFlyerId(flyer.id);
      setStatusFeedback(null);

      await ApiService.deleteAdminFlyer(flyer.id);

      setFlyers((prev) => prev.filter((entry) => entry.id !== flyer.id));
      setStatusFeedback({
        type: "success",
        message: t("adminPage.flyerDeleteSuccess"),
      });
    } catch (deleteError) {
      console.error("Failed to delete flyer", deleteError);
      setStatusFeedback({
        type: "error",
        message: deleteError.message || t("adminPage.flyerDeleteError"),
      });
    } finally {
      setDeletingFlyerId("");
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
              onOpenFlyer={navigate}
              onUpdateFlyerStatus={handleUpdateFlyerStatus}
              onDeleteFlyer={handleDeleteFlyer}
              deletingFlyerId={deletingFlyerId}
              updatingFlyerId={updatingFlyerId}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PlatformAdmin;