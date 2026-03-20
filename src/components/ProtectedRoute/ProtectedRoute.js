import React, { useEffect } from "react";
import { Navigate, useLocation } from "react-router";
import ApiService from "../../services/ApiService";
import { applyLocale, getPendingLocale } from "../../i18n";
import { isTokenExpired } from "../../utils/AuthUtil";

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const location = useLocation();

  useEffect(() => {
    const refreshToken = async () => {
      if (token && !isTokenExpired(token)) {
        try {
          const result = await ApiService.refreshStaffToken(token);
          if (result.success && result.data.token) {
            localStorage.setItem("token", result.data.token);

            if (result.data.user) {
              const pendingLocale = getPendingLocale();
              const nextUser = pendingLocale
                ? { ...result.data.user, locale: pendingLocale }
                : result.data.user;

              localStorage.setItem("user", JSON.stringify(nextUser));

              if (nextUser.locale) {
                await applyLocale(nextUser.locale);
              }
            }
          }
        } catch (error) {
          console.error("Token refresh failed:", error);
          // If refresh fails (likely 401/404 from API), clear session
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("company");
          window.location.href = "/staff/login";
        }
      }
    };

    refreshToken();
  }, [token]);

  if (!token || isTokenExpired(token)) {
    // Clear invalid token
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("company");

    if (location.pathname === "/staff/login") {
      return children;
    }

    // Redirect to login page but save the attempted location
    return <Navigate to="/staff/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
