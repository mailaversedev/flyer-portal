import React from "react";
import { Upload, Calendar, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import "./CouponBuilder.css";

const DigitalCoupon = ({
  companyIcon,
  value,
  description,
  expire,
  couponType,
}) => {
  const { t } = useTranslation();
  const renderCouponValue = () => {
    if (couponType === "fixed") {
      return (
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <span
            style={{
              color: "black",
              fontSize: "26px",
              lineHeight: "1.2",
              fontWeight: "bold",
            }}
          >
            $
          </span>
          <span
            style={{
              color: "black",
              fontSize: "45px",
              lineHeight: "1",
              fontWeight: "bold",
              marginLeft: "4px",
            }}
          >
            {value}
          </span>
        </div>
      );
    } else if (couponType === "buy_one_get_one") {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              color: "black",
              fontSize: "26px",
              lineHeight: "1",
              fontWeight: "bold",
            }}
          >
            BUY 1 GET 1 FREE
          </span>
        </div>
      );
    } else {
      return (
        <div style={{ display: "flex", alignItems: "center" }}>
          <span
            style={{
              color: "black",
              fontSize: "45px",
              lineHeight: "1",
              fontWeight: "bold",
            }}
          >
            {couponType === "free" ? description : value}
          </span>
          {couponType === "percentage" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                marginLeft: "4px",
              }}
            >
              <span
                style={{ color: "black", fontSize: "25px", lineHeight: "0.9" }}
              >
                %
              </span>
              <span style={{ color: "black", fontSize: "14px" }}>{t("couponBuilder.off")}</span>
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <div
      className="digital-coupon-preview"
      style={{
        width: "100%",
        height: "120px",
        backgroundColor: "white",
        borderRadius: "16px",
        display: "flex",
        overflow: "hidden",
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        marginTop: "20px",
      }}
    >
      {/* Left side with logo */}
      <div
        style={{
          width: "100px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "15px 5px 5px 15px",
          borderRight: "2px dashed #e5e5e5",
          position: "relative",
        }}
      >
        {/* Semi-circles for dashed line effect */}
        <div
          style={{
            position: "absolute",
            top: -10,
            right: -10,
            width: 20,
            height: 20,
            borderRadius: "50%",
            backgroundColor: "#1e2433",
          }}
        ></div>
        <div
          style={{
            position: "absolute",
            bottom: -10,
            right: -10,
            width: 20,
            height: 20,
            borderRadius: "50%",
            backgroundColor: "#1e2433",
          }}
        ></div>

        {companyIcon ? (
          <img
            src={companyIcon}
            alt="Company Logo"
            style={{ width: "40px", height: "40px", objectFit: "contain" }}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "placeholder-icon-url";
            }} // Add placeholder handling
          />
        ) : (
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              backgroundColor: "#f0f0f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: "20px", color: "#999" }}>{t("couponBuilder.store")}</span>
          </div>
        )}
      </div>

      {/* Right side with details */}
      <div
        style={{
          flex: 1,
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        {renderCouponValue()}

        <div
          style={{
            color: "rgba(0,0,0,0.54)",
            margin: "8px 0",
            fontSize: "14px",
            fontWeight: "500",
            lineHeight: "1.2",
          }}
        >
          {couponType === "free"
            ? t("couponBuilder.entirePurchase")
            : description || t("couponBuilder.itemDescriptionFallback")}
        </div>

        <div style={{ color: "rgba(0,0,0,0.38)", fontSize: "12px" }}>
          {t("couponBuilder.offerValidUntil", { date: expire || "YYYY-MM-DD" })}
        </div>
      </div>
    </div>
  );
};

const CouponBuilder = ({ data, onUpdate }) => {
  const { t } = useTranslation();
  const couponData = data?.coupon || {};
  const hasCustomCouponPreview = Boolean(couponData.couponFile);

  const handleInputChange = (field, value) => {
    const updatedData = {
      ...couponData,
      [field]: value,
    };
    if (onUpdate) {
      onUpdate({ coupon: updatedData });
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        handleInputChange("couponFile", e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = (field) => (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        handleInputChange(field, e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveCouponFile = () => {
    handleInputChange("couponFile", null);
  };

  return (
    <div className="coupon-builder">
      <div
        className="coupon-layout"
        style={{ display: "flex", gap: "40px", alignItems: "flex-start" }}
      >
        <div className="coupon-form" style={{ flex: 1 }}>
          <h2 className="section-title">{t("couponBuilder.title")}</h2>

          <div className="form-section">
            <div className="form-group">
              <label className="form-label">{t("couponBuilder.couponType")}</label>
              <select
                className="form-select"
                value={couponData.couponType || ""}
                onChange={(e) =>
                  handleInputChange("couponType", e.target.value)
                }
              >
                <option value="">{t("qrGeneration.pleaseSelect")}</option>
                <option value="percentage">{t("couponBuilder.percentageDiscount")}</option>
                <option value="fixed">{t("couponBuilder.fixedDiscount")}</option>
                <option value="free">{t("couponBuilder.free")}</option>
                <option value="buy_one_get_one">{t("couponBuilder.buyOneGetOne")}</option>
              </select>
            </div>

            {(couponData.couponType === "percentage" ||
              couponData.couponType === "fixed") && (
              <div className="form-group">
                <label className="form-label">
                  {couponData.couponType === "percentage"
                    ? t("couponBuilder.discountPercentage")
                    : t("couponBuilder.discountAmount")}
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder={
                    couponData.couponType === "percentage"
                        ? t("couponBuilder.enterPercentage")
                        : t("couponBuilder.enterAmount")
                  }
                  value={couponData.discountValue || ""}
                  onChange={(e) =>
                    handleInputChange("discountValue", e.target.value)
                  }
                  disabled={!!couponData.couponFile}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">{t("couponBuilder.itemDescription")}</label>
              <input
                type="text"
                className="form-input"
                placeholder={t("couponBuilder.enterItemDescription")}
                value={couponData.itemDescription || ""}
                onChange={(e) =>
                  handleInputChange("itemDescription", e.target.value)
                }
                disabled={!!couponData.couponFile}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t("couponBuilder.promotionCode")}</label>
              <input
                type="text"
                className="form-input"
                placeholder={t("couponBuilder.enterPromotionCode")}
                value={couponData.promotionCode || ""}
                onChange={(e) =>
                  handleInputChange("promotionCode", e.target.value)
                }
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t("couponBuilder.upload")}</label>
              <div className="upload-container">
                <input
                  type="file"
                  id="coupon-upload"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  style={{ display: "none" }}
                />
                <button
                  className="upload-button"
                  onClick={() =>
                    document.getElementById("coupon-upload").click()
                  }
                >
                  <span>
                    {couponData.couponFile ? t("couponBuilder.fileSelected") : t("couponBuilder.selectFile")}
                  </span>
                  <Upload size={16} />
                </button>
                {couponData.couponFile && (
                  <div className="preview-container">
                    <img
                      src={couponData.couponFile}
                      alt="Preview"
                      className="file-preview"
                    />
                    <button
                      className="remove-file"
                      type="button"
                      onClick={handleRemoveCouponFile}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t("couponBuilder.uploadQr")}</label>
              <div className="upload-container">
                <input
                  type="file"
                  id="qr-upload"
                  accept="image/*"
                  onChange={handleImageUpload("qrCodeImage")}
                  style={{ display: "none" }}
                />
                <button
                  className="upload-button"
                  onClick={() => document.getElementById("qr-upload").click()}
                  type="button"
                >
                  <span>
                    {couponData.qrCodeImage
                      ? t("couponBuilder.qrSelected")
                      : t("couponBuilder.selectQr")}
                  </span>
                  <Upload size={16} />
                </button>
                {couponData.qrCodeImage && (
                  <div className="preview-container">
                    <img
                      src={couponData.qrCodeImage}
                      alt="QR Preview"
                      className="file-preview"
                    />
                    <button
                      className="remove-file"
                      type="button"
                      onClick={() => handleInputChange("qrCodeImage", null)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t("couponBuilder.uploadBarcode")}</label>
              <div className="upload-container">
                <input
                  type="file"
                  id="barcode-upload"
                  accept="image/*"
                  onChange={handleImageUpload("barcodeImage")}
                  style={{ display: "none" }}
                />
                <button
                  className="upload-button"
                  onClick={() =>
                    document.getElementById("barcode-upload").click()
                  }
                  type="button"
                >
                  <span>
                    {couponData.barcodeImage
                      ? t("couponBuilder.barcodeSelected")
                      : t("couponBuilder.selectBarcode")}
                  </span>
                  <Upload size={16} />
                </button>
                {couponData.barcodeImage && (
                  <div className="preview-container">
                    <img
                      src={couponData.barcodeImage}
                      alt="Barcode Preview"
                      className="file-preview"
                    />
                    <button
                      className="remove-file"
                      type="button"
                      onClick={() => handleInputChange("barcodeImage", null)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t("couponBuilder.terms")}</label>
              <textarea
                className="form-textarea"
                placeholder={t("qrGeneration.pleaseEnter")}
                value={couponData.termsConditions || ""}
                onChange={(e) =>
                  handleInputChange("termsConditions", e.target.value)
                }
                rows={5}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t("couponBuilder.expiredDate")}</label>
              <div className="date-input-container">
                <input
                  type="date"
                  className="form-input date-input"
                  value={couponData.expiredDate || ""}
                  onChange={(e) =>
                    handleInputChange("expiredDate", e.target.value)
                  }
                />
                <Calendar className="date-icon" size={20} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Preview */}
        <div
          className="coupon-preview-container"
          style={{ width: "380px", flexShrink: 0 }}
        >
          <div className="form-group">
            {hasCustomCouponPreview ? (
              <div className="custom-coupon-preview-card">
                <div className="custom-coupon-preview-media">
                  <img
                    src={couponData.couponFile}
                    alt="Custom coupon preview"
                    className="custom-coupon-preview-image"
                  />
                  <button
                    className="remove-file custom-coupon-remove"
                    type="button"
                    onClick={handleRemoveCouponFile}
                    aria-label="Remove custom coupon"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: "20px",
                  backgroundColor: "#1E1E1E",
                  borderRadius: "20px",
                  border: "1px solid #333",
                }}
              >
                <DigitalCoupon
                  companyIcon={data?.companyIcon || ""}
                  value={couponData.discountValue}
                  description={couponData.itemDescription}
                  expire={couponData.expiredDate}
                  couponType={couponData.couponType}
                />
                <div
                  style={{
                    textAlign: "center",
                    color: "#666",
                    marginTop: "10px",
                    fontSize: "12px",
                  }}
                >
                  {t("couponBuilder.mobileView")}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CouponBuilder;
