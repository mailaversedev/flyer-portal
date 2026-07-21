import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import ApiService from "../../services/ApiService";
import { isSuperAdmin } from "../../utils/AuthUtil";
import {
  DEFAULT_FORM,
  PlatformVoucherCard,
  formatDate,
} from "./PlatformVouchers.shared";
import "./PlatformVouchers.css";

const PlatformVouchersCreatePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [merchantIconFile, setMerchantIconFile] = useState(null);
  const [voucherImageFile, setVoucherImageFile] = useState(null);
  const [qrCodeFile, setQrCodeFile] = useState(null);
  const [merchantIconPreviewUrl, setMerchantIconPreviewUrl] = useState("");
  const [voucherImagePreviewUrl, setVoucherImagePreviewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  useEffect(() => {
    if (!voucherImageFile) {
      setVoucherImagePreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(voucherImageFile);
    setVoucherImagePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [voucherImageFile]);

  if (!isSuperAdmin()) {
    return <Navigate to="/platform-admin" replace />;
  }

  const previewMerchant = formData.merchant.trim() || t("voucherAdminPage.previewMerchant");
  const previewValue = formData.value.trim() || "100";
  const previewCost = formData.cost.trim() || "50000";
  const previewExpiryDate = formatDate(formData.expiryDate) || "-";
  const requiresVoucherRange = formData.voucherType === "numbered";

  const parseVoucherSequence = (voucherNumber, prefix) => {
    const normalizedPrefix = `${prefix || ""}`.trim();
    const normalizedVoucherNumber = `${voucherNumber || ""}`.trim();

    if (!normalizedPrefix) {
      return { error: t("voucherAdminPage.voucherPrefixRequired") };
    }

    if (!/^\d+$/.test(normalizedVoucherNumber)) {
      return { error: t("voucherAdminPage.voucherNumericSuffixRequired") };
    }

    return {
      sequence: Number.parseInt(normalizedVoucherNumber, 10),
    };
  };

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
      const totalNumber = Number.parseInt(formData.totalNumber, 10);

      if (!Number.isFinite(totalNumber) || totalNumber <= 0) {
        throw new Error(t("voucherAdminPage.totalNumberInvalid"));
      }

      const prefix = formData.voucherPrefix.trim();
      const startVoucherNumber = formData.voucherNumberStart.trim();
      const endVoucherNumber = formData.voucherNumberEnd.trim();

      if (requiresVoucherRange) {
        const startResult = parseVoucherSequence(startVoucherNumber, prefix);

        if (startResult.error) {
          throw new Error(startResult.error);
        }

        const endResult = parseVoucherSequence(endVoucherNumber, prefix);

        if (endResult.error) {
          throw new Error(endResult.error);
        }

        if (startResult.sequence > endResult.sequence) {
          throw new Error(t("voucherAdminPage.voucherRangeInvalid"));
        }

        const rangeCount = endResult.sequence - startResult.sequence + 1;

        if (rangeCount !== totalNumber) {
          throw new Error(t("voucherAdminPage.voucherRangeCountMismatch"));
        }
      }

      let merchantIconUrl = "";
      let voucherImageUrl = "";
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

      if (voucherImageFile) {
        const uploadResponse = await ApiService.uploadFile(
          voucherImageFile,
          "voucherImage",
        );

        if (!uploadResponse?.success || !uploadResponse?.url) {
          throw new Error(t("voucherAdminPage.uploadVoucherImageError"));
        }

        voucherImageUrl = uploadResponse.url;
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
        merchantIcon: merchantIconUrl ?? "",
        voucherImage: voucherImageUrl,
        value: formData.value.trim(),
        cost: formData.cost,
        expiryDate: formData.expiryDate,
        totalNumber,
        voucherType: formData.voucherType,
        voucherPrefix: requiresVoucherRange ? prefix : "",
        voucherNumberStart: requiresVoucherRange ? startVoucherNumber : "",
        voucherNumberEnd: requiresVoucherRange ? endVoucherNumber : "",
        promotionCode: requiresVoucherRange ? "" : formData.promotionCode.trim(),
        qrCode: qrCodeUrl,
        terms: formData.terms.trim(),
        colors: [formData.primaryColor, formData.secondaryColor],
      });

      if (!response?.success) {
        throw new Error(response?.message || t("voucherAdminPage.createError"));
      }

      navigate("/platform-vouchers", {
        state: { successMessage: t("voucherAdminPage.createSuccess") },
      });
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
          <div className="platform-vouchers-header-row">
            <div className="platform-vouchers-header">
              <h2>{t("voucherAdminPage.createTitle")}</h2>
              <p>{t("voucherAdminPage.createSubtitle")}</p>
            </div>
            <button
              type="button"
              className="platform-vouchers-secondary-button"
              onClick={() => {
                setError("");
                navigate("/platform-vouchers");
              }}
            >
              {t("voucherAdminPage.backToList")}
            </button>
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
              />
            </label>
            <label className="full-width">
              <span>{t("voucherAdminPage.voucherImage")}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(event) =>
                  setVoucherImageFile(event.target.files?.[0] || null)
                }
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
            <label>
              <span>{t("voucherAdminPage.voucherType")}</span>
              <select
                name="voucherType"
                value={formData.voucherType}
                onChange={handleChange}
              >
                <option value="static">{t("voucherAdminPage.voucherTypeStatic")}</option>
                <option value="numbered">{t("voucherAdminPage.voucherTypeNumbered")}</option>
              </select>
            </label>
            {requiresVoucherRange ? (
              <>
                <label>
                  <span>{t("voucherAdminPage.voucherPrefix")}</span>
                  <input name="voucherPrefix" value={formData.voucherPrefix} onChange={handleChange} required />
                </label>
                <label>
                  <span>{t("voucherAdminPage.voucherNumberStart")}</span>
                  <input name="voucherNumberStart" value={formData.voucherNumberStart} onChange={handleChange} required />
                </label>
                <label>
                  <span>{t("voucherAdminPage.voucherNumberEnd")}</span>
                  <input name="voucherNumberEnd" value={formData.voucherNumberEnd} onChange={handleChange} required />
                </label>
              </>
            ) : null}
            {!requiresVoucherRange ? (
              <label className="full-width">
                <span>{t("voucherAdminPage.promotionCode")}</span>
                <input name="promotionCode" value={formData.promotionCode} onChange={handleChange} />
              </label>
            ) : null}
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

            <PlatformVoucherCard
              t={t}
              value={{
                merchant: previewMerchant,
                merchantIcon: merchantIconPreviewUrl,
                voucherImage: voucherImagePreviewUrl,
                value: previewValue,
                cost: previewCost,
                validity: previewExpiryDate,
                colors: [formData.primaryColor, formData.secondaryColor],
              }}
              variant="editor"
            />
          </section>
        </div>
      </div>
    </div>
  );
};

export default PlatformVouchersCreatePage;