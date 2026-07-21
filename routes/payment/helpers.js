const { v4: uuidv4 } = require("uuid");
const admin = require("firebase-admin");

const db = admin.firestore();
const NUMERIC_SEGMENT_REGEX = /^\d+$/;

const roundMoneyAmount = (value) => Math.round(Number(value) * 100) / 100;
const generateTransactionId = () => uuidv4();

const buildAssignedVoucherNumber = ({
  prefix,
  startSequence,
  endSequence,
  redeemedCount,
  startCode,
}) => {
  const normalizedPrefix = `${prefix || ""}`.trim();

  if (!normalizedPrefix) {
    throw new Error("__VOUCHER_PREFIX_MISSING__");
  }

  const normalizedStartCode = `${startCode || ""}`.trim();
  const suffixWidth = normalizedStartCode.length > 0 ? normalizedStartCode.length : 1;
  const start = Number.parseInt(startSequence, 10);
  const end = Number.parseInt(endSequence, 10);
  const redeemed = Number.parseInt(redeemedCount, 10);

  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(redeemed)) {
    throw new Error("__VOUCHER_RANGE_INVALID__");
  }

  const assignedSequence = start + redeemed;

  if (assignedSequence > end) {
    throw new Error("__VOUCHER_SOLD_OUT__");
  }

  const suffix = `${assignedSequence}`.padStart(suffixWidth, "0");

  if (!NUMERIC_SEGMENT_REGEX.test(suffix)) {
    throw new Error("__VOUCHER_RANGE_INVALID__");
  }

  return `${normalizedPrefix}${suffix}`;
};

const getWalletByUserId = async (userId) => {
  const walletQuery = await db
    .collection("wallets")
    .where("userId", "==", userId)
    .where("isActive", "==", true)
    .limit(1)
    .get();

  if (walletQuery.empty) {
    throw new Error("Wallet not found for user");
  }

  return {
    doc: walletQuery.docs[0],
    data: walletQuery.docs[0].data(),
  };
};

module.exports = {
  buildAssignedVoucherNumber,
  db,
  generateTransactionId,
  getWalletByUserId,
  roundMoneyAmount,
};