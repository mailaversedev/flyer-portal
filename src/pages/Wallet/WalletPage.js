import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import ApiService from "../../services/ApiService";
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

  useEffect(() => {
    const loadWallet = async () => {
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
    };

    loadWallet();
  }, [t]);

  const bundles = wallet?.bundles || [];
  const pricing = wallet?.pricing || [];

  return (
    <div className="wallet-page">
      <div className="wallet-page-header">
        <div>
          <h2>{t("walletPage.title")}</h2>
          <p>{t("walletPage.subtitle")}</p>
        </div>
      </div>

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
            </div>

            <div className="wallet-page-panel">
              <span className="wallet-kicker">{t("walletPage.offlineBillingTitle")}</span>
              <p>{t("walletPage.offlineBillingDescription")}</p>
              <p>{t("walletPage.starterCredit")}</p>
            </div>
          </div>

          <section className="wallet-section">
            <div className="wallet-section-header">
              <h3>{t("walletPage.pricingTitle")}</h3>
              <p>{t("walletPage.pricingSubtitle")}</p>
            </div>

            <div className="wallet-card-grid">
              {pricing.map((item) => (
                <article key={item.code} className="wallet-page-panel wallet-card">
                  <div className="wallet-card-row">
                    <strong>{item.title}</strong>
                    <span
                      className={`wallet-badge ${item.availability === "active" ? "active" : "muted"}`}
                    >
                      {item.availability === "active"
                        ? t("walletPage.active")
                        : t("walletPage.comingSoon")}
                    </span>
                  </div>
                  <div className="wallet-card-metric">
                    {item.tokens} {t("walletPage.tokensShort")}
                  </div>
                  <p>
                    {item.billingUnit === "edit"
                      ? t("walletPage.perEdit")
                      : t("walletPage.perGeneration")}
                  </p>
                </article>
              ))}
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
                </article>
              ))}
            </div>
          </section>

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
                        <td>{transaction.amount}</td>
                        <td>{transaction.newBalance}</td>
                        <td>{formatDate(transaction.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default WalletPage;