import React, { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router";
import { useTranslation } from "react-i18next";

import ApiService from "../../services/ApiService";
import { isSuperAdmin } from "../../utils/AuthUtil";
import "./PlatformVouchers.css";

const DEFAULT_FORM = {
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

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
};

const PlatformVouchers = () => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [merchantIconFile, setMerchantIconFile] = useState(null);
  const [qrCodeFile, setQrCodeFile] = useState(null);
  const [merchantIconPreviewUrl, setMerchantIconPreviewUrl] = useState("");
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadVouchers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ApiService.getAdminVouchers();
      setVouchers(Array.isArray(response?.data) ? response.data : []);
    } catch (loadError) {
      console.error("Failed to load vouchers", loadError);
      setError(loadError.message || t("voucherAdminPage.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadVouchers();
  }, [loadVouchers]);

  useEffect(() => {
    if (!merchantIconFile) {
      setMerchantIconPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(merchantIconFile);
    setMerchantIconPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [merchantIconFile]);

  if (!isSuperAdmin()) {
    return <Navigate to="/platform-admin" replace />;
  }

  const previewMerchant =
    formData.merchant.trim() || t("voucherAdminPage.previewMerchant");
  const previewValue = formData.value.trim() || "100";
  const previewCost = formData.cost.trim() || "50000";
  const previewExpiryDate = formatDate(formData.expiryDate) || "-";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      let merchantIconUrl = "";
      let qrCodeUrl = "";

      if (merchantIconFile) {
        const uploadResponse = await ApiService.uploadFile(
          merchantIconFile,
          "voucherMerchantIcon",
        );

        if (!uploadResponse?.success || !uploadResponse?.url) {
          throw new Error(t("voucherAdminPage.uploadMerchantIconError"));
        }

        merchantIconUrl = uploadResponse.url;
      }

      if (qrCodeFile) {
        const uploadResponse = await ApiService.uploadFile(
          qrCodeFile,
          "voucherQrCode",
        );

        if (!uploadResponse?.success || !uploadResponse?.url) {
          throw new Error(t("voucherAdminPage.uploadError"));
        }

        qrCodeUrl = uploadResponse.url;
      }

      const response = await ApiService.createAdminVoucher({
        merchant: formData.merchant.trim(),
        merchantIcon: merchantIconUrl,
        value: formData.value.trim(),
        cost: formData.cost,
        expiryDate: formData.expiryDate,
        totalNumber: formData.totalNumber,
        promotionCode: formData.promotionCode.trim(),
        qrCode: qrCodeUrl,
        terms: formData.terms.trim(),
        colors: [formData.primaryColor, formData.secondaryColor],
      });

      if (!response?.success) {
        throw new Error(response?.message || t("voucherAdminPage.createError"));
      }

      setSuccess(t("voucherAdminPage.createSuccess"));
      setFormData(DEFAULT_FORM);
      setMerchantIconFile(null);
      setQrCodeFile(null);
      await loadVouchers();
    } catch (submitError) {
      console.error("Failed to create voucher", submitError);
      setError(submitError.message || t("voucherAdminPage.createError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="platform-vouchers-page">
      <div className="platform-vouchers-grid">
        <section className="platform-vouchers-form-card">
          <div className="platform-vouchers-header">
            <h2>{t("voucherAdminPage.createTitle")}</h2>
            <p>{t("voucherAdminPage.createSubtitle")}</p>
          </div>

          {error ? <div className="platform-vouchers-message error">{error}</div> : null}
          {success ? <div className="platform-vouchers-message success">{success}</div> : null}

          <form className="platform-vouchers-form" onSubmit={handleSubmit}>
            <label className="full-width">
              <span>{t("voucherAdminPage.merchant")}</span>
              <input name="merchant" value={formData.merchant} onChange={handleChange} required />
            </label>
            <label className="full-width">
              <span>{t("voucherAdminPage.merchantIcon")}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(event) =>
                  setMerchantIconFile(event.target.files?.[0] || null)
                }
                required
              />
            </label>
            <label>
              <span>{t("voucherAdminPage.value")}</span>
              <input name="value" value={formData.value} onChange={handleChange} required />
            </label>
            <label>
              <span>{t("voucherAdminPage.cost")}</span>
              <input name="cost" type="number" min="1" value={formData.cost} onChange={handleChange} required />
            </label>
            <label>
              <span>{t("voucherAdminPage.expiryDate")}</span>
              <input name="expiryDate" type="date" value={formData.expiryDate} onChange={handleChange} required />
            </label>
            <label>
              <span>{t("voucherAdminPage.totalNumber")}</span>
              <input name="totalNumber" type="number" min="1" value={formData.totalNumber} onChange={handleChange} required />
            </label>
            <label className="full-width">
              <span>{t("voucherAdminPage.promotionCode")}</span>
              <input name="promotionCode" value={formData.promotionCode} onChange={handleChange} />
            </label>
            <label>
              <span>{t("voucherAdminPage.primaryColor")}</span>
              <input name="primaryColor" type="color" value={formData.primaryColor} onChange={handleChange} />
            </label>
            <label>
              <span>{t("voucherAdminPage.secondaryColor")}</span>
              <input name="secondaryColor" type="color" value={formData.secondaryColor} onChange={handleChange} />
            </label>
            <label className="full-width">
              <span>{t("voucherAdminPage.qrCode")}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setQrCodeFile(event.target.files?.[0] || null)}
              />
            </label>
            <label className="full-width">
              <span>{t("voucherAdminPage.terms")}</span>
              <textarea name="terms" rows="5" value={formData.terms} onChange={handleChange} required />
            </label>
            <button type="submit" className="platform-vouchers-submit" disabled={submitting}>
              {submitting ? t("voucherAdminPage.submitting") : t("voucherAdminPage.submit")}
            </button>
          </form>
        </section>

        <div className="platform-vouchers-side-column">
          <section className="platform-vouchers-preview-card">
            <div className="platform-vouchers-header">
              <h2>{t("voucherAdminPage.previewTitle")}</h2>
              <p>{t("voucherAdminPage.previewSubtitle")}</p>
            </div>

            <div
              className="platform-vouchers-preview-surface"
              style={{
                background: `linear-gradient(135deg, ${formData.primaryColor}, ${formData.secondaryColor})`,
              }}
            >
              <div className="platform-vouchers-preview-top">
                <div className="platform-vouchers-preview-icon-shell">
                  {merchantIconPreviewUrl ? (
                    <img
                      src={merchantIconPreviewUrl}
                      alt={previewMerchant}
                      className="platform-vouchers-preview-icon"
                    />
                  ) : (
                    <span className="platform-vouchers-preview-icon-fallback">
                      {previewMerchant.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="platform-vouchers-preview-merchant">
                  {previewMerchant}
                </span>
              </div>

              <div className="platform-vouchers-preview-title">
                {t("voucherAdminPage.cashVoucher")}
              </div>

              <div className="platform-vouchers-preview-bottom">
                <div className="platform-vouchers-preview-price-row">
                  <span className="platform-vouchers-preview-currency">$</span>
                  <span className="platform-vouchers-preview-value">{previewValue}</span>
                </div>
                <div className="platform-vouchers-preview-validity">
                  {t("voucherAdminPage.validUntil", { date: previewExpiryDate })}
                </div>
                <button type="button" className="platform-vouchers-preview-cta">
                  {t("voucherAdminPage.previewCta", { count: previewCost })}
                </button>
              </div>
            </div>

            <div className="platform-vouchers-preview-meta">
              <div>
                <span>{t("voucherAdminPage.totalNumber")}</span>
                <strong>{formData.totalNumber.trim() || "-"}</strong>
              </div>
              <div>
                <span>{t("voucherAdminPage.promotionCode")}</span>
                <strong>{formData.promotionCode.trim() || "-"}</strong>
              </div>
              <div>
                <span>{t("voucherAdminPage.qrCode")}</span>
                <strong>{qrCodeFile ? t("voucherAdminPage.qrAvailable") : "-"}</strong>
              </div>
            </div>
          </section>

          <section className="platform-vouchers-list-card">
            <div className="platform-vouchers-header">
              <h2>{t("voucherAdminPage.listTitle")}</h2>
              <p>{t("voucherAdminPage.listSubtitle")}</p>
            </div>

            {loading ? (
              <div className="platform-vouchers-state">{t("voucherAdminPage.loading")}</div>
            ) : vouchers.length === 0 ? (
              <div className="platform-vouchers-state">{t("voucherAdminPage.empty")}</div>
            ) : (
              <div className="platform-vouchers-table-wrapper">
                <table className="platform-vouchers-table">
                  <thead>
                    <tr>
                      <th>{t("voucherAdminPage.merchantIcon")}</th>
                      <th>{t("voucherAdminPage.merchant")}</th>
                      <th>{t("voucherAdminPage.value")}</th>
                      <th>{t("voucherAdminPage.cost")}</th>
                      <th>{t("voucherAdminPage.expiryDate")}</th>
                      <th>{t("voucherAdminPage.totalNumber")}</th>
                      <th>{t("voucherAdminPage.promotionCode")}</th>
                      <th>{t("voucherAdminPage.qrCode")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vouchers.map((voucher) => (
                      <tr key={voucher.id}>
                        <td>
                          {voucher.merchantIcon ? (
                            <img
                              src={voucher.merchantIcon}
                              alt={voucher.merchant}
                              className="platform-vouchers-table-icon"
                            />
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>{voucher.merchant}</td>
                        <td>{voucher.value}</td>
                        <td>{voucher.cost}</td>
                        <td>{formatDate(voucher.expiryDate)}</td>
                        <td>{voucher.totalNumber}</td>
                        <td>{voucher.promotionCode || "-"}</td>
                        <td>{voucher.qrCode ? t("voucherAdminPage.qrAvailable") : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default PlatformVouchers;