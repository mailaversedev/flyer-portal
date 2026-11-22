import React, { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";

import ApiService from "../../services/ApiService";
import { isSuperAdmin } from "../../utils/AuthUtil";
import { hkdToTokens, TOKEN_PRICE_HKD } from "../../config/billingConfig";
import { DEFAULT_FORM, formatDate } from "../../components/PlatformVouchers";
import { PlatformVoucherCard } from "../../components/PlatformVouchers/PlatformVoucherCard";
import VoucherImportFields from "../../components/PlatformVouchers/VoucherImportFields";
import VoucherFilePicker from "../../components/PlatformVouchers/VoucherFilePicker";
import { validateVoucherImport } from "../../utils/VoucherImportUtil";
import "./PlatformVouchers.css";

const PlatformVouchersCreatePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { voucherId } = useParams();
  const isEditing = Boolean(voucherId);
  const retryState = location.state?.voucherImport;
  const [formData, setFormData] = useState(retryState?.formData || DEFAULT_FORM);
  const [loadedVoucherType, setLoadedVoucherType] = useState(retryState?.formData?.voucherType || null);
  const [importBatch, setImportBatch] = useState(retryState?.batch || { pairs: [], images: [], sourceError: "" });
  const [pendingImport, setPendingImport] = useState(retryState?.pending || null);
  const [importFieldsKey, setImportFieldsKey] = useState(0);
  const savedVoucherIdRef = useRef(retryState?.pending?.voucherId || voucherId || "");
  const creationCompletedRef = useRef(false);
  const submitLockRef = useRef(false);
  const [merchantIconFile, setMerchantIconFile] = useState(null);
  const [voucherImageFile, setVoucherImageFile] = useState(null);
  const [qrCodeFile, setQrCodeFile] = useState(null);
  const [merchantIconPreviewUrl, setMerchantIconPreviewUrl] = useState("");
  const [voucherImagePreviewUrl, setVoucherImagePreviewUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingVoucher, setLoadingVoucher] = useState(isEditing);
  const [error, setError] = useState(retryState?.error || "");
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
    if (location.state?.voucherImport?.pending?.voucherId === voucherId) {
      setLoadingVoucher(false);
      return undefined;
    }
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
        setLoadedVoucherType(voucher.voucherType || "static");
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
  }, [isEditing, t, voucherId, location.state]);

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
  const previewExpiryDate = formatDate(formData.expiryDate) || "-";
  const requiresVoucherRange = formData.voucherType === "numbered";
  const isImported = formData.voucherType === "imported";
  const startSequence = Number.parseInt(formData.voucherNumberStart, 10);
  const endSequence = Number.parseInt(formData.voucherNumberEnd, 10);
  const calculatedQuantity =
    requiresVoucherRange &&
    Number.isFinite(startSequence) &&
    Number.isFinite(endSequence) &&
    endSequence >= startSequence
      ? endSequence - startSequence + 1
      : "";
  const voucherValue = Number.parseFloat(formData.value);
  const calculatedCost =
    Number.isFinite(voucherValue) && voucherValue > 0
      ? Math.ceil(hkdToTokens(voucherValue))
      : "";
  const previewCost = `${calculatedCost || formData.cost || "50000"}`;

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
    if (name === "voucherType" && isEditing &&
        (loadedVoucherType === "imported" || value === "imported") &&
        value !== loadedVoucherType) return;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setError("");
    setSuccess("");
    setSubmitting(true);

    let activeImport = pendingImport;
    let savedFormData = formData;
    try {
      if (isImported) {
        const importErrors = [importBatch.sourceError, ...validateVoucherImport(importBatch.pairs, importBatch.images)].filter(Boolean);
        if (importErrors.length) throw new Error(t(`voucherAdminPage.${importErrors[0]}`));
        if (!savedVoucherIdRef.current && !importBatch.pairs.length && !importBatch.images.length) {
          throw new Error(t("voucherAdminPage.importEmpty"));
        }
      }

      if (!activeImport) {
        const totalNumber = isImported ? 0 : requiresVoucherRange
          ? calculatedQuantity
          : Number.parseInt(formData.totalNumber, 10);

        if (!isImported && (!Number.isFinite(totalNumber) || totalNumber <= 0)) {
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

        if (!isImported && qrCodeFile) {
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
          cost: calculatedCost || formData.cost,
          expiryDate: formData.expiryDate,
          totalNumber,
          voucherType: formData.voucherType,
          voucherPrefix: requiresVoucherRange ? prefix : "",
          voucherNumberStart: requiresVoucherRange ? startVoucherNumber : "",
          voucherNumberEnd: requiresVoucherRange ? endVoucherNumber : "",
          promotionCode: requiresVoucherRange || isImported ? "" : formData.promotionCode.trim(),
          qrCode: isImported ? "" : qrCodeUrl,
          terms: formData.terms.trim(),
          colors: [formData.primaryColor, formData.secondaryColor],
        };

        if (isImported && savedVoucherIdRef.current) delete voucherData.totalNumber;
        if (creationCompletedRef.current && !savedVoucherIdRef.current) {
          throw new Error(t("voucherAdminPage.importMissingId"));
        }
        const response = savedVoucherIdRef.current
          ? await ApiService.updateAdminVoucher(savedVoucherIdRef.current, voucherData)
          : await ApiService.createAdminVoucher(voucherData);

        if (!response?.success) {
          throw new Error(
            response?.message ||
              t(isEditing ? "voucherAdminPage.updateError" : "voucherAdminPage.createError"),
          );
        }

        if (isImported) {
          creationCompletedRef.current = true;
          const savedId = savedVoucherIdRef.current || response.data?.id || response.data?.voucherId || response.voucherId || response.id;
          if (!savedId) throw new Error(t("voucherAdminPage.importMissingId"));
          savedVoucherIdRef.current = savedId;
          if (importBatch.pairs.length || importBatch.images.length) {
            activeImport = { ...importBatch, voucherId: savedId, importKey: crypto.randomUUID() };
            setPendingImport(activeImport);
            savedFormData = {
              ...formData,
              merchantIcon: voucherData.merchantIcon,
              voucherImage: voucherData.voucherImage,
              totalNumber: isEditing ? formData.totalNumber : "0",
            };
            setFormData(savedFormData);
            navigate(`/platform-vouchers/${savedId}/edit`, {
              replace: true,
              state: { voucherImport: { pending: activeImport, batch: importBatch, formData: savedFormData } },
            });
          }
        }
      }

      if (activeImport) {
        const importResponse = await ApiService.importAdminVoucher(activeImport.voucherId, activeImport);
        if (!importResponse?.success) {
          throw new Error(importResponse?.message || t("voucherAdminPage.importError"));
        }
        setPendingImport(null);
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
      if (activeImport) {
        // Persist the saved ID and exact retry payload in this history entry.
        navigate(`/platform-vouchers/${activeImport.voucherId}/edit`, {
          replace: true,
          state: { voucherImport: {
            pending: activeImport,
            batch: importBatch,
            formData: savedFormData,
            error: submitError.message || t("voucherAdminPage.importError"),
          } },
        });
      }
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
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

          {error ? <div role="alert" className="platform-vouchers-message error">{error}</div> : null}
          {success ? <div className="platform-vouchers-message success">{success}</div> : null}
          {pendingImport ? <div role="status" className="platform-vouchers-message error">
            {t(submitting ? "voucherAdminPage.importProcessing" : "voucherAdminPage.importRetryGuidance", { id: pendingImport.voucherId })}
            <button type="button" disabled={submitting} onClick={() => {
              if (!window.confirm(t("voucherAdminPage.importDiscardConfirm"))) return;
              setPendingImport(null);
              setImportBatch({ pairs: [], images: [], sourceError: "" });
              setImportFieldsKey((key) => key + 1);
              setError("");
              navigate(`/platform-vouchers/${pendingImport.voucherId}/edit`, { replace: true, state: null });
            }}>{t("voucherAdminPage.importDiscard")}</button>
          </div> : null}

          <form aria-label={t(isEditing ? "voucherAdminPage.editTitle" : "voucherAdminPage.createTitle")} className="platform-vouchers-form" onSubmit={handleSubmit}>
            <fieldset className="platform-vouchers-details full-width" disabled={submitting || Boolean(pendingImport)}>
            <label className="full-width">
              <span>{t("voucherAdminPage.merchant")}</span>
              <input name="merchant" value={formData.merchant} onChange={handleChange} required />
            </label>
            <div className="full-width">
              <VoucherFilePicker t={t} label={t("voucherAdminPage.merchantIcon")}
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                files={merchantIconFile ? [merchantIconFile] : []}
                existingUrl={formData.merchantIcon}
                onSelect={([file]) => setMerchantIconFile(file)} />
            </div>
            <div className="full-width">
              <VoucherFilePicker t={t} label={t("voucherAdminPage.voucherImage")}
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                files={voucherImageFile ? [voucherImageFile] : []}
                existingUrl={formData.voucherImage}
                onSelect={([file]) => setVoucherImageFile(file)} />
            </div>
            <label>
              <span>{t("voucherAdminPage.value")}</span>
              <input name="value" value={formData.value} onChange={handleChange} required />
            </label>
            <label>
              <span>{t("voucherAdminPage.cost", { price: TOKEN_PRICE_HKD })}</span>
              <input
                name="cost"
                type="number"
                min="1"
                value={calculatedCost}
                readOnly
                required
              />
            </label>
            <label>
              <span>{t("voucherAdminPage.expiryDate")}</span>
              <input name="expiryDate" type="date" value={formData.expiryDate} onChange={handleChange} required />
            </label>
            <label>
              <span>{t("voucherAdminPage.totalNumber")}</span>
              <input
                name="totalNumber"
                type="number"
                min={isImported ? "0" : "1"}
                value={isImported ? (isEditing ? formData.totalNumber : "0") : requiresVoucherRange ? calculatedQuantity : formData.totalNumber}
                onChange={handleChange}
                readOnly={requiresVoucherRange || isImported}
                required
              />
            </label>
            {isImported ? <p className="full-width">{t("voucherAdminPage.importStockGuidance")}</p> : null}
            <label>
              <span>{t("voucherAdminPage.voucherType")}</span>
              <select
                name="voucherType"
                value={formData.voucherType}
                onChange={handleChange}
                disabled={isEditing && loadedVoucherType === "imported"}
              >
                <option value="static">{t("voucherAdminPage.voucherTypeStatic")}</option>
                <option value="numbered">{t("voucherAdminPage.voucherTypeNumbered")}</option>
                {!isEditing || loadedVoucherType === "imported" ? <option value="imported">{t("voucherAdminPage.voucherTypeImported")}</option> : null}
              </select>
            </label>
            {isEditing ? <p className="full-width">{t("voucherAdminPage.importTypeLocked")}</p> : null}
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
            {!requiresVoucherRange && !isImported ? (
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
            {!isImported ? <div className="full-width">
              <VoucherFilePicker t={t} label={t("voucherAdminPage.qrCode")}
                accept="image/png,image/jpeg,image/webp"
                files={qrCodeFile ? [qrCodeFile] : []}
                existingUrl={formData.qrCode}
                onSelect={([file]) => setQrCodeFile(file)} />
            </div> : null}
            <label className="full-width">
              <span>{t("voucherAdminPage.terms")}</span>
              <textarea name="terms" rows="5" value={formData.terms} onChange={handleChange} required />
            </label>
            </fieldset>
            {isImported ? <VoucherImportFields
              key={importFieldsKey}
              t={t}
              batch={importBatch}
              onChange={setImportBatch}
              disabled={submitting || Boolean(pendingImport)}
              isEditing={isEditing}
            /> : null}
            <button type="submit" className="platform-vouchers-submit" disabled={submitting}>
              {submitting
                ? t(isEditing ? "voucherAdminPage.updating" : "voucherAdminPage.submitting")
                : t(pendingImport ? "voucherAdminPage.importRetry" : isEditing ? "voucherAdminPage.updateSubmit" : "voucherAdminPage.submit")}
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