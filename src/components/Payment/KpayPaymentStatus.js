import React from "react";
import { useTranslation } from "react-i18next";

export default function KpayPaymentStatus({ status, retry, dismiss }) {
  const { t } = useTranslation();
  if (["idle", "paid"].includes(status)) return null;
  return (
    <div role="status" aria-live="polite" className="wallet-page-panel">
      <p>{t(`kpayPayment.${status}`)}</p>
      {status !== "pending" && (
        <button type="button" className="nav-button" onClick={retry}>
          {t("kpayPayment.retry")}
        </button>
      )}
      {status === "failed" && (
        <button type="button" className="nav-button" onClick={dismiss}>
          {t("kpayPayment.dismiss")}
        </button>
      )}
    </div>
  );
}