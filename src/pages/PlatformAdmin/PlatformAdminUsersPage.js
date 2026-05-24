import React, { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";

import ApiService from "../../services/ApiService";
import { isSuperAdmin } from "../../utils/AuthUtil";
import {
  PlatformAdminUsersTable,
} from "./PlatformAdminShared";
import "../../components/Dashboard/CampaignTable.css";
import "./PlatformAdmin.css";

const PAGE_SIZE = 20;

const PlatformAdminUsersPage = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [nextToken, setNextToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const loadMoreRef = useRef(null);

  const loadAudienceEntries = useCallback(
    async ({ token = "", replace = false } = {}) => {
      try {
        if (replace) {
          setLoading(true);
          setError("");
        } else {
          setLoadingMore(true);
        }

        const response = await ApiService.getAdminUsers({
          limit: PAGE_SIZE,
          nextToken: token,
        });
        const nextEntries = response?.success ? response.data?.entries || [] : [];

        setEntries((prev) => (replace ? nextEntries : [...prev, ...nextEntries]));
        setNextToken(response?.success ? response.nextToken || null : null);
      } catch (loadError) {
        console.error("Failed to load platform audience lists", loadError);
        setError(loadError.message || t("adminPage.loadError"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [t],
  );

  useEffect(() => {
    loadAudienceEntries({ replace: true });
  }, [loadAudienceEntries]);

  useEffect(() => {
    if (!nextToken || loading || loadingMore || error) {
      return undefined;
    }

    const target = loadMoreRef.current;

    if (!target) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entriesList) => {
        if (entriesList[0]?.isIntersecting) {
          loadAudienceEntries({ token: nextToken, replace: false });
        }
      },
      {
        rootMargin: "280px 0px",
      },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [error, loadAudienceEntries, loading, loadingMore, nextToken]);

  if (!isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="platform-admin-page">
      {loading || error ? (
        <div className="campaign-table">
          <div className="table-container">
            {loading ? (
              <div className="table-loading">{t("adminPage.loading")}</div>
            ) : (
              <div className="table-loading">{error}</div>
            )}
          </div>
        </div>
      ) : (
        <section className="campaign-table">
          <div className="table-container">
            <PlatformAdminUsersTable users={entries} t={t} />
          </div>

          {loadingMore && (
            <div className="platform-admin-infinite-state">
              {t("adminPage.loadingMore")}
            </div>
          )}

          {!nextToken && entries.length > 0 && (
            <div className="platform-admin-infinite-state complete">
              {t("adminPage.audienceEnd")}
            </div>
          )}

          {nextToken && <div ref={loadMoreRef} className="platform-admin-load-more-trigger" />}
        </section>
      )}
    </div>
  );
};

export default PlatformAdminUsersPage;