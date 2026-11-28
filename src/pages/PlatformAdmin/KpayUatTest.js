import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ApiService from "../../services/ApiService";

const STORAGE_KEY = "kpayAdminUatPaymentId";

export default function KpayUatTest() {
  const { t, i18n } = useTranslation();
  const [paymentId] = useState(() => (
    new URLSearchParams(window.location.search).get("kpayPaymentId") ||
    sessionStorage.getItem(STORAGE_KEY) || ""
  ));
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async (id) => {
    try {
      setError("");
      const response = await ApiService.getKpayOrder(id);
      if (!response?.success || response.data?.purpose !== "admin_uat") {
        throw new Error(t("adminPage.kpayTestLoadError"));
      }
      setPayment(response.data);
    } catch (loadError) {
      console.error("Failed to retrieve KPay UAT test", loadError);
      setError(loadError.message || t("adminPage.kpayTestLoadError"));
    }
  };

  useEffect(() => {
    if (paymentId) refresh(paymentId);
    // Refresh on return; subsequent checks are explicitly triggered by the admin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  const createTest = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await ApiService.createKpayOrder({
        purpose: "admin_uat",
        amount: 5,
        idempotencyKey: window.crypto.randomUUID(),
        language: i18n.resolvedLanguage || "zh-HK",
      });
      if (!response?.success || !response.data?.paymentId || !response.data?.checkoutUrl) {
        throw new Error(response?.message || t("adminPage.kpayTestCreateError"));
      }
      sessionStorage.setItem(STORAGE_KEY, response.data.paymentId);
      window.location.assign(response.data.checkoutUrl);
    } catch (createError) {
      console.error("Failed to create KPay UAT test", createError);
      setError(createError.message || t("adminPage.kpayTestCreateError"));
      setBusy(false);
    }
  };

  return (
    <section className="platform-admin-card">
      <h2>{t("adminPage.kpayTestTitle")}</h2>
      <p>{t("adminPage.kpayTestDescription")}</p>
      <div>
        <button type="button" className="nav-button" onClick={createTest} disabled={busy}>
          {busy ? t("adminPage.kpayTestCreating") : t("adminPage.kpayTestCreate")}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {payment && (
        <div role="status">
          <p>{t("adminPage.kpayTestOrder")}: {payment.managedOutTradeNo}</p>
          <p>{t("adminPage.kpayTestStatus")}: {payment.status}</p>
          <p>{t("adminPage.kpayTestUpdated")}: {payment.updatedAt}</p>
          {payment.failureReason && <p>{payment.failureReason}</p>}
          <button type="button" className="nav-button" onClick={() => refresh(paymentId)}>
            {t("adminPage.kpayTestRefresh")}
          </button>
        </div>
      )}
    </section>
  );
}
