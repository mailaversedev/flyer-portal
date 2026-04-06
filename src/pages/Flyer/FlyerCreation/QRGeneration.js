import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, Upload, X } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";

import TargetBudget, {
  validateTargetBudgetStep,
} from "../../../components/Flyer/TargetBudget";
import CouponBuilder from "../../../components/Flyer/CouponBuilder";
import ApiService from "../../../services/ApiService";
import "./QRGeneration.css";

const DEFAULT_QR_DATA = {
  coverPhoto: null,
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
};

const buildQrEditPayload = (data) => ({
  adType: data.adType,
  location: data.location,
  website: data.website,
  startingDate: data.startingDate,
  header: data.header,
  productDescriptions: data.productDescriptions,
  promotionMessage: data.promotionMessage,
});

const QRCodeComponent = ({ website }) => {
  const { t } = useTranslation();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const qrCodeUrl = await QRCode.toDataURL(website, {
          width: 200,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
        setQrCodeDataUrl(qrCodeUrl);
      } catch (error) {
        console.error("Error generating QR code:", error);
      }
    };

    if (website) {
      generateQRCode();
    }
  }, [website]);

  return qrCodeDataUrl ? (
    <img
      src={qrCodeDataUrl}
      alt="Generated QR Code"
      className="generated-qr-code"
      style={{ width: "200px", height: "200px" }}
    />
  ) : (
    <div>{t("qrGeneration.generatingQr")}</div>
  );
};

const QRGeneration = () => {
  const { t } = useTranslation();
  const { flyerId } = useParams();
  const isEditMode = Boolean(flyerId);
  const [currentStep, setCurrentStep] = useState(1);
  const [showQRModal, setShowQRModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [qrData, setQrData] = useState(DEFAULT_QR_DATA);
  const [loading, setLoading] = useState("");
  const [isFetching, setIsFetching] = useState(isEditMode);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

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

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        const uploadResponse = await ApiService.uploadFile(file, "cover-photo");

        if (uploadResponse.success) {
          handleInputChange("coverPhoto", uploadResponse.url);
          return;
        }
      } catch (error) {
        console.error("Error uploading file:", error);
      }

      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        handleInputChange("coverPhoto", loadEvent.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        handleInputChange("coverPhoto", loadEvent.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProceedToQRCode = () => {
    if (!validateRequiredFields()) {
      return;
    }

    setShowQRModal(true);
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
        alert(
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
        alert(
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
        alert(t("qrGeneration.createFailed"));
      }
    } catch (error) {
      console.error("Error creating QR flyer:", error);
      alert(t("qrGeneration.createError"));
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
        alert(t("qrGeneration.createFailed"));
      }
    } catch (error) {
      console.error("Error updating QR flyer:", error);
      alert(t("qrGeneration.createError"));
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
                <div className="step1-background-qr">
                  <div className="background-layout">
                    <div className="background-form">
                      <h3 className="section-title">{t("qrGeneration.backgroundInformation")}</h3>

                      {isEditMode && (
                        <div
                          style={{
                            marginBottom: "20px",
                            padding: "12px 16px",
                            border: "1px solid #4b5563",
                            borderRadius: "8px",
                            background: "rgba(30, 36, 51, 0.8)",
                            color: "#cbd5e1",
                            fontSize: "14px",
                          }}
                        >
                          {t("creation.assetLocked")}
                        </div>
                      )}

                      <div className="form-group">
                        <label className="form-label">{t("dashboard.adType")}</label>
                        <div className="select-wrapper">
                          <select
                            className="form-select"
                            value={qrData.adType}
                            onChange={(event) =>
                              handleInputChange("adType", event.target.value)
                            }
                          >
                            <option value="">{t("qrGeneration.pleaseSelect")}</option>
                            <option value="promotional">{t("qrGeneration.promotional")}</option>
                            <option value="informational">{t("qrGeneration.informational")}</option>
                            <option value="event">{t("qrGeneration.event")}</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">{t("qrGeneration.location")}</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder={t("qrGeneration.locationPlaceholder")}
                          value={qrData.location}
                          onChange={(event) =>
                            handleInputChange("location", event.target.value)
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">
                          {t("qrGeneration.website")} <span style={{ color: "#ff4444" }}>*</span>
                        </label>
                        <input
                          type="url"
                          className={`form-input ${errors.website ? "error" : ""}`}
                          placeholder={t("qrGeneration.websitePlaceholder")}
                          value={qrData.website}
                          onChange={(event) =>
                            handleInputChange("website", event.target.value)
                          }
                          required
                        />
                        {errors.website && (
                          <span className="error-message">{errors.website}</span>
                        )}
                      </div>

                      <div className="form-group">
                        <label className="form-label">{t("qrGeneration.startingDate")}</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder={t("qrGeneration.datePlaceholder")}
                          value={qrData.startingDate}
                          onChange={(event) =>
                            handleInputChange("startingDate", event.target.value)
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">{t("qrGeneration.header")}</label>
                        <textarea
                          className="form-textarea"
                          placeholder={t("qrGeneration.pleaseEnter")}
                          value={qrData.header}
                          onChange={(event) =>
                            handleInputChange("header", event.target.value)
                          }
                          rows={3}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">{t("qrGeneration.adContent")}</label>
                        <textarea
                          className="form-textarea"
                          placeholder={t("qrGeneration.pleaseEnter")}
                          value={qrData.productDescriptions}
                          onChange={(event) =>
                            handleInputChange("productDescriptions", event.target.value)
                          }
                          rows={5}
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">{t("qrGeneration.promotionMessage")}</label>
                        <textarea
                          className="form-textarea"
                          placeholder={t("qrGeneration.pleaseEnter")}
                          value={qrData.promotionMessage}
                          onChange={(event) =>
                            handleInputChange("promotionMessage", event.target.value)
                          }
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="preview-panel">
                      <div className="preview-container">
                        <div className="preview-upload-area">
                          {qrData.coverPhoto ? (
                            <img
                              src={qrData.coverPhoto}
                              alt="Cover preview"
                              className="preview-image"
                            />
                          ) : (
                            <div className="upload-placeholder">
                              <div className="upload-icon">
                                <Upload size={48} />
                              </div>
                              <div className="upload-text">
                                <p>
                                  Place the image here or {" "}
                                  <span className="upload-link">{t("qrGeneration.uploadFile")}</span>
                                </p>
                              </div>
                              {!isEditMode && (
                                <>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                    className="file-input"
                                    id="cover-upload-qr"
                                  />
                                  <label
                                    htmlFor="cover-upload-qr"
                                    className="file-input-label"
                                  ></label>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {!isEditMode && (
                          <div className="preview-controls">
                            <button className="upload-button" onClick={handleUpload}>
                              <Upload size={16} />
                              {t("qrGeneration.upload")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!isEditMode && currentStep === 2 && (
                <TargetBudget data={qrData} onUpdate={updateQrData} />
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
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="qr-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{t("qrGeneration.qrCode")}</h3>
              <button className="close-button" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-content">
              <div className="qr-code-container">
                <div className="qr-code-placeholder">
                  <div className="qr-code-image">
                    {qrData.website ? (
                      <QRCodeComponent website={qrData.website} />
                    ) : (
                      <div className="qr-pattern">
                        {Array.from({ length: 13 }, (_, rowIndex) => (
                          <div key={rowIndex} className="qr-row">
                            {Array.from({ length: 13 }, (_, cellIndex) => (
                              <div
                                key={cellIndex}
                                className={`qr-cell ${(rowIndex + cellIndex) % 3 === 0 ? "filled" : ""}`}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-description">
                <p>{t("qrGeneration.qrPrintMessage")}</p>
              </div>
            </div>

            <div className="modal-actions">
              <button className="nav-button back-button" onClick={handleCloseModal}>
                {t("qrGeneration.cancel")}
              </button>
              <button className="nav-button next-button" onClick={handleSaveAndProceed}>
                {t("qrGeneration.saveProceed")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRGeneration;
