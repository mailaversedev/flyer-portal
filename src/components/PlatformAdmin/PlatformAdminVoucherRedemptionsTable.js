import React from "react";

import { formatDate, formatTokenCost } from "./index";

const formatExpiryDate = (value) => {
  if (!value) return "-";

  const dateValue = String(value);
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
    ? new Date(`${dateValue}T00:00:00`)
    : new Date(dateValue);

  return Number.isNaN(parsedDate.getTime()) ? "-" : parsedDate.toLocaleDateString();
};

const getVoucherExpiryStatus = (voucher, t) => {
  if (voucher?.isActive === false) {
    return t("adminPage.inactive");
  }

  if (!voucher?.expiryDate) {
    return t("adminPage.voucherNoExpiry");
  }

  const expiryDate = new Date(voucher.expiryDate);

  if (Number.isNaN(expiryDate.getTime())) {
    return "-";
  }

  return expiryDate.getTime() < Date.now()
    ? t("adminPage.voucherExpired")
    : t("adminPage.active");
};

export const PlatformAdminVoucherRedemptionsTable = ({
  redemptions = [],
  t,
  emptyMessage = null,
}) => {
  const getAssignedVoucherNumber = (redemption) =>
    redemption.assignedVoucherNumber ??
    redemption.result?.assignedVoucherNumber ??
    redemption.result?.voucher?.claimedVoucherNumber;
  const hasAssignedVoucherNumber = redemptions.some((redemption) => {
    const assignedVoucherNumber = getAssignedVoucherNumber(redemption);
    return (
      assignedVoucherNumber != null &&
      String(assignedVoucherNumber).trim() !== ""
    );
  });

  return (
    <table className="campaigns-table platform-admin-engagement-table">
      <thead>
        <tr>
          <th>{t("adminPage.username")}</th>
          <th>{t("adminPage.email")}</th>
          {hasAssignedVoucherNumber && (
            <th>{t("adminPage.assignedVoucherNumber")}</th>
          )}
          <th>{t("adminPage.voucherMerchant")}</th>
          <th>{t("adminPage.voucherValue")}</th>
          <th>{t("adminPage.voucherCost")}</th>
          <th>{t("adminPage.redemptionStatus")}</th>
          <th>{t("adminPage.voucherExpiryDate")}</th>
          <th>{t("adminPage.voucherExpiryStatus")}</th>
          <th>{t("adminPage.createdAt")}</th>
        </tr>
      </thead>
      <tbody>
        {redemptions.map((redemption) => (
          <tr key={redemption.id} className="campaign-row-disabled">
            <td>{redemption.user?.username || t("adminPage.deletedUser")}</td>
            <td>{redemption.user?.email || "-"}</td>
            {hasAssignedVoucherNumber && (
              <td>{getAssignedVoucherNumber(redemption) || "-"}</td>
            )}
            <td>{redemption.voucher?.merchant || "-"}</td>
            <td>{redemption.voucher?.value || "-"}</td>
            <td>{formatTokenCost(redemption.voucher?.cost, t)}</td>
            <td>{redemption.redemptionStatus || redemption.status || "-"}</td>
            <td>{formatExpiryDate(redemption.voucher?.expiryDate)}</td>
            <td>{getVoucherExpiryStatus(redemption.voucher, t)}</td>
            <td>{formatDate(redemption.createdAt)}</td>
          </tr>
        ))}
        {redemptions.length === 0 && (
          <tr>
            <td
              colSpan={hasAssignedVoucherNumber ? "10" : "9"}
              className="platform-admin-empty-cell"
            >
              {emptyMessage || t("adminPage.noVoucherRedemptions")}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};
