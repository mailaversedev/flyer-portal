import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import TargetBudget from "../../../components/Flyer/TargetBudget";
import Step1Background from "../../../components/Flyer/QR/Step1Background";
import QRCodeModal from "../../../components/Flyer/QR/QRCodeModal";
import { validateTargetBudgetStep } from "../../../utils/FlyerValidationUtil";
import CouponBuilder from "../../../components/Flyer/CouponBuilder";
import ApiService from "../../../services/ApiService";
import { isSuperAdmin } from "../../../utils/AuthUtil";
import "./QRGeneration.css";

const DEFAULT_QR_DATA = {
  coverPhoto: null,
  flyerPrompts: "",
  adType: "",
  location: "",
  website: "",
  startingDate: "",
  header: "",
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
  const [uploadedPreview, setUploadedPreview] = useState("");
  const [history, setHistory] = useState([]);
  const [isFreeAttempt, setIsFreeAttempt] = useState(false);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!uploadedFile) {
      setUploadedPreview("");
      return;
    }
    const preview = URL.createObjectURL(uploadedFile);
    setUploadedPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [uploadedFile]);

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
    setQrData((prev) => ({
      ...prev,
      ...data,
    }));
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

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setUploadedFile(file);
      setHistory([]);
      setIsFreeAttempt(false);
      updateQrData({ coverPhoto: null });
    } else if (file) {
      toast.error(t("qrGeneration.invalidImage"));
    }
    event.target.value = "";
  };

  const handleUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleProceedToQRCode = async () => {
    if (!validateRequiredFields()) {
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
          if (freeAttempts <= 0 && balance < 1) {
            throw new Error(t("leafletCreation.tokenIndicatorLowBalance"));
          }
        }
        const result = await ApiService.generateLeaflet({
          ...qrData,
          aspectRatio: "1:1",
          resolution: "1K",
        });
        coverPhoto = result.images?.[0]?.url || result.flyer_output_path;
        if (!coverPhoto || !/^https:\/\//i.test(coverPhoto)) {
          throw new Error(t("qrGeneration.imageFailed"));
        }
        let freeAttempt = false;
        if (!isSuperAdminUser) {
          const billing = await ApiService.consumeLeafletTokens({
            resolution: "1K",
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
        couponFile: qrData.coupon?.couponFile,
        qrCodeImage: qrData.coupon?.qrCodeImage,
        barcodeImage: qrData.coupon?.barcodeImage,
      });
      const finalQrData = {
        ...qrData,
        scheduledAt:
          qrData.scheduledAt || qrData.targetBudget?.scheduledAt || null,
        coverPhoto: uploadedFileUrls.coverPhoto || qrData.coverPhoto,
        coupon: qrData.coupon
          ? {
              ...qrData.coupon,
              couponFile:
                uploadedFileUrls.couponFile || qrData.coupon.couponFile,
              qrCodeImage:
                uploadedFileUrls.qrCodeImage || qrData.coupon.qrCodeImage,
              barcodeImage:
                uploadedFileUrls.barcodeImage || qrData.coupon.barcodeImage,
            }
          : qrData.coupon,
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
      toast.error(t("qrGeneration.createError"));
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
      {!isEditMode && (
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          aria-label={t("qrGeneration.upload")}
          style={{ display: "none" }}
        />
      )}

      <div className="qr-container">
        {!isEditMode && (
          <div className="step-header">
            <div className="step-indicators">
              <div className={`step-indicator ${currentStep >= 1 ? "active" : ""}`}>
                <span className="step-number">1</span>
                <span className="step-label">{t("creation.background")}</span>
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
              {currentStep === 1 && (
                <Step1Background
                  qrData={qrData}
                  errors={errors}
                  isEditMode={isEditMode}
                  isSuperAdminUser={isSuperAdminUser}
                  uploadedFile={uploadedFile}
                  uploadedPreview={uploadedPreview}
                  handleInputChange={handleInputChange}
                  updateQrData={updateQrData}
                  handleUpload={handleUpload}
                  onUsePrompt={() => {
                    setUploadedFile(null);
                    updateQrData({ coverPhoto: null });
                  }}
                />
              )}

              {!isEditMode && currentStep === 2 && (
                <TargetBudget data={qrData} onUpdate={updateQrData} history={history} isFreeAttempt={isFreeAttempt} />
              )}

              {!isEditMode && currentStep === 3 && (
                <CouponBuilder data={qrData} onUpdate={updateQrData} />
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
