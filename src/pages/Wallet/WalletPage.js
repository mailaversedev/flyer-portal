import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import ApiService from "../../services/ApiService";
import CreditRequestModal from "./CreditRequestModal";
import "./WalletPage.css";

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toLocaleString();
};

const WalletPage = () => {
  const { t } = useTranslation();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [purchasingBundleCode, setPurchasingBundleCode] = useState("");
  const [showCreditModal, setShowCreditModal] = useState(false);

  const loadWallet = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [walletResponse, transactionsResponse] = await Promise.all([
        ApiService.getCompanyWallet(),
        ApiService.getWalletTransactions(20, 0),
      ]);

      setWallet(walletResponse.success ? walletResponse.data : null);
      setTransactions(transactionsResponse.success ? transactionsResponse.data : []);
    } catch (loadError) {
      console.error("Failed to load wallet page", loadError);
      setError(t("walletPage.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [feedback]);

  const bundles = wallet?.bundles || [];
  const availableCreditBalanceHkd = Number(wallet?.creditBalanceHkd) || 0;

  const formatWalletValue = (value, unit = "TOKEN") => {
    if (unit === "HKD") {
      return `HK$${(Number(value) || 0).toFixed(2)}`;
    }

    return `${Number(value) || 0} ${t("walletPage.tokensShort")}`;
  };

  const handlePurchaseBundle = async (bundle) => {
    try {
      setPurchasingBundleCode(bundle.code);
      setFeedback(null);

      const response = await ApiService.purchaseCompanyBundle(bundle.code);

      if (!response?.success) {
        throw new Error(t("walletPage.purchaseError"));
      }

      await loadWallet();
      setFeedback({
        type: "success",
        message: t("walletPage.purchaseSuccess", {
          bundle: bundle.title,
          tokens: bundle.tokens,
        }),
      });
    } catch (purchaseError) {
      console.error("Failed to purchase wallet bundle", purchaseError);
      setFeedback({
        type: "error",
        message: purchaseError.message || t("walletPage.purchaseError"),
      });
    } finally {
      setPurchasingBundleCode("");
    }
  };

  const handleCreditRequestSuccess = () => {
    setShowCreditModal(false);
    setFeedback({
      type: "success",
      message: "Thank you. The Amount will be credited within 12hours. Please kindly email us if you have any troubles.",
    });
  };

  return (
    <div className="wallet-page">
      <div className="wallet-page-header">
        <div>
          <h2>{t("walletPage.title")}</h2>
          <p>{t("walletPage.subtitle")}</p>
        </div>
        <button
          className="wallet-request-credit-btn"
          onClick={() => setShowCreditModal(true)}
        >
          Request Credit
        </button>
      </div>

      {feedback ? (
        <div className={`wallet-page-feedback ${feedback.type}`}>{feedback.message}</div>
      ) : null}

      {loading ? (
        <div className="wallet-page-panel">{t("walletPage.loading")}</div>
      ) : error ? (
        <div className="wallet-page-panel wallet-page-error">{error}</div>
      ) : (
        <>
          <div className="wallet-summary-grid">
            <div className="wallet-page-panel wallet-balance-panel">
              <span className="wallet-kicker">{t("walletPage.balanceLabel")}</span>
              <strong className="wallet-balance-value">
                {wallet?.balance ?? 0} {wallet?.currency || "TOKEN"}
              </strong>
              <p>{t("walletPage.balanceHint")}</p>
              <p>
                {t("walletPage.freeAttemptsSummary", {
                  remaining: wallet?.dailyFreeAttemptsRemaining ?? 0,
                  total: wallet?.dailyFreeAttemptsLimit ?? 3,
                })}
              </p>
            </div>

            <div className="wallet-page-panel wallet-balance-panel wallet-credit-panel">
              <span className="wallet-kicker">{t("walletPage.creditBalanceLabel")}</span>
              <strong className="wallet-balance-value">
                HK${availableCreditBalanceHkd.toFixed(2)}
              </strong>
              <p>{t("walletPage.creditBalanceHint")}</p>
            </div>
          </div>

          <section className="wallet-section">
            <div className="wallet-section-header">
              <h3>{t("walletPage.transactionsTitle")}</h3>
              <p>{t("walletPage.transactionsSubtitle")}</p>
            </div>

            <div className="wallet-page-panel wallet-transactions-panel">
              {transactions.length === 0 ? (
                <div className="wallet-empty-state">{t("walletPage.emptyTransactions")}</div>
              ) : (
                <table className="wallet-transactions-table">
                  <thead>
                    <tr>
                      <th>{t("walletPage.transactionType")}</th>
                      <th>{t("walletPage.description")}</th>
                      <th>{t("walletPage.amount")}</th>
                      <th>{t("walletPage.newBalance")}</th>
                      <th>{t("walletPage.createdAt")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td>{transaction.type}</td>
                        <td>{transaction.description || "-"}</td>
                        <td>{formatWalletValue(transaction.amount, transaction.unit)}</td>
                        <td>{formatWalletValue(transaction.newBalance, transaction.unit)}</td>
                        <td>{formatDate(transaction.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="wallet-section">
            <div className="wallet-section-header">
              <h3>{t("walletPage.bundlesTitle")}</h3>
              <p>{t("walletPage.bundlesSubtitle")}</p>
            </div>

            <div className="wallet-card-grid">
              {bundles.map((bundle) => (
                <article key={bundle.code} className="wallet-page-panel wallet-card">
                  <div className="wallet-card-row">
                    <strong>{bundle.title}</strong>
                    <span className="wallet-badge active">HK${bundle.priceHkd}</span>
                  </div>
                  <div className="wallet-card-metric">
                    {bundle.tokens} {t("walletPage.tokensLabel")}
                  </div>
                  <p>{bundle.description}</p>
                  <p>
                    {t("walletPage.bundleRate", {
                      price: (bundle.priceHkd / bundle.tokens).toFixed(2),
                    })}
                  </p>
                  <button
                    type="button"
                    className="wallet-card-action"
                    onClick={() => handlePurchaseBundle(bundle)}
                    disabled={
                      purchasingBundleCode === bundle.code ||
                      availableCreditBalanceHkd < Number(bundle.priceHkd)
                    }
                  >
                    {purchasingBundleCode === bundle.code
                      ? t("walletPage.purchasing")
                      : t("walletPage.purchaseButton")}
                  </button>
                  {availableCreditBalanceHkd < Number(bundle.priceHkd) ? (
                    <span className="wallet-card-note">
                      {t("walletPage.insufficientCredit")}
                    </span>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {showCreditModal && (
        <CreditRequestModal
          onClose={() => setShowCreditModal(false)}
          onSuccess={handleCreditRequestSuccess}
        />
      )}
    </div>
  );
};

export default WalletPage;