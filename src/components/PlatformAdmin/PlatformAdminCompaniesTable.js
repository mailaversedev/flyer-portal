import React from "react";

import { formatDate, formatHkd } from "./index";

export const PlatformAdminCompaniesTable = ({ companies, managingCompanyId, onManageCompany, t }) => (
  <div className="platform-admin-company-panel"><table className="campaigns-table"><thead><tr>
    <th>{t("adminPage.companyDisplayName")}</th><th>{t("adminPage.status")}</th><th>{t("adminPage.industry")}</th><th>{t("adminPage.contact")}</th><th>{t("adminPage.companyTokens")}</th><th>{t("adminPage.companyWalletCredit")}</th><th>{t("adminPage.createdAt")}</th><th>{t("adminPage.walletUpdatedAt")}</th><th>{t("adminPage.actions")}</th>
  </tr></thead><tbody>
    {companies.map((company) => <tr key={company.id} className="campaign-row-disabled">
      <td className="platform-admin-text-cell">{company.companyDisplayName || "-"}</td><td><span className={`status ${company.isActive ? "live" : "completed"}`}>{company.isActive ? t("adminPage.active") : t("adminPage.inactive")}</span></td><td>{company.nature || "-"}</td><td>{company.contact || "-"}</td><td>{company.walletBalance ?? 0}</td><td>{formatHkd(company.walletCreditBalanceHkd)}</td><td>{formatDate(company.createdAt)}</td><td>{formatDate(company.walletUpdatedAt)}</td><td><button type="button" className="platform-admin-manage-button" onClick={() => onManageCompany(company)} disabled={managingCompanyId === company.id}>{managingCompanyId === company.id ? t("adminPage.managingWallet") : t("adminPage.manageWalletButton")}</button></td>
    </tr>)}
    {companies.length === 0 && <tr><td colSpan="9" className="platform-admin-empty-cell">{t("adminPage.noCompanies")}</td></tr>}
  </tbody></table></div>
);
