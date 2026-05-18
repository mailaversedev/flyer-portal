const admin = require("firebase-admin");

const db = admin.firestore();

const COMPANY_WALLET_OWNER_TYPE = "company";
const DEFAULT_CURRENCY = "TOKEN";
const COMPANY_DAILY_USAGE_COLLECTION = "billingDailyUsage";

const getCurrentIsoTimestamp = () => new Date().toISOString();

const getHongKongDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
};

const getCompanyDailyUsageRef = (companyId, dateKey = getHongKongDateKey()) =>
  db
    .collection("companies")
    .doc(companyId)
    .collection(COMPANY_DAILY_USAGE_COLLECTION)
    .doc(dateKey);

const getCompanyDailyUsage = async (companyId, options = {}) => {
  const { transaction, dateKey = getHongKongDateKey() } = options;
  const ref = getCompanyDailyUsageRef(companyId, dateKey);
  const snapshot = transaction ? await transaction.get(ref) : await ref.get();

  return {
    ref,
    dateKey,
    exists: snapshot.exists,
    data: snapshot.exists ? snapshot.data() || {} : null,
  };
};

const getCompanyWalletQuery = (companyId) =>
  db
    .collection("wallets")
    .where("ownerType", "==", COMPANY_WALLET_OWNER_TYPE)
    .where("companyId", "==", companyId)
    .where("isActive", "==", true)
    .limit(1);

const getCompanyWalletByCompanyId = async (companyId, options = {}) => {
  const { transaction } = options;
  const query = getCompanyWalletQuery(companyId);
  const snapshot = transaction ? await transaction.get(query) : await query.get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];

  return {
    doc,
    ref: doc.ref,
    data: doc.data() || {},
  };
};

const buildCompanyWalletData = ({
  companyId,
  companyName = "",
  companyDisplayName = "",
  initialBalance = 0,
  timestamp = getCurrentIsoTimestamp(),
}) => ({
  ownerType: COMPANY_WALLET_OWNER_TYPE,
  companyId,
  companyName,
  companyDisplayName,
  balance: initialBalance,
  currency: DEFAULT_CURRENCY,
  createdAt: timestamp,
  updatedAt: timestamp,
  isActive: true,
  version: 1,
});

const createCompanyWallet = ({
  transaction,
  companyId,
  companyName = "",
  companyDisplayName = "",
  initialBalance = 0,
  timestamp = getCurrentIsoTimestamp(),
}) => {
  const walletRef = db.collection("wallets").doc();
  const walletData = buildCompanyWalletData({
    companyId,
    companyName,
    companyDisplayName,
    initialBalance,
    timestamp,
  });

  transaction.set(walletRef, walletData);

  return {
    ref: walletRef,
    data: walletData,
  };
};

const ensureCompanyWalletInTransaction = async ({
  transaction,
  companyId,
  companyName = "",
  companyDisplayName = "",
  initialBalance = 0,
  timestamp = getCurrentIsoTimestamp(),
}) => {
  const existingWallet = await getCompanyWalletByCompanyId(companyId, {
    transaction,
  });

  if (existingWallet) {
    return existingWallet;
  }

  return createCompanyWallet({
    transaction,
    companyId,
    companyName,
    companyDisplayName,
    initialBalance,
    timestamp,
  });
};

const createCompanyWalletIfMissing = async ({
  companyId,
  companyName = "",
  companyDisplayName = "",
  initialBalance = 0,
}) => {
  const existingWallet = await getCompanyWalletByCompanyId(companyId);

  if (existingWallet) {
    return existingWallet;
  }

  const timestamp = getCurrentIsoTimestamp();

  await db.runTransaction(async (transaction) => {
    const walletInTransaction = await getCompanyWalletByCompanyId(companyId, {
      transaction,
    });

    if (walletInTransaction) {
      return;
    }

    createCompanyWallet({
      transaction,
      companyId,
      companyName,
      companyDisplayName,
      initialBalance,
      timestamp,
    });
  });

  return getCompanyWalletByCompanyId(companyId);
};

const createCompanyWalletTransaction = ({
  transaction,
  walletId,
  companyId,
  type,
  amount,
  previousBalance,
  newBalance,
  description,
  timestamp = getCurrentIsoTimestamp(),
  metadata = {},
}) => {
  const transactionRef = db.collection("transactions").doc();

  transaction.set(transactionRef, {
    transactionId: transactionRef.id,
    walletId,
    companyId,
    ownerType: COMPANY_WALLET_OWNER_TYPE,
    type,
    amount,
    previousBalance,
    newBalance,
    description,
    status: "COMPLETED",
    createdAt: timestamp,
    updatedAt: timestamp,
    metadata,
  });

  return transactionRef.id;
};

const serializeCompanyWallet = (wallet) => {
  if (!wallet) {
    return null;
  }

  return {
    walletId: wallet.doc?.id || wallet.ref?.id || null,
    companyId: wallet.data.companyId,
    companyName: wallet.data.companyName || "",
    companyDisplayName: wallet.data.companyDisplayName || "",
    balance: Number(wallet.data.balance) || 0,
    currency: wallet.data.currency || DEFAULT_CURRENCY,
    createdAt: wallet.data.createdAt || null,
    updatedAt: wallet.data.updatedAt || null,
    isActive: wallet.data.isActive !== false,
    ownerType: wallet.data.ownerType || COMPANY_WALLET_OWNER_TYPE,
  };
};

module.exports = {
  COMPANY_WALLET_OWNER_TYPE,
  createCompanyWallet,
  createCompanyWalletIfMissing,
  createCompanyWalletTransaction,
  ensureCompanyWalletInTransaction,
  getCompanyDailyUsage,
  getCompanyWalletByCompanyId,
  getHongKongDateKey,
  serializeCompanyWallet,
};