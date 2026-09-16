import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import ApiService from "../../services/ApiService";
import i18n, { applyLocale, normalizeLocale } from "../../i18n";
import RegistrationForm from "../../components/Login/RegistrationForm";
import ResetPasswordForm from "../../components/Login/ResetPasswordForm";

import "./StaffLogin.css";

const StaffLogin = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [locale, setLocale] = useState(
    normalizeLocale(localStorage.getItem("locale") || i18n.resolvedLanguage),
  );

  const isRegistering = mode === "register";
  const isResetting = mode === "reset";

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await ApiService.loginStaff(username, password);
      if (!response.success)
        throw new Error(response.message || t("login.loginFailed"));
      ApiService.setAccessToken(response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));
      await applyLocale(response.data.user?.locale || locale);
      if (response.data.company) {
        localStorage.setItem("company", JSON.stringify(response.data.company));
        ApiService.setCurrentCompany(response.data.company);
      }
      navigate("/dashboard");
    } catch (error) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleLocaleChange = async (event) => {
    const normalizedLocale = await applyLocale(event.target.value);
    setLocale(normalizedLocale);
  };

  return (
    <div className="staff-login-container">
      <div className="page-locale-switcher">
        <label htmlFor="login-locale">{t("common.language")}</label>
        <select
          id="login-locale"
          value={locale}
          onChange={handleLocaleChange}
          className="login-locale-select"
        >
          <option value="en">{t("common.english")}</option>
          <option value="zh-HK">{t("common.traditionalChinese")}</option>
        </select>
      </div>

      <div className="login-card">
        <h2>
          {isRegistering
            ? t("login.companyOnboarding")
            : mode === "forgot"
              ? t("login.forgotPassword")
              : isResetting
                ? t("login.resetPassword")
                : t("login.portalLogin")}
        </h2>

        {mode === "login" && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="username">{t("login.username")}</label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={t("login.enterUsername")}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">{t("login.password")}</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("login.enterPassword")}
                required
              />
            </div>
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? t("login.loggingIn") : t("login.login")}
            </button>
          </form>
        )}

        {isRegistering && (
          <RegistrationForm t={t} onSuccess={() => setMode("login")} />
        )}

        {(mode === "forgot" || isResetting) && (
          <ResetPasswordForm
            t={t}
            showResetFields={isResetting}
            onCodeSent={() => setMode("reset")}
            onSuccess={() => setMode("login")}
          />
        )}

        <div className="toggle-container">
          {mode === "login" && (
            <button
              type="button"
              className="toggle-button"
              onClick={() => setMode("forgot")}
            >
              {t("login.forgotPassword")}
            </button>
          )}
          {(mode === "forgot" || isResetting) && (
            <button
              type="button"
              className="toggle-button"
              onClick={() => setMode("login")}
            >
              {t("login.backToLogin")}
            </button>
          )}
          {mode !== "forgot" && !isResetting && (
            <button
              type="button"
              className="toggle-button"
              onClick={() => setMode(isRegistering ? "login" : "register")}
            >
              {isRegistering
                ? t("login.alreadyHaveAccount")
                : t("login.newCompany")}
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="loading-indicator-overlay">
          <div className="loading-indicator-content">
            <div className="spinner" />
            <span className="loading-indicator-text">
              {t("login.loggingIn")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffLogin;
