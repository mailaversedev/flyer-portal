import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import ApiService from "../../services/ApiService";

export const formatDate = (value) => {
  if (!value) return "-";
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? "-" : parsedDate.toLocaleString();
};

export const formatHkd = (value) => `HK$${(Number(value) || 0).toFixed(2)}`;

export const formatTokenCost = (value, t) => {
  const cost = Number(value);
  return Number.isFinite(cost) ? t("adminPage.tokenCount", { count: cost }) : "-";
};

export const formatLocation = (location) => {
  if (!location || typeof location !== "object") return "-";
  const segments = [location.countryCity, location.district, location.buildingEstate].filter(Boolean);
  return segments.length > 0 ? segments.join(", ") : "-";
};

export const getFlyerStatusLabel = (status) => {
  if (status === "active") return "Live";
  if (!status) return "Draft";
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export const getUserStatusMeta = (user, t) => {
  const normalizedStatus = `${user?.status || ""}`.trim().toLowerCase();
  if (normalizedStatus === "engaged") return { className: "engaged", label: t("adminPage.engaged") };
  if (normalizedStatus === "inactive") return { className: "completed", label: t("adminPage.inactive") };
  return { className: "live", label: t("adminPage.active") };
};

const EMPTY_TOTALS = {
  users: 0,
  companies: 0,
  flyers: 0,
  creditRequests: 0,
  creditRequestAmountHkd: 0,
  flyerGenerations: 0,
};

export const usePlatformAdminData = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [flyers, setFlyers] = useState([]);
  const [collectionTotals, setCollectionTotals] = useState(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAdminData = async () => {
      try {
        setLoading(true);
        setError("");
        const [usersResponse, companiesResponse, flyersResponse, totalsResponse] = await Promise.all([
          ApiService.getAdminUsers(),
          ApiService.getAdminCompanies(),
          ApiService.getAdminFlyers(),
          ApiService.getAdminCollectionTotals(),
        ]);
        setUsers(usersResponse?.success ? usersResponse.data?.entries || usersResponse.data?.users || [] : []);
        setCompanies(companiesResponse.success ? companiesResponse.data : []);
        setFlyers(flyersResponse.success ? flyersResponse.data : []);
        setCollectionTotals(totalsResponse?.success ? {
          users: Number(totalsResponse.data?.users) || 0,
          companies: Number(totalsResponse.data?.companies) || 0,
          flyers: Number(totalsResponse.data?.flyers) || 0,
          creditRequests: Number(totalsResponse.data?.creditRequests) || 0,
          creditRequestAmountHkd: Number(totalsResponse.data?.creditRequestAmountHkd) || 0,
          flyerGenerations: Number(totalsResponse.data?.flyerGenerations) || 0,
        } : EMPTY_TOTALS);
      } catch (loadError) {
        console.error("Failed to load platform admin data", loadError);
        setError(t("adminPage.loadError"));
      } finally {
        setLoading(false);
      }
    };
    loadAdminData();
  }, [t]);

  return { users, companies, flyers, collectionTotals, setFlyers, setCollectionTotals, setCompanies, loading, error };
};
