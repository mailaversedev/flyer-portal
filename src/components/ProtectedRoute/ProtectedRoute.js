import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router";
import ApiService from "../../services/ApiService";
import { applyLocale, getPendingLocale } from "../../i18n";
import { getTokenExpiryMs, isTokenExpired } from "../../utils/AuthUtil";
import "../../pages/Wallet/CreditRequestModal.css";
import "./ProtectedRoute.css";

const SESSION_WARNING_WINDOW_MS = 5 * 60 * 1000;

const getRemainingSessionMs = (token) => {
  const expiryMs = getTokenExpiryMs(token);

  if (!expiryMs) {
    return 0;
  }

  return Math.max(0, expiryMs - Date.now());
};

const formatCountdown = (remainingMs) => {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const location = useLocation();
  const [remainingSessionMs, setRemainingSessionMs] = useState(() =>
    getRemainingSessionMs(token),
  );
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const currentToken = localStorage.getItem("token");
      setRemainingSessionMs(getRemainingSessionMs(currentToken));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!token || isTokenExpired(token)) {
      setRefreshError("");
      return;
    }

    const pendingLocale = getPendingLocale();
    const storedUser = localStorage.getItem("user");

    if (!pendingLocale || !storedUser) {
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser?.locale === pendingLocale) {
        applyLocale(pendingLocale);
      }
    } catch (error) {
      console.error("Failed to reconcile locale state:", error);
    }
  }, [token]);

  const shouldShowSessionOverlay =
    Boolean(token) &&
    !isTokenExpired(token) &&
    remainingSessionMs > 0 &&
    remainingSessionMs <= SESSION_WARNING_WINDOW_MS;

  const formattedCountdown = useMemo(
    () => formatCountdown(remainingSessionMs),
    [remainingSessionMs],
  );

  const handleManualRefresh = async () => {
    const currentToken = localStorage.getItem("token");

    if (!currentToken || isTokenExpired(currentToken)) {
      await ApiService.logoutSession();
      return;
    }

    try {
      setIsRefreshingToken(true);
      setRefreshError("");

      const result = await ApiService.refreshStaffToken(currentToken);

      if (!result?.success || !result?.data?.token) {
        throw new Error("Failed to refresh session");
      }

      localStorage.setItem("token", result.data.token);

      if (result.data.user) {
        localStorage.setItem("user", JSON.stringify(result.data.user));

        if (result.data.user.locale) {
          await applyLocale(result.data.user.locale);
        }
      }

      setRemainingSessionMs(getRemainingSessionMs(result.data.token));
    } catch (error) {
      console.error("Manual token refresh failed:", error);
      setRefreshError("Session refresh failed. Redirecting to login...");
      await ApiService.logoutSession();
    } finally {
      setIsRefreshingToken(false);
    }
  };

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

  return (
    <>
      {children}
      {shouldShowSessionOverlay ? (
        <div className="credit-request-modal-overlay">
          <div className="credit-request-modal session-refresh-modal">
            <h3>Session Expiring Soon</h3>
            <p className="session-refresh-message">
              Your session will expire in
              {" "}
              <strong>{formattedCountdown}</strong>
              .
            </p>
            <p className="session-refresh-message">
              Click refresh to stay signed in.
            </p>
            {refreshError ? (
              <p className="session-refresh-error">{refreshError}</p>
            ) : null}
            <button
              type="button"
              className="submit-btn session-refresh-button"
              onClick={handleManualRefresh}
              disabled={isRefreshingToken}
            >
              {isRefreshingToken ? "Refreshing..." : "Refresh Session"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default ProtectedRoute;
