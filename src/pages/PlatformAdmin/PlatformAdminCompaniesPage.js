import React, { useEffect, useState } from "react";
import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";

import ApiService from "../../services/ApiService";
import { isSuperAdmin } from "../../utils/AuthUtil";
import {
  PlatformAdminCompaniesTable,
  usePlatformAdminData,
} from "./PlatformAdminShared";
import "../../components/Dashboard/CampaignTable.css";
import "./PlatformAdmin.css";

const PlatformAdminCompaniesPage = () => {
  const { t } = useTranslation();
  const { companies, setCompanies, loading, error } = usePlatformAdminData();
  const [grantAmounts, setGrantAmounts] = useState({});
  const [grantingCompanyId, setGrantingCompanyId] = useState("");
  const [grantFeedback, setGrantFeedback] = useState(null);

  useEffect(() => {
    if (!grantFeedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setGrantFeedback(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [grantFeedback]);

  if (!isSuperAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleGrantTokens = async (companyId) => {
    const amount = Number.parseInt(grantAmounts[companyId], 10);

    if (!Number.isFinite(amount) || amount <= 0) {
      setGrantFeedback({
        type: "error",
        message: t("adminPage.invalidGrantAmount"),
      });
      return;
    }

    try {
      setGrantingCompanyId(companyId);
      setGrantFeedback(null);

      const response = await ApiService.grantCompanyTokens(companyId, { amount });

      setCompanies((prev) =>
        prev.map((company) =>
          company.id === companyId
            ? {
                ...company,
                walletBalance: response.data.newBalance,
                walletUpdatedAt: new Date().toISOString(),
              }
            : company,
        ),
      );
      setGrantAmounts((prev) => ({
        ...prev,
        [companyId]: "",
      }));
      setGrantFeedback({
        type: "success",
        message: t("adminPage.grantSuccess"),
      });
    } catch (grantError) {
      console.error("Failed to grant company tokens", grantError);
      setGrantFeedback({
        type: "error",
        message: grantError.message || t("adminPage.grantError"),
      });
    } finally {
      setGrantingCompanyId("");
    }
  };

  return (
    <div className="platform-admin-page">
      {grantFeedback && (
        <div
          className={`platform-admin-feedback-popup ${grantFeedback.type === "error" ? "error" : "success"}`}
        >
          {grantFeedback.message}
        </div>
      )}

      <div className="campaign-table">
        <div className="table-container">
          {loading ? (
            <div className="table-loading">{t("adminPage.loading")}</div>
          ) : error ? (
            <div className="table-loading">{error}</div>
          ) : (
            <PlatformAdminCompaniesTable
              companies={companies}
              grantAmounts={grantAmounts}
              grantingCompanyId={grantingCompanyId}
              onGrantAmountChange={(companyId, value) =>
                setGrantAmounts((prev) => ({
                  ...prev,
                  [companyId]: value,
                }))
              }
              onGrantTokens={handleGrantTokens}
              t={t}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PlatformAdminCompaniesPage;