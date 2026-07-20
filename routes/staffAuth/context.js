const admin = require("firebase-admin");

const { authenticateToken } = require("../auth");
const { INITIAL_COMPANY_TOKENS } = require("../../config/billingConfig");
const {
  createCompanyWallet,
  createCompanyWalletTransaction,
} = require("../../services/companyWalletService");

const db = admin.firestore();

const JWT_SECRET = process.env.JWT_SECRET || "flyer-portal-secret-key-2024";

const normalizeEmail = (value = "") => value.trim().toLowerCase();
const isValidEmail = (value = "") => /\S+@\S+\.\S+/.test(value);

const JWT_OPTIONS = {
  expiresIn: "12h",
  issuer: "flyer-portal",
  audience: "flyer-portal-staff",
};

const ALLOWED_STAFF_ROLES = new Set(["staff", "admin"]);

module.exports = {
  db,
  JWT_SECRET,
  JWT_OPTIONS,
  normalizeEmail,
  isValidEmail,
  ALLOWED_STAFF_ROLES,
  authenticateToken,
  INITIAL_COMPANY_TOKENS,
  createCompanyWallet,
  createCompanyWalletTransaction,
};
