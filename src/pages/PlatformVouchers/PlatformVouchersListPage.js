import React, { useCallback, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import ApiService from "../../services/ApiService";
import { isSuperAdmin } from "../../utils/AuthUtil";
import { PlatformVoucherCard, formatDate } from "./PlatformVouchers.shared";
import "./PlatformVouchers.css";

const PlatformVouchersListPage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingVoucherId, setDeletingVoucherId] = useState("");

  const loadVouchers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ApiService.getAdminVouchers();
      setVouchers(Array.isArray(response?.data) ? response.data : []);
    } catch (loadError) {
      console.error("Failed to load vouchers", loadError);
      setError(loadError.message || t("voucherAdminPage.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleDeleteVoucher = useCallback(
    async (voucher) => {
      const voucherId = voucher?.id;

      if (!voucherId) {
        return;
      }

      const confirmed = window.confirm(
        t("voucherAdminPage.deleteVoucherConfirm", {
          merchant: voucher.merchant || t("voucherAdminPage.previewMerchant"),
        }),
      );

      if (!confirmed) {
        return;
      }

      try {
        setDeletingVoucherId(voucherId);
        setError("");
        setSuccess("");

        const response = await ApiService.deleteAdminVoucher(voucherId);

        if (!response?.success) {
          throw new Error(response?.message || t("voucherAdminPage.deleteVoucherError"));
        }

        setVouchers((current) => current.filter((entry) => entry.id !== voucherId));
        setSuccess(t("voucherAdminPage.deleteVoucherSuccess"));
      } catch (deleteError) {
        console.error("Failed to delete voucher", deleteError);
        setError(deleteError.message || t("voucherAdminPage.deleteVoucherError"));
      } finally {
        setDeletingVoucherId("");
      }
    },
    [t],
  );

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  useEffect(() => {
    if (location.state?.successMessage) {
      setSuccess(location.state.successMessage);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  if (!isSuperAdmin()) {
    return <Navigate to="/platform-admin" replace />;
  }

  return (
    <div className="platform-vouchers-page">
      <section className="platform-vouchers-list-card">
        <div className="platform-vouchers-header-row">
          <div className="platform-vouchers-header">
            <h2>{t("voucherAdminPage.listTitle")}</h2>
            <p>{t("voucherAdminPage.listSubtitle")}</p>
          </div>
          <button
            type="button"
            className="platform-vouchers-primary-button"
            onClick={() => {
              setError("");
              setSuccess("");
              navigate("/platform-vouchers/create");
            }}
          >
            {t("voucherAdminPage.openCreate")}
          </button>
        </div>

        {error ? <div className="platform-vouchers-message error">{error}</div> : null}
        {success ? <div className="platform-vouchers-message success">{success}</div> : null}

        {loading ? (
          <div className="platform-vouchers-state">{t("voucherAdminPage.loading")}</div>
        ) : vouchers.length === 0 ? (
          <div className="platform-vouchers-state">{t("voucherAdminPage.empty")}</div>
        ) : (
          <div className="platform-vouchers-card-grid">
            {vouchers.map((voucher) => (
              <PlatformVoucherCard
                key={voucher.id}
                cardKey={voucher.id}
                t={t}
                value={{
                  ...voucher,
                  validity: formatDate(voucher.expiryDate),
                }}
                onDelete={deletingVoucherId === voucher.id ? null : handleDeleteVoucher}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default PlatformVouchersListPage;