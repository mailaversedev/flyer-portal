import React, { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
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
  const { voucherId } = useParams();
  const isEditing = Boolean(voucherId);
  const voucherImageInputRef = useRef(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [merchantIconFile, setMerchantIconFile] = useState(null);
  const [voucherImageFile, setVoucherImageFile] = useState(null);
  const [qrCodeFile, setQrCodeFile] = useState(null);
  const [merchantIconPreviewUrl, setMerchantIconPreviewUrl] = useState("");
  const [voucherImagePreviewUrl, setVoucherImagePreviewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingVoucher, setLoadingVoucher] = useState(isEditing);
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

  useEffect(() => {
    if (!isEditing) {
      setLoadingVoucher(false);
      return undefined;
    }

    let isMounted = true;

    const loadVoucher = async () => {
      try {
        setLoadingVoucher(true);
        setError("");

        const response = await ApiService.getAdminVoucher(voucherId);

        if (!response?.success || !response.data) {
          throw new Error(response?.message || t("voucherAdminPage.loadDetailError"));
        }

        if (!isMounted) {
          return;
        }

        const voucher = response.data;
        const colors = Array.isArray(voucher.colors) ? voucher.colors : [];

        setFormData({
          ...DEFAULT_FORM,
          ...voucher,
          value: `${voucher.value ?? ""}`,
          cost: `${voucher.cost ?? ""}`,
          totalNumber: `${voucher.totalNumber ?? ""}`,
          expiryDate: voucher.expiryDate ? `${voucher.expiryDate}`.slice(0, 10) : "",
          primaryColor: colors[0] || DEFAULT_FORM.primaryColor,
          secondaryColor: colors[1] || DEFAULT_FORM.secondaryColor,
        });
      } catch (loadError) {
        console.error("Failed to load voucher", loadError);

        if (isMounted) {
          setError(loadError.message || t("voucherAdminPage.loadDetailError"));
        }
      } finally {
        if (isMounted) {
          setLoadingVoucher(false);
        }
      }
    };

    loadVoucher();

    return () => {
      isMounted = false;
    };
  }, [isEditing, t, voucherId]);

  if (!isSuperAdmin()) {
    return <Navigate to="/platform-admin" replace />;
  }

  if (loadingVoucher) {
    return (
      <div className="platform-vouchers-page">
        <div className="platform-vouchers-state">{t("voucherAdminPage.loading")}</div>
      </div>
    );
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

  const handleVoucherImageChange = (event) => {
    setVoucherImageFile(event.target.files?.[0] || null);
    // Allow selecting the same file again after replacing an image.
    event.target.value = "";
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

      let merchantIconUrl = formData.merchantIcon || "";
      let voucherImageUrl = formData.voucherImage || "";
      let qrCodeUrl = formData.qrCode || "";

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

        const uploadedVoucherImageUrl = `${uploadResponse?.url || ""}`.trim();

        if (!uploadResponse?.success || !uploadedVoucherImageUrl) {
          throw new Error(t("voucherAdminPage.uploadVoucherImageError"));
        }

        voucherImageUrl = uploadedVoucherImageUrl;
        setFormData((current) => ({
          ...current,
          voucherImage: uploadedVoucherImageUrl,
        }));
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

      const voucherData = {
        merchant: formData.merchant.trim(),
        merchantIcon: merchantIconUrl,
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
      };

      const response = isEditing
        ? await ApiService.updateAdminVoucher(voucherId, voucherData)
        : await ApiService.createAdminVoucher(voucherData);

      if (!response?.success) {
        throw new Error(
          response?.message ||
            t(isEditing ? "voucherAdminPage.updateError" : "voucherAdminPage.createError"),
        );
      }

      navigate("/platform-vouchers", {
        state: {
          successMessage: t(
            isEditing ? "voucherAdminPage.updateSuccess" : "voucherAdminPage.createSuccess",
          ),
        },
      });
    } catch (submitError) {
      console.error(
        `Failed to ${isEditing ? "update" : "create"} voucher`,
        submitError,
      );
      setError(
        submitError.message ||
          t(isEditing ? "voucherAdminPage.updateError" : "voucherAdminPage.createError"),
      );
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
              <h2>
                {t(isEditing ? "voucherAdminPage.editTitle" : "voucherAdminPage.createTitle")}
              </h2>
              <p>
                {t(
                  isEditing
                    ? "voucherAdminPage.editSubtitle"
                    : "voucherAdminPage.createSubtitle",
                )}
              </p>
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
              <div className="platform-vouchers-file-field">
                {formData.voucherImage ? (
                  <a
                    href={formData.voucherImage}
                    target="_blank"
                    rel="noreferrer"
                    className="platform-vouchers-file-url"
                    title={formData.voucherImage}
                  >
                    {formData.voucherImage}
                  </a>
                ) : (
                  <span className="platform-vouchers-file-placeholder">
                    {t("voucherAdminPage.noVoucherImage")}
                  </span>
                )}
                {voucherImageFile ? (
                  <span className="platform-vouchers-file-selected">
                    {t("voucherAdminPage.selectedFile", { name: voucherImageFile.name })}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="platform-vouchers-file-button"
                  onClick={() => voucherImageInputRef.current?.click()}
                >
                  {t(
                    voucherImageFile
                      ? "voucherAdminPage.reselectVoucherImage"
                      : "voucherAdminPage.selectVoucherImage",
                  )}
                </button>
                <input
                  ref={voucherImageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="platform-vouchers-file-input"
                  onChange={handleVoucherImageChange}
                />
              </div>
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
              {submitting
                ? t(isEditing ? "voucherAdminPage.updating" : "voucherAdminPage.submitting")
                : t(isEditing ? "voucherAdminPage.updateSubmit" : "voucherAdminPage.submit")}
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
                merchantIcon: merchantIconPreviewUrl || formData.merchantIcon,
                voucherImage: voucherImagePreviewUrl || formData.voucherImage,
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