import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, Upload, X } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";
import TargetBudget from "../../../components/Flyer/TargetBudget";
import CouponBuilder from "../../../components/Flyer/CouponBuilder";
import ApiService from "../../../services/ApiService";
import "./QRGeneration.css";

// Simple QR Code component
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
  const [currentStep, setCurrentStep] = useState(1);
  const [showQRModal, setShowQRModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [qrData, setQrData] = useState({
    // Step 1 - Background data
    coverPhoto: null,
    adType: "",
    location: "",
    website: "",
    startingDate: "",
    header: "",
    productDescriptions: "",
    promotionMessage: "",
    // Step 3 - Coupon data
    couponType: "",
    couponFile: null,
    termsConditions: "",
    expiredDate: "",
  });
  const [loading, setLoading] = useState("");

  const navigate = useNavigate();

  const fileInputRef = useRef(null);

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate("/flyer");
    }
  };

  const handleProceedToQRCode = () => {
    // Validate required fields before proceeding
    if (!validateRequiredFields()) {
      // Validation failed, errors will be shown in the form
      return;
    }

    setShowQRModal(true);
    console.log("Opening QR Code modal...", qrData);
  };

  const handleSaveAndProceed = () => {
    console.log("Saving QR Code and proceeding...", qrData);
    setShowQRModal(false);
    setCurrentStep(2); // Proceed to next step
  };

  const handleNext = () => {
    if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handleCloseModal = () => {
    setShowQRModal(false);
  };

  const handleUpload = () => {
    // Trigger the hidden file input
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        // Upload the file using the API
        const uploadResponse = await ApiService.uploadFile(file, "cover-photo");

        if (uploadResponse.success) {
          // Use the returned URL from the upload
          handleInputChange("coverPhoto", uploadResponse.url);
        } else {
          console.error("Failed to upload file:", uploadResponse.message);
          // Fallback to local preview if upload fails
          const reader = new FileReader();
          reader.onload = (e) => {
            handleInputChange("coverPhoto", e.target.result);
          };
          reader.readAsDataURL(file);
        }
      } catch (error) {
        console.error("Error uploading file:", error);
        // Fallback to local preview if upload fails
        const reader = new FileReader();
        reader.onload = (e) => {
          handleInputChange("coverPhoto", e.target.result);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleCreate = async () => {
    try {
      console.log("Creating QR flyer...", qrData);
      setLoading(t("qrGeneration.creatingWait"));

      // Upload only file fields and get their URLs
      const uploadedFileUrls = await ApiService.uploadFilesFromData(qrData);
      console.log("Files uploaded, URLs:", uploadedFileUrls);

      // Merge uploaded URLs with original data
      const finalQrData = {
        ...qrData, // All original data
        ...uploadedFileUrls, // Override with uploaded file URLs
      };

      // Create the final flyer using the API
      const response = await ApiService.createFlyer({
        type: "qr",
        data: finalQrData,
        targetBudget: finalQrData.targetBudget || {},
      });

      if (response.success) {
        console.log("QR flyer created successfully:", response);
        // Navigate to a success page or back to flyer list
        navigate("/flyer", {
          state: {
            success: true,
            message: t("qrGeneration.createdSuccess"),
          },
        });
      } else {
        console.error("Failed to create flyer:", response.message);
        alert(t("qrGeneration.createFailed"));
      }
    } catch (error) {
      console.error("Error creating flyer:", error);
      alert(t("qrGeneration.createError"));
    } finally {
      setLoading("");
    }
  };

  const updateQrData = (data) => {
    setQrData((prev) => ({
      ...prev,
      ...data,
    }));
  };

  const validateRequiredFields = () => {
    const newErrors = {};

    if (!qrData.website || qrData.website.trim() === "") {
      newErrors.website = t("qrGeneration.websiteRequired");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }

    updateQrData({ [field]: value });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        handleInputChange("coverPhoto", e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="qr-generation">
      {/* Hidden file input for cover photo upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        style={{ display: "none" }}
      />

      <div className="qr-container">
        <div className="step-header">
          <div className="step-indicators">
            <div
              className={`step-indicator ${currentStep >= 1 ? "active" : ""}`}
            >
              <span className="step-number">1</span>
              <span className="step-label">{t("creation.background")}</span>
            </div>
            <div
              className={`step-connector ${currentStep >= 2 ? "active" : ""}`}
            ></div>
            <div
              className={`step-indicator ${currentStep >= 2 ? "active" : ""}`}
            >
              <span className="step-number">2</span>
              <span className="step-label">{t("creation.targetBudget")}</span>
            </div>
            <div
              className={`step-connector ${currentStep >= 3 ? "active" : ""}`}
            ></div>
            <div
              className={`step-indicator ${currentStep >= 3 ? "active" : ""}`}
            >
              <span className="step-number">3</span>
              <span className="step-label">{t("creation.createCoupon")}</span>
            </div>
          </div>
        </div>

        <div className="step-content">
          {currentStep === 1 && (
            <div className="step1-background-qr">
              <div className="background-layout">
                {/* Left Side - Form */}
                <div className="background-form">
                  <h3 className="section-title">{t("qrGeneration.backgroundInformation")}</h3>

                  {/* Ad Type */}
                  <div className="form-group">
                    <label className="form-label">{t("dashboard.adType")}</label>
                    <div className="select-wrapper">
                      <select
                        className="form-select"
                        value={qrData.adType}
                        onChange={(e) =>
                          handleInputChange("adType", e.target.value)
                        }
                      >
                        <option value="">{t("qrGeneration.pleaseSelect")}</option>
                        <option value="promotional">{t("qrGeneration.promotional")}</option>
                        <option value="informational">{t("qrGeneration.informational")}</option>
                        <option value="event">{t("qrGeneration.event")}</option>
                      </select>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="form-group">
                    <label className="form-label">{t("qrGeneration.location")}</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={t("qrGeneration.locationPlaceholder")}
                      value={qrData.location}
                      onChange={(e) =>
                        handleInputChange("location", e.target.value)
                      }
                    />
                  </div>

                  {/* Website */}
                  <div className="form-group">
                    <label className="form-label">
                      {t("qrGeneration.website")} <span style={{ color: "#ff4444" }}>*</span>
                    </label>
                    <input
                      type="url"
                      className={`form-input ${errors.website ? "error" : ""}`}
                      placeholder={t("qrGeneration.websitePlaceholder")}
                      value={qrData.website}
                      onChange={(e) =>
                        handleInputChange("website", e.target.value)
                      }
                      required
                    />
                    {errors.website && (
                      <span className="error-message">{errors.website}</span>
                    )}
                  </div>

                  {/* Starting Date */}
                  <div className="form-group">
                    <label className="form-label">{t("qrGeneration.startingDate")}</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={t("qrGeneration.datePlaceholder")}
                      value={qrData.startingDate}
                      onChange={(e) =>
                        handleInputChange("startingDate", e.target.value)
                      }
                    />
                  </div>

                  {/* Header */}
                  <div className="form-group">
                    <label className="form-label">{t("qrGeneration.header")}</label>
                    <textarea
                      className="form-textarea"
                      placeholder={t("qrGeneration.pleaseEnter")}
                      value={qrData.header}
                      onChange={(e) =>
                        handleInputChange("header", e.target.value)
                      }
                      rows={3}
                    />
                  </div>

                  {/* Ad Content */}
                  <div className="form-group">
                    <label className="form-label">{t("qrGeneration.adContent")}</label>
                    <textarea
                      className="form-textarea"
                      placeholder={t("qrGeneration.pleaseEnter")}
                      value={qrData.productDescriptions}
                      onChange={(e) =>
                        handleInputChange("productDescriptions", e.target.value)
                      }
                      rows={5}
                    />
                  </div>

                  {/* Promotion Message */}
                  <div className="form-group">
                    <label className="form-label">
                      {t("qrGeneration.promotionMessage")}
                    </label>
                    <textarea
                      className="form-textarea"
                      placeholder={t("qrGeneration.pleaseEnter")}
                      value={qrData.promotionMessage}
                      onChange={(e) =>
                        handleInputChange("promotionMessage", e.target.value)
                      }
                      rows={3}
                    />
                  </div>
                </div>

                {/* Right Side - Preview */}
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
                              Place the image here or{" "}
                              <span className="upload-link">{t("qrGeneration.uploadFile")}</span>
                            </p>
                          </div>
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
                        </div>
                      )}
                    </div>

                    <div className="preview-controls">
                      <button className="upload-button" onClick={handleUpload}>
                        <Upload size={16} />
                        {t("qrGeneration.upload")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <TargetBudget data={qrData} onUpdate={updateQrData} />
          )}

          {currentStep === 3 && (
            <CouponBuilder data={qrData} onUpdate={updateQrData} />
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
            disabled={loading}
          >
            <ChevronLeft size={16} />
            {t("creation.back")}
          </button>

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
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{t("qrGeneration.qrCode")}</h3>
              <button className="close-button" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-content">
              <div className="qr-code-container">
                <div className="qr-code-placeholder">
                  {/* Display the generated QR code */}
                  <div className="qr-code-image">
                    {qrData.website ? (
                      <QRCodeComponent website={qrData.website} />
                    ) : (
                      <div className="qr-pattern">
                        {/* Fallback pattern if website is not provided */}
                        {Array.from({ length: 13 }, (_, i) => (
                          <div key={i} className="qr-row">
                            {Array.from({ length: 13 }, (_, j) => (
                              <div
                                key={j}
                                className={`qr-cell ${(i + j) % 3 === 0 ? "filled" : ""}`}
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
              <button className="cancel-button" onClick={handleCloseModal}>
                {t("qrGeneration.cancel")}
              </button>
              <button
                className="save-proceed-button"
                onClick={handleSaveAndProceed}
              >
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
