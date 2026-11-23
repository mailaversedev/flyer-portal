import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import TargetBudget from "../../../components/Flyer/TargetBudget";
import Step1Background from "../../../components/Flyer/QR/Step1Background";
import { QRWebsiteField } from "../../../components/Flyer/QR/QRDetails";
import FlyerContentStep from "../../../components/Flyer/FlyerContentStep";
import QRCodeModal from "../../../components/Flyer/QR/QRCodeModal";
import { validateTargetBudgetStep } from "../../../utils/FlyerValidationUtil";
import CouponBuilder from "../../../components/Flyer/CouponBuilder";
import { uploadFlyerCoupons } from "../../../utils/FlyerCouponUpload";
import ApiService from "../../../services/ApiService";
import { isSuperAdmin } from "../../../utils/AuthUtil";
import { createCreativeDefaults, getCreativeValidationErrors, getFlyerGenerationTokenCost, mergeFlyerContent, withoutCreativeFiles } from "../../../utils/FlyerContentUtil";
import { normalizeLeafletResolution } from "../../../utils/LeafletNormalizationUtil";
import "./QRGeneration.css";

const DEFAULT_QR_DATA = {
  ...createCreativeDefaults(),
  coverPhoto: null,
  flyerPrompts: "",
  adType: "",
  location: "",
  website: "",
  startingDate: "",
  header: "",
  adContent: "",
  productDescriptions: "",
  promotionMessage: "",
  couponType: "",
  couponFile: null,
  termsConditions: "",
  expiredDate: "",
  scheduledAt: null,
};

const buildQrEditPayload = (data) => ({
  adType: data.adType,
  location: data.location,
  website: data.website,
  startingDate: data.startingDate,
  header: data.header,
  productDescriptions: data.productDescriptions,
  promotionMessage: data.promotionMessage,
  scheduledAt: data.scheduledAt || data.targetBudget?.scheduledAt || null,
});

const QRGeneration = () => {
  const { t } = useTranslation();
  const { flyerId } = useParams();
  const location = useLocation();
  const isEditMode = Boolean(flyerId);
  const isSuperAdminUser = isSuperAdmin();
  const [currentStep, setCurrentStep] = useState(1);
  const [showQRModal, setShowQRModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [qrData, setQrData] = useState(DEFAULT_QR_DATA);
  const [loading, setLoading] = useState("");
  const [isFetching, setIsFetching] = useState(isEditMode);
  const [uploadedFile, setUploadedFile] = useState(
    () => (!isEditMode ? location.state?.uploadedFile || null : null),
  );
  const [history, setHistory] = useState([]);
  const [isFreeAttempt, setIsFreeAttempt] = useState(false);
  const navigate = useNavigate();
  const step1Ref = useRef(null);

  useEffect(() => {
    if (!isEditMode) {
      return;
    }

    const fetchFlyer = async () => {
      try {
        setIsFetching(true);
        const response = await ApiService.getFlyerById(flyerId);

        if (response.success && response.data) {
          if (response.data.type !== "qr") {
            navigate("/dashboard", { replace: true });
            return;
          }

          setQrData({
            ...DEFAULT_QR_DATA,
            ...response.data,
          });
        }
      } catch (error) {
        console.error("Failed to load QR flyer:", error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchFlyer();
  }, [flyerId, isEditMode, navigate]);

  const handleBack = () => {
    if (!isEditMode && currentStep > 1) {
      setCurrentStep(currentStep - 1);
      return;
    }

    navigate(isEditMode ? "/dashboard" : "/flyer");
  };

  const validateRequiredFields = () => {
    const newErrors = {};

    if (!qrData.website || qrData.website.trim() === "") {
      newErrors.website = t("qrGeneration.websiteRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const updateQrData = (data) => {
    setQrData((prev) => {
      const updates = Object.prototype.hasOwnProperty.call(data, "adContent")
        ? { ...data, productDescriptions: data.adContent }
        : data;
      return isEditMode ? { ...prev, ...updates } : mergeFlyerContent(prev, updates, Boolean(uploadedFile));
    });
  };

  const handleInputChange = (field, value) => {
    if (errors[field]) {
      setErrors((prev) => {
        const nextErrors = { ...prev };
        delete nextErrors[field];
        return nextErrors;
      });
    }

    updateQrData({ [field]: value });
  };

  const handleProceedToQRCode = async () => {
    const validCreative = step1Ref.current?.validateRequiredFields();
    if (!validateRequiredFields() || !validCreative) {
      return;
    }

    if (loading) return;
    try {
      setLoading(t("qrGeneration.preparingImage"));
      let coverPhoto = qrData.coverPhoto;
      if (!coverPhoto && uploadedFile) {
        const uploaded = await ApiService.uploadFilesFromData({ coverPhoto: uploadedFile });
        coverPhoto = uploaded.coverPhoto;
        if (!coverPhoto) throw new Error(t("qrGeneration.imageFailed"));
      } else if (!coverPhoto) {
        if (!qrData.flyerPrompts.trim()) {
          throw new Error(t("qrGeneration.promptRequired"));
        }
        if (!isSuperAdminUser) {
          const wallet = await ApiService.getCompanyWallet();
          if (!wallet.success || !wallet.data) throw new Error(t("qrGeneration.walletFailed"));
          const freeAttempts = Number(wallet.data.dailyFreeAttemptsRemaining);
          const balance = Number(wallet.data.balance);
          if (!Number.isFinite(freeAttempts) || !Number.isFinite(balance)) {
            throw new Error(t("qrGeneration.walletFailed"));
          }
          const tokenCost = getFlyerGenerationTokenCost(qrData.resolution);
          if (freeAttempts <= 0 && balance < tokenCost) {
            throw new Error(t("leafletCreation.tokenIndicatorLowBalance"));
          }
        }
        const result = await ApiService.generateLeaflet(qrData);
        coverPhoto = result.images?.[0]?.url || result.flyer_output_path;
        if (!coverPhoto || !/^https:\/\//i.test(coverPhoto)) {
          throw new Error(t("qrGeneration.imageFailed"));
        }
        let freeAttempt = false;
        if (!isSuperAdminUser) {
          const billing = await ApiService.consumeLeafletTokens({
            resolution: normalizeLeafletResolution(qrData.resolution),
            flyerOutputPath: coverPhoto,
          });
          if (!billing.success || !billing.data) throw new Error(billing.message || t("qrGeneration.billingFailed"));
          freeAttempt = Boolean(billing.data.usedFreeAttempt);
        }
        setHistory((previous) =>
          freeAttempt === isFreeAttempt
            ? [coverPhoto, ...previous.filter((url) => url !== coverPhoto)].slice(0, 3)
            : [coverPhoto],
        );
        setIsFreeAttempt(freeAttempt);
      }
      if (!coverPhoto || !/^https:\/\//i.test(coverPhoto)) {
        throw new Error(t("qrGeneration.imageFailed"));
      }
      updateQrData({ coverPhoto });
      setShowQRModal(true);
    } catch (error) {
      console.error("Failed to prepare QR flyer image:", error);
      toast.error(error.message || t("qrGeneration.imageFailed"));
    } finally {
      setLoading("");
    }
  };

  const handleSaveAndProceed = () => {
    setShowQRModal(false);
    setCurrentStep(2);
  };

  const handleNext = () => {
    if (currentStep === 2) {
      const validation = validateTargetBudgetStep({
        data: qrData,
        t,
      });
      if (!validation.isValid) {
        toast.error(
          `${t("targetBudget.completeRequiredFields")} ${validation.missingFields.join(", ")}`,
        );
        return;
      }

      setCurrentStep(3);
    }
  };

  const handleCloseModal = () => {
    setShowQRModal(false);
  };

  const handleCreate = async () => {
    try {
      const validation = validateTargetBudgetStep({
        data: qrData,
        t,
      });
      if (!validation.isValid) {
        toast.error(
          `${t("targetBudget.completeRequiredFields")} ${validation.missingFields.join(", ")}`,
        );
        return;
      }

      setLoading(t("qrGeneration.creatingWait"));

      const uploadedFileUrls = await ApiService.uploadFilesFromData({
        coverPhoto: qrData.coverPhoto,
      });
      const coupons = await uploadFlyerCoupons(qrData, t);
      // QR persistence and its locked-asset edit form use the legacy description field.
      const { adContent, ...persistentQrData } = withoutCreativeFiles(qrData);
      const finalQrData = {
        ...persistentQrData,
        productDescriptions: adContent,
        scheduledAt:
          qrData.scheduledAt || qrData.targetBudget?.scheduledAt || null,
        coverPhoto: uploadedFileUrls.coverPhoto || qrData.coverPhoto,
        coupons,
        coupon: coupons[0] || {},
      };

      const response = await ApiService.createFlyer({
        type: "qr",
        data: finalQrData,
        targetBudget: finalQrData.targetBudget || {},
      });

      if (response.success) {
        navigate("/flyer", {
          state: {
            success: true,
            message: t("qrGeneration.createdSuccess"),
          },
        });
      } else {
        toast.error(t("qrGeneration.createFailed"));
      }
    } catch (error) {
      console.error("Error creating QR flyer:", error);
      toast.error(error.message || t("qrGeneration.createError"));
    } finally {
      setLoading("");
    }
  };

  const handleUpdate = async () => {
    try {
      if (!validateRequiredFields()) {
        return;
      }

      setLoading(t("creation.updating"));

      const response = await ApiService.updateFlyer(
        flyerId,
        buildQrEditPayload(qrData),
      );

      if (response.success) {
        navigate("/dashboard");
      } else {
        toast.error(t("qrGeneration.createFailed"));
      }
    } catch (error) {
      console.error("Error updating QR flyer:", error);
      toast.error(t("qrGeneration.createError"));
    } finally {
      setLoading("");
    }
  };

  return (
    <div className="qr-generation">
      <div className="qr-container">
        {!isEditMode && (
          <div className="step-header">
            <div className="step-indicators">
              <div className={`step-indicator ${currentStep >= 1 ? "active" : ""}`}>
                <span className="step-number">1</span>
                <span className="step-label">{t("creation.content")}</span>
              </div>
              <div className={`step-connector ${currentStep >= 2 ? "active" : ""}`}></div>
              <div className={`step-indicator ${currentStep >= 2 ? "active" : ""}`}>
                <span className="step-number">2</span>
                <span className="step-label">{t("creation.targetBudget")}</span>
              </div>
              <div className={`step-connector ${currentStep >= 3 ? "active" : ""}`}></div>
              <div className={`step-indicator ${currentStep >= 3 ? "active" : ""}`}>
                <span className="step-number">3</span>
                <span className="step-label">{t("creation.createCoupon")}</span>
              </div>
            </div>
          </div>
        )}

        <div className="step-content">
          {isFetching ? (
            <div className="loading-indicator-text">{t("creation.loadingFlyer")}</div>
          ) : (
            <>
              {currentStep === 1 && (isEditMode ? (
                <Step1Background
                  qrData={qrData}
                  errors={errors}
                  handleInputChange={handleInputChange}
                />
              ) : (
                <FlyerContentStep
                  ref={step1Ref}
                  data={qrData}
                  onUpdate={updateQrData}
                  showTags={false}
                  showDesignFields={false}
                  copyLabels={{ header: t("qrGeneration.header"), adContent: t("qrGeneration.adContent") }}
                  promptLabel={t("qrGeneration.imagePrompt")}
                  getValidationErrors={(data) => uploadedFile || data.coverPhoto ? {} : getCreativeValidationErrors(data, t)}
                  uploadedFile={uploadedFile}
                  generationHint={isSuperAdminUser
                    ? t("leafletCreation.tokenIndicatorSuperAdmin")
                    : t("flyerContent.generationCost", {
                      resolution: qrData.resolution,
                      count: getFlyerGenerationTokenCost(qrData.resolution),
                    })}
                  onUsePrompt={() => {
                    setUploadedFile(null);
                    setHistory([]);
                    setIsFreeAttempt(false);
                    updateQrData({ coverPhoto: null });
                  }}
                >
                  <div className="content-section">
                    <QRWebsiteField value={qrData.website} error={errors.website} onChange={handleInputChange} />
                  </div>
                </FlyerContentStep>
              ))}

              {!isEditMode && currentStep === 2 && (
                <TargetBudget data={qrData} onUpdate={updateQrData} history={history} isFreeAttempt={isFreeAttempt} />
              )}

              {!isEditMode && currentStep === 3 && (
                <CouponBuilder data={qrData} onUpdate={updateQrData} multiple={process.env.REACT_APP_ENABLE_MULTI_COUPONS !== "false"} />
              )}
            </>
          )}
        </div>

        {loading && (
          <div className="loading-indicator-overlay">
            <div className="loading-indicator-content">
              <div className="spinner" />
              <span className="loading-indicator-text">{loading}</span>
            </div>
          </div>
        )}

        <div className="step-navigation">
          <button
            className="nav-button back-button"
            onClick={handleBack}
            disabled={loading || isFetching}
          >
            <ChevronLeft size={16} />
            {t("creation.back")}
          </button>

          {isEditMode ? (
            <button
              className="nav-button next-button"
              onClick={handleUpdate}
              disabled={loading || isFetching}
            >
              {loading ? t("creation.updating") : t("creation.saveChanges")}
            </button>
          ) : (
            <>
              {currentStep === 1 && (
                <button
                  className={`nav-button next-button ${errors.website || !qrData.website || qrData.website.trim() === "" ? "disabled" : ""}`}
                  onClick={handleProceedToQRCode}
                  disabled={
                    loading ||
                    errors.website ||
                    !qrData.website ||
                    qrData.website.trim() === ""
                  }
                >
                  {t("qrGeneration.proceedToQr")}
                </button>
              )}

              {currentStep === 2 && (
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    className="nav-button"
                    onClick={handleCreate}
                    disabled={loading}
                    style={{
                      backgroundColor: "transparent",
                      border: "1px solid #3b82f6",
                      color: "#3b82f6",
                    }}
                  >
                    {t("creation.noCoupon")}
                  </button>
                  <button
                    className="nav-button next-button"
                    onClick={handleNext}
                    disabled={loading}
                  >
                    {t("creation.proceedToCoupon")}
                  </button>
                </div>
              )}

              {currentStep === 3 && (
                <button
                  className="nav-button complete-button"
                  onClick={handleCreate}
                  disabled={loading}
                >
                  {t("creation.create")}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {!isEditMode && showQRModal && (
        <QRCodeModal
          website={qrData.website}
          handleCloseModal={handleCloseModal}
          handleSaveAndProceed={handleSaveAndProceed}
        />
      )}
    </div>
  );
};

export default QRGeneration;
