import React from "react";
import { Navigate, useLocation } from "react-router";

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    // JWT is header.payload.signature. We need the payload (index 1).
    const base64Url = token.split('.')[1];
    // Convert Base64Url to standard Base64
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // Decode Base64
    const jsonPayload = window.atob(base64);
    const payload = JSON.parse(jsonPayload);
    
    // exp is in seconds, Date.now() is in milliseconds
    return payload.exp * 1000 < Date.now();
  } catch (e) {
    return true;
  }
};

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem("token");
  const location = useLocation();

  if (!token || isTokenExpired(token)) {
    // Clear invalid token
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("company");
    
    // Redirect to login page but save the attempted location
    return <Navigate to="/staff/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
