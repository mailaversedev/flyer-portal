import React from "react";

export const DEFAULT_FORM = {
  merchant: "",
  value: "",
  cost: "",
  expiryDate: "",
  totalNumber: "",
  promotionCode: "",
  terms: "",
  primaryColor: "#ef3239",
  secondaryColor: "#f76b1c",
};

export const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
};

export function PlatformVoucherCard({
  cardKey,
  t,
  value,
  variant = "list",
}) {
  const colors = Array.isArray(value.colors) && value.colors.length >= 2
    ? value.colors
    : [DEFAULT_FORM.primaryColor, DEFAULT_FORM.secondaryColor];
  const merchant = value.merchant?.trim() || t("voucherAdminPage.previewMerchant");
  const validity = value.validity || formatDate(value.expiryDate) || "-";
  const surfaceClassName =
    variant === "editor"
      ? "platform-vouchers-preview-surface platform-vouchers-preview-surface--editor"
      : "platform-vouchers-preview-surface platform-vouchers-preview-surface--list";

  return (
    <article key={cardKey} className="platform-vouchers-cash-card">
      <div
        className={surfaceClassName}
        style={{
          background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
        }}
      >
        <div className="platform-vouchers-preview-top">
          <div className="platform-vouchers-preview-icon-shell">
            {value.merchantIcon ? (
              <img
                src={value.merchantIcon}
                alt={merchant}
                className="platform-vouchers-preview-icon"
              />
            ) : (
              <span className="platform-vouchers-preview-icon-fallback">
                {merchant.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <span className="platform-vouchers-preview-merchant">{merchant}</span>
        </div>

        <div className="platform-vouchers-preview-title">
          {t("voucherAdminPage.cashVoucher")}
        </div>

        <div className="platform-vouchers-preview-bottom">
          <div className="platform-vouchers-preview-price-row">
            <span className="platform-vouchers-preview-currency">$</span>
            <span className="platform-vouchers-preview-value">{value.value}</span>
          </div>
          <div className="platform-vouchers-preview-validity">
            {t("voucherAdminPage.validUntil", { date: validity })}
          </div>
          <button type="button" className="platform-vouchers-preview-cta">
            {t("voucherAdminPage.previewCta", { count: value.cost })}
          </button>
        </div>
      </div>
    </article>
  );
}