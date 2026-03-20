import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import zhHKCommon from "./locales/zh-HK/common.json";

export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "zh-HK"];
const PENDING_LOCALE_KEY = "pendingLocale";

const normalizeLocale = (locale) => {
  if (!locale || typeof locale !== "string") {
    return DEFAULT_LOCALE;
  }

  if (SUPPORTED_LOCALES.includes(locale)) {
    return locale;
  }

  if (locale.toLowerCase().startsWith("zh")) {
    return "zh-HK";
  }

  return DEFAULT_LOCALE;
};

export const getStoredUser = () => {
  try {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error("Failed to parse stored user", error);
    return null;
  }
};

export const getInitialLocale = () => {
  const storedLocale = localStorage.getItem("locale");
  if (storedLocale) {
    return normalizeLocale(storedLocale);
  }

  const storedUser = getStoredUser();
  if (storedUser?.locale) {
    return normalizeLocale(storedUser.locale);
  }

  return DEFAULT_LOCALE;
};

export const persistLocale = (locale) => {
  const normalizedLocale = normalizeLocale(locale);
  localStorage.setItem("locale", normalizedLocale);

  const storedUser = getStoredUser();
  if (storedUser) {
    localStorage.setItem(
      "user",
      JSON.stringify({
        ...storedUser,
        locale: normalizedLocale,
      }),
    );
  }

  return normalizedLocale;
};

export const getPendingLocale = () => {
  const pendingLocale = sessionStorage.getItem(PENDING_LOCALE_KEY);
  return pendingLocale ? normalizeLocale(pendingLocale) : null;
};

export const markPendingLocale = (locale) => {
  const normalizedLocale = normalizeLocale(locale);
  sessionStorage.setItem(PENDING_LOCALE_KEY, normalizedLocale);
  return normalizedLocale;
};

export const clearPendingLocale = (locale = null) => {
  if (!locale) {
    sessionStorage.removeItem(PENDING_LOCALE_KEY);
    return;
  }

  const pendingLocale = getPendingLocale();
  if (pendingLocale === normalizeLocale(locale)) {
    sessionStorage.removeItem(PENDING_LOCALE_KEY);
  }
};

export const applyLocale = async (locale, options = {}) => {
  const { markPending = false } = options;
  const normalizedLocale = persistLocale(locale);

  if (markPending) {
    markPendingLocale(normalizedLocale);
  }

  if (i18n.resolvedLanguage !== normalizedLocale) {
    await i18n.changeLanguage(normalizedLocale);
  }

  return normalizedLocale;
};

const resources = {
  en: {
    translation: enCommon,
  },
  "zh-HK": {
    translation: zhHKCommon,
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: SUPPORTED_LOCALES,
  interpolation: {
    escapeValue: false,
  },
});

export { normalizeLocale };
export default i18n;
