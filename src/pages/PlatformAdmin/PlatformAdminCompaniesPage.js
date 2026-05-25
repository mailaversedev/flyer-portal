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
  const [managingCompanyId, setManagingCompanyId] = useState("");
  const [grantFeedback, setGrantFeedback] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [manageForm, setManageForm] = useState({
    amountHkd: "",
    receiptFile: null,
    note: "",
  });
  const [manageFormError, setManageFormError] = useState("");

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

  const resetManageForm = () => {
    setManageForm({
      amountHkd: "",
      receiptFile: null,
      note: "",
    });
    setManageFormError("");
  };

  const handleOpenManageModal = (company) => {
    setSelectedCompany(company);
    resetManageForm();
  };

  const handleCloseManageModal = () => {
    if (managingCompanyId) {
      return;
    }

    setSelectedCompany(null);
    resetManageForm();
  };

  const handleReceiptChange = (event) => {
    const file = event.target.files?.[0] || null;

    if (!file) {
      setManageForm((prev) => ({
        ...prev,
        receiptFile: null,
      }));
      return;
    }

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setManageFormError(t("adminPage.receiptFileTypeError"));
      event.target.value = "";
      return;
    }

    setManageFormError("");
    setManageForm((prev) => ({
      ...prev,
      receiptFile: file,
    }));
  };

  const handleManageWallet = async (event) => {
    event.preventDefault();

    if (!selectedCompany) {
      return;
    }

    const amountHkd = Number.parseFloat(manageForm.amountHkd);

    if (!Number.isFinite(amountHkd) || amountHkd <= 0) {
      setManageFormError(t("adminPage.invalidCreditAmount"));
      return;
    }

    if (!manageForm.receiptFile) {
      setManageFormError(t("adminPage.receiptRequired"));
      return;
    }

    try {
      setManagingCompanyId(selectedCompany.id);
      setGrantFeedback(null);
      setManageFormError("");

      const uploadResponse = await ApiService.uploadFile(
        manageForm.receiptFile,
        "wallet-receipts",
      );

      if (!uploadResponse?.success || !uploadResponse?.url) {
        throw new Error(t("adminPage.receiptUploadError"));
      }

      const response = await ApiService.manageCompanyWallet(selectedCompany.id, {
        amountHkd,
        receiptImageUrl: uploadResponse.url,
        note: manageForm.note.trim(),
      });

      setCompanies((prev) =>
        prev.map((company) =>
          company.id === selectedCompany.id
            ? {
                ...company,
                walletBalance: response.data.newBalance,
                walletCreditBalanceHkd: response.data.newCreditBalanceHkd,
                walletUpdatedAt: new Date().toISOString(),
              }
            : company,
        ),
      );
      setGrantFeedback({
        type: "success",
        message: t("adminPage.grantSuccess"),
      });
      setSelectedCompany(null);
      resetManageForm();
    } catch (grantError) {
      console.error("Failed to manage company wallet", grantError);
      setGrantFeedback({
        type: "error",
        message: grantError.message || t("adminPage.grantError"),
      });
    } finally {
      setManagingCompanyId("");
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
              managingCompanyId={managingCompanyId}
              onManageCompany={handleOpenManageModal}
              t={t}
            />
          )}
        </div>
      </div>

      {selectedCompany && (
        <div className="platform-admin-modal-overlay" onClick={handleCloseManageModal}>
          <div
            className="platform-admin-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="platform-admin-modal-header">
              <div>
                <h3>{t("adminPage.manageWalletTitle")}</h3>
                <p>
                  {t("adminPage.manageWalletSubtitle", {
                    company:
                      selectedCompany.companyDisplayName || selectedCompany.name || "-",
                  })}
                </p>
              </div>
              <button
                type="button"
                className="platform-admin-modal-close"
                onClick={handleCloseManageModal}
                aria-label={t("adminPage.dismissFeedback")}
              >
                ×
              </button>
            </div>

            <form className="platform-admin-modal-form" onSubmit={handleManageWallet}>
              <label className="platform-admin-field">
                <span>{t("adminPage.manageWalletAmountLabel")}</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={manageForm.amountHkd}
                  onChange={(event) =>
                    setManageForm((prev) => ({
                      ...prev,
                      amountHkd: event.target.value,
                    }))
                  }
                  placeholder={t("adminPage.manageWalletAmountPlaceholder")}
                />
              </label>

              <label className="platform-admin-field">
                <span>{t("adminPage.manageWalletReceiptLabel")}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleReceiptChange}
                />
                {manageForm.receiptFile ? (
                  <small>{manageForm.receiptFile.name}</small>
                ) : null}
              </label>

              <label className="platform-admin-field">
                <span>{t("adminPage.manageWalletNoteLabel")}</span>
                <textarea
                  rows="4"
                  value={manageForm.note}
                  onChange={(event) =>
                    setManageForm((prev) => ({
                      ...prev,
                      note: event.target.value,
                    }))
                  }
                  placeholder={t("adminPage.manageWalletNotePlaceholder")}
                />
              </label>

              {manageFormError ? (
                <div className="platform-admin-modal-error">{manageFormError}</div>
              ) : null}

              <div className="platform-admin-modal-actions">
                <button
                  type="button"
                  className="platform-admin-modal-secondary"
                  onClick={handleCloseManageModal}
                  disabled={Boolean(managingCompanyId)}
                >
                  {t("creation.back")}
                </button>
                <button
                  type="submit"
                  className="platform-admin-modal-primary"
                  disabled={managingCompanyId === selectedCompany.id}
                >
                  {managingCompanyId === selectedCompany.id
                    ? t("adminPage.managingWallet")
                    : t("adminPage.manageWalletSubmit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformAdminCompaniesPage;