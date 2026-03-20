import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import ApiService from "../../services/ApiService";
import i18n, { applyLocale, normalizeLocale } from "../../i18n";
import "./StaffLogin.css";

const StaffLogin = () => {
  const { t } = useTranslation();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyNature, setCompanyNature] = useState("");
  const [companyIconFile, setCompanyIconFile] = useState(null);
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [companyIndustries, setCompanyIndustries] = useState([]);
  const [isLoadingIndustries, setIsLoadingIndustries] = useState(true);
  const [locale, setLocale] = useState(
    normalizeLocale(localStorage.getItem("locale") || i18n.resolvedLanguage),
  );

  const [error, setError] = useState("");
  const [isSuccessMessage, setIsSuccessMessage] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCompanyIndustries = async () => {
      setIsLoadingIndustries(true);
      try {
        const response = await ApiService.getCompanyIndustries();
        if (response.success && Array.isArray(response.data)) {
          setCompanyIndustries(response.data);
        } else {
          setCompanyIndustries([]);
        }
      } catch (fetchError) {
        console.error("Failed to fetch company industries", fetchError);
        setCompanyIndustries([]);
      } finally {
        setIsLoadingIndustries(false);
      }
    };

    fetchCompanyIndustries();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSuccessMessage(false);
    setLoading(true);

    try {
      let response;
      if (isRegistering) {
        let companyIconUrl = "";
        if (companyIconFile) {
          try {
            const uploadResponse = await ApiService.uploadFile(
              companyIconFile,
              "companyIcon",
            );
            if (uploadResponse.success) {
              companyIconUrl = uploadResponse.url;
            } else {
              throw new Error("Failed to upload company icon");
            }
          } catch (uploadError) {
              setError(
                t("login.uploadCompanyIconFailed", {
                  message: uploadError.message,
                }),
              );
            setLoading(false);
            return;
          }
        }

        response = await ApiService.registerStaff({
          username,
          password,
          displayName,
          companyName,
          companyNature,
          companyIcon: companyIconUrl,
          address,
          contact,
          role: "admin", // Default role for self-onboarding
          locale,
        });
      } else {
        response = await ApiService.loginStaff(username, password);
      }

      if (response.success) {
        if (isRegistering) {
          setIsRegistering(false);
          setError(t("login.registrationSuccess"));
          setIsSuccessMessage(true);
          setPassword("");
        } else {
          // Login success
          localStorage.setItem("token", response.data.token);
          localStorage.setItem("user", JSON.stringify(response.data.user));
          await applyLocale(response.data.user?.locale || locale);

          if (response.data.company) {
            localStorage.setItem(
              "company",
              JSON.stringify(response.data.company),
            );
            ApiService.setCurrentCompany(response.data.company);
          }

          navigate("/dashboard");
        }
      } else {
        setError(
          response.message ||
            (isRegistering
              ? t("login.registrationFailed")
              : t("login.loginFailed")),
        );
        setIsSuccessMessage(false);
      }
    } catch (err) {
      setError(err.message || "An error occurred");
      setIsSuccessMessage(false);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError("");
    setIsSuccessMessage(false);
  };

  const handleLocaleChange = async (event) => {
    const nextLocale = event.target.value;
    setLocale(nextLocale);
    const normalizedLocale = await applyLocale(nextLocale);
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
            : t("login.portalLogin")}
        </h2>

        {error && (
          <div
            className={`error-message ${isSuccessMessage ? "success-message" : ""}`}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">{t("login.username")}</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("login.enterPassword")}
              required
            />
          </div>

          {isRegistering && (
            <>
              <div className="form-group">
                <label htmlFor="displayName">{t("login.displayName")}</label>
                <input
                  type="text"
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t("login.yourFullName")}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="companyName">{t("login.companyName")}</label>
                <input
                  type="text"
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={t("login.companyNamePlaceholder")}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="companyNature">{t("login.companyNature")}</label>
                <select
                  id="companyNature"
                  value={companyNature}
                  onChange={(e) => setCompanyNature(e.target.value)}
                  required
                  className="form-control"
                  style={{
                    width: "100%",
                    padding: "8px",
                    marginTop: "5px",
                    borderRadius: "4px",
                    border: "1px solid #ddd",
                  }}
                >
                  <option value="">
                    {isLoadingIndustries
                      ? t("login.loadingIndustries")
                      : t("login.selectIndustry")}
                  </option>
                  {companyIndustries.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="companyIcon">{t("login.companyIcon")}</label>
                <input
                  type="file"
                  id="companyIcon"
                  accept="image/*"
                  onChange={(e) => setCompanyIconFile(e.target.files[0])}
                />
              </div>
              <div className="form-group">
                <label htmlFor="address">{t("login.addressOptional")}</label>
                <input
                  type="text"
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t("login.companyAddressPlaceholder")}
                />
              </div>
              <div className="form-group">
                <label htmlFor="contact">{t("login.contactOptional")}</label>
                <input
                  type="text"
                  id="contact"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={t("login.contactPlaceholder")}
                />
              </div>
            </>
          )}

          <button type="submit" className="login-button" disabled={loading}>
            {loading
              ? isRegistering
                ? t("login.registering")
                : t("login.loggingIn")
              : isRegistering
                ? t("login.registerCompany")
                : t("login.login")}
          </button>

          <div className="toggle-container">
            <button
              type="button"
              className="toggle-button"
              onClick={toggleMode}
            >
              {isRegistering
                ? t("login.alreadyHaveAccount")
                : t("login.newCompany")}
            </button>
          </div>
        </form>
      </div>

      {loading && (
        <div className="loading-indicator-overlay">
          <div className="loading-indicator-content">
            <div className="spinner" />
            <span className="loading-indicator-text">
              {isRegistering ? t("login.registering") : t("login.loggingIn")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffLogin;
