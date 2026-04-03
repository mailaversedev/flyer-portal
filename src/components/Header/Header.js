import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { Search, Bell, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";

import ApiService from "../../services/ApiService";
import i18n, {
  applyLocale,
  clearPendingLocale,
  normalizeLocale,
} from "../../i18n";

import "./Header.css";

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [company, setCompany] = useState(null);
  const [selectedLocale, setSelectedLocale] = useState(
    normalizeLocale(localStorage.getItem("locale") || i18n.resolvedLanguage),
  );

  useEffect(() => {
    const handleStorageChange = () => {
      const storedCompany = localStorage.getItem("company");
      if (storedCompany) {
        try {
          const parsedCompany = JSON.parse(storedCompany);
          setCompany(parsedCompany);
          ApiService.setCurrentCompany(parsedCompany);
        } catch (e) {
          console.error("Failed to parse company info", e);
        }
      }
    };

    const handleLanguageChanged = (locale) => {
      setSelectedLocale(normalizeLocale(locale));
    };

    // Initial load from storage mapping
    handleStorageChange();
    handleLanguageChanged(i18n.resolvedLanguage);

    window.addEventListener("storage", handleStorageChange);
    i18n.on("languageChanged", handleLanguageChanged);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, []);

  const getPageTitle = () => {
    switch (location.pathname) {
      case "/":
      case "/dashboard":
        return t("common.dashboard");
      case "/marketplace":
        return t("common.marketplace");
      case "/flyer":
        return t("header.flyerTypes");
      case "/flyer/create":
        return t("header.createFlyer");
      case "/profile":
        return t("common.profile");
      case "/wallet":
        return t("common.wallet");
      default:
        if (location.pathname.startsWith("/flyer/create")) {
          return t("header.createFlyer");
        }

        if (location.pathname.startsWith("/flyer/edit")) {
          return t("header.editFlyer");
        }

        return t("common.dashboard");
    }
  };

  const handleLocaleChange = async (event) => {
    const locale = event.target.value;
    const normalizedLocale = await applyLocale(locale, { markPending: true });
    setSelectedLocale(normalizedLocale);

    try {
      await ApiService.updateStaffProfile({ locale: normalizedLocale });
      clearPendingLocale(normalizedLocale);
    } catch (error) {
      console.error("Failed to persist locale", error);
      clearPendingLocale(normalizedLocale);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("company");
    localStorage.removeItem("locale");
    navigate("/staff/login");
  };

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="page-title">{getPageTitle()}</h1>
      </div>
      <div className="header-center">
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder={t("common.searchPlaceholder")}
            className="search-input"
          />
        </div>
      </div>
      <div className="header-right">
        <div className="locale-switcher">
          <label className="locale-label" htmlFor="header-locale-select">
            {t("common.language")}
          </label>
          <select
            id="header-locale-select"
            className="locale-select"
            value={selectedLocale}
            onChange={handleLocaleChange}
          >
            <option value="en">{t("common.english")}</option>
            <option value="zh-HK">{t("common.traditionalChinese")}</option>
          </select>
        </div>

        <button className="notification-btn" title={t("header.notifications")}>
          <Bell size={20} />
        </button>

        {company && (
          <div 
            className="user-info" 
            onClick={() => navigate("/profile")}
            style={{ cursor: "pointer" }}
            title={t("header.editProfile")}
          >
            <div className="user-avatar">
              {company.icon ? (
                <img
                  src={company.icon}
                  alt={company.name}
                  style={{
                    width: 28,
                    height: 28,
                    objectFit: "cover",
                  }}
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    backgroundColor: "#ccc",
                  }}
                ></div>
              )}
            </div>
            <span className="user-name">{company.name}</span>
          </div>
        )}

        <button className="logout-btn" onClick={handleLogout} title={t("common.logout")}>
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
};

export default Header;
