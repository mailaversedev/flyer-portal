import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import ApiService from "../../services/ApiService";
import { PlatformAdminCouponClaimsTable } from "../../components/PlatformAdmin/PlatformAdminCouponClaimsTable";
import "../../components/Dashboard/CampaignTable.css";
import "../PlatformAdmin/PlatformAdmin.css";

const PAGE_SIZE = 20;

const CouponClaims = () => {
  const { t } = useTranslation();
  const [claims, setClaims] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadClaims = async () => {
      try {
        const response = await ApiService.getCompanyCouponClaims({ limit: PAGE_SIZE });
        if (!isMounted) return;

        if (!response?.success) {
          throw new Error(response?.message || t("adminPage.loadError"));
        }

        setClaims(Array.isArray(response.data) ? response.data : []);
        setNextCursor(response.nextCursor || null);
      } catch (loadError) {
        if (isMounted) {
          setError(loadError.message || t("adminPage.loadError"));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadClaims();

    return () => {
      isMounted = false;
    };
  }, [t]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;

    try {
      setLoadingMore(true);
      const response = await ApiService.getCompanyCouponClaims({
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });

      if (!response?.success) {
        throw new Error(response?.message || t("adminPage.loadError"));
      }

      setClaims((previous) => [...previous, ...(response.data || [])]);
      setNextCursor(response.nextCursor || null);
    } catch (loadError) {
      setError(loadError.message || t("adminPage.loadError"));
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="platform-admin-page">
      <section className="campaign-table">
        <div className="table-container">
          {loading ? (
            <div className="table-loading">{t("adminPage.loading")}</div>
          ) : error ? (
            <div className="table-loading">{error}</div>
          ) : (
            <PlatformAdminCouponClaimsTable
              claims={claims}
              t={t}
              userView
              emptyMessage={t("adminPage.noCouponClaims")}
            />
          )}
        </div>
        {!loading && !error && nextCursor && (
          <div className="platform-admin-load-more-wrap">
            <button
              type="button"
              className="platform-admin-page-button"
              onClick={loadMore}
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

export default CouponClaims;
