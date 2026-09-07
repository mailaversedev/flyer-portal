import React from "react";
import { Link } from "react-router";

import { formatHkd } from "./index";

export const PlatformAdminSummary = ({ collectionTotals, t }) => (
  <div className="platform-admin-summary">
    <div className="platform-admin-card"><span className="platform-admin-label">{t("adminPage.totalUsers")}</span><strong className="platform-admin-value">{collectionTotals.users}</strong></div>
    <div className="platform-admin-card"><span className="platform-admin-label">{t("adminPage.totalFlyers")}</span><strong className="platform-admin-value">{collectionTotals.flyers}</strong></div>
    <div className="platform-admin-card"><span className="platform-admin-label">{t("adminPage.totalFlyerGenerations")}</span><strong className="platform-admin-value">{collectionTotals.flyerGenerations}</strong></div>
    <div className="platform-admin-card"><span className="platform-admin-label">{t("adminPage.totalCompanies")}</span><strong className="platform-admin-value">{collectionTotals.companies}</strong></div>
    <div className="platform-admin-card">
      <Link to="/platform-admin/credit-requests" className="platform-admin-card-link">
        <span className="platform-admin-label">{t("adminPage.totalCreditRequests")}</span>
        <strong className="platform-admin-value">{collectionTotals.creditRequests}</strong>
        <span className="platform-admin-secondary-value">{t("adminPage.totalCreditRequestAmount", { amount: formatHkd(collectionTotals.creditRequestAmountHkd) })}</span>
      </Link>
    </div>
  </div>
);
