import React, { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";

import ApiService from "../../services/ApiService";
import { isSuperAdmin } from "../../utils/AuthUtil";
import { PlatformAdminVoucherRedemptionsTable } from "./PlatformAdminShared";
import "../../components/Dashboard/CampaignTable.css";
import "./PlatformAdmin.css";

const PAGE_SIZE = 20;

const PlatformAdminVoucherRedemptionsPage = () => {
  const { t } = useTranslation();
  const [redemptions, setRedemptions] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const loadRedemptions = useCallback(async ({ cursor = "", replace = false } = {}) => {
    try {
      if (replace) {
        setLoading(true);
        setError("");
      } else {
        setLoadingMore(true);
      }

      const response = await ApiService.getAdminVoucherRedemptions({
        limit: PAGE_SIZE,
        cursor,
      });

      if (!response?.success) {
        throw new Error(response?.message || t("adminPage.loadError"));
      }

      setRedemptions((previous) =>
        replace
          ? response.data || []
          : [...previous, ...(response.data || [])],
      );
      setNextCursor(response.nextCursor || null);
    } catch (loadError) {
      console.error("Failed to load admin voucher redemptions", loadError);
      setError(loadError.message || t("adminPage.loadError"));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [t]);

  useEffect(() => {
    loadRedemptions({ replace: true });
  }, [loadRedemptions]);

  if (!isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="platform-admin-page">
      <section className="campaign-table">
        <div className="platform-admin-section-header">
          <div>
            <h2 className="platform-admin-section-title">
              {t("adminPage.voucherRedemptionsTitle")}
            </h2>
            <p className="platform-admin-section-subtitle">
              {t("adminPage.voucherRedemptionsSubtitle")}
            </p>
          </div>
        </div>
        <div className="table-container">
          {loading ? (
            <div className="table-loading">{t("adminPage.loading")}</div>
          ) : error ? (
            <div className="table-loading">{error}</div>
          ) : (
            <PlatformAdminVoucherRedemptionsTable redemptions={redemptions} t={t} />
          )}
        </div>
        {!loading && !error && nextCursor && (
          <div className="platform-admin-load-more-wrap">
            <button
              type="button"
              className="platform-admin-page-button"
              onClick={() => loadRedemptions({ cursor: nextCursor })}
              disabled={loadingMore}
            >
              {loadingMore ? t("adminPage.loadingMore") : t("adminPage.loadMore")}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default PlatformAdminVoucherRedemptionsPage;
