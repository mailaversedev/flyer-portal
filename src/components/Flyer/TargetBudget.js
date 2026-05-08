import React, { useEffect, useState } from "react";
import { Download, Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import ApiService from "../../services/ApiService";
import { isSuperAdmin } from "../../utils/AuthUtil";
import "./TargetBudget.css";

const MIN_BUDGET = 1000;
const MAX_BUDGET = 50000;
const DEFAULT_BUDGET = 5000;

export const validateTargetBudgetStep = ({ data, isDirectUpload = false, t }) => {
  const formData = {
    district: data?.targetBudget?.district || data?.district || "",
    propertyEstate:
      data?.targetBudget?.propertyEstate || data?.propertyEstate || "",
    targetedGroup:
      data?.targetBudget?.targetedGroup || data?.targetedGroup || "",
    budget: data?.targetBudget?.budget || data?.budget || DEFAULT_BUDGET,
    paymentMethod:
      data?.targetBudget?.paymentMethod || data?.paymentMethod || "",
    noReward: Boolean(data?.targetBudget?.noReward || data?.noReward),
  };

  const missingFields = [];

  if (isDirectUpload) {
    if (!data?.header?.trim()) {
      missingFields.push(t("targetBudget.header"));
    }
    if (!(data?.adContent || "").trim()) {
      missingFields.push(t("targetBudget.adContent"));
    }
  }

  if (!formData.noReward) {
    if (!formData.paymentMethod.trim()) {
      missingFields.push(t("targetBudget.payment"));
    }
    if (!formData.budget || formData.budget < MIN_BUDGET) {
      missingFields.push(t("targetBudget.budgetHkd"));
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
};

const TargetBudget = ({
  data,
  onUpdate,
  history = [],
  isDirectUpload = false,
}) => {
  const { t, i18n } = useTranslation();
  const showNoRewardOption = isSuperAdmin();
  const formData = {
    district: data?.targetBudget?.district || data?.district || "",
    propertyEstate:
      data?.targetBudget?.propertyEstate || data?.propertyEstate || "",
    targetedGroup:
      data?.targetBudget?.targetedGroup || data?.targetedGroup || "",
    aiTargeted: data?.targetBudget?.aiTargeted || data?.aiTargeted || false,
    noSpecific: data?.targetBudget?.noSpecific || data?.noSpecific || false,
    budget: data?.targetBudget?.budget || data?.budget || DEFAULT_BUDGET,
    paymentMethod:
      data?.targetBudget?.paymentMethod || data?.paymentMethod || "",
    noReward: Boolean(data?.targetBudget?.noReward || data?.noReward),
  };

  const [previewZoom, setPreviewZoom] = useState(100);
  const [districtOptions, setDistrictOptions] = useState([]);
  const [buildingOptions, setBuildingOptions] = useState([]);
  const [isLoadingBuildings, setIsLoadingBuildings] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Fetch districts on mount
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const res = await ApiService.getDistricts();
        if (res.success && res.data) {
          setDistrictOptions(res.data);
        }
      } catch (error) {
        console.error("Failed to load district options", error);
      }
    };
    fetchDistricts();
  }, []);

  // Fetch all buildings automatically when district changes
  useEffect(() => {
    let isCancelled = false;

    const fetchAllBuildings = async () => {
      if (!formData.district) {
        setBuildingOptions([]);
        return;
      }

      setIsLoadingBuildings(true);
      setLoadingProgress(0);
      setBuildingOptions([]);
      
      try {
        let allUniqueNames = new Set();
        let startIndex = 0;
        let hasMore = true;

        while (hasMore && !isCancelled) {
          const response = await ApiService.getBuildings(formData.district, startIndex);
          
          if (response.success && response.data && response.data.features && response.data.features.length > 0) {
            const data = response.data;
            const names = data.features.map(f => f.properties.ADDRESS_E).filter(Boolean);
            names.forEach(n => allUniqueNames.add(n));
            
            // Increment progress artificially just to show movement since we don't know the exact total
            setLoadingProgress(prev => Math.min(prev + 15, 95));

            if (data.features.length < 100) {
              hasMore = false;
            } else {
              startIndex += 100;
            }
          } else {
            hasMore = false;
          }
        }
        
        if (!isCancelled) {
          setLoadingProgress(100);
          setBuildingOptions([...allUniqueNames].sort());
        }
      } catch (error) {
        if (!isCancelled) {
          console.error("Failed to fetch building data", error);
          setBuildingOptions([]);
        }
      } finally {
        if (!isCancelled) {
          setTimeout(() => setIsLoadingBuildings(false), 500); // Give progress bar half a second to show 100%
        }
      }
    };

    fetchAllBuildings();
    
    return () => {
      isCancelled = true;
    };
  }, [formData.district]);

  const handleInputChange = (field, value) => {
    const updatedData = {
      ...formData,
      [field]: value,
    };
    if (onUpdate) {
      onUpdate({
        ...data,
        targetBudget: updatedData,
      });
    }
  };

  const handleContentChange = (field, value) => {
    if (onUpdate) {
      onUpdate({
        ...data,
        [field]: value,
      });
    }
  };

  const handleCheckboxChange = (field, checked) => {
    const updatedData = {
      ...formData,
      [field]: checked,
    };
    if (onUpdate) {
      onUpdate({
        ...data,
        targetBudget: updatedData,
      });
    }
  };

  const handleBudgetChange = (value) => {
    const updatedData = {
      ...formData,
      budget: Math.max(MIN_BUDGET, Math.min(MAX_BUDGET, value)),
    };
    if (onUpdate) {
      onUpdate({
        ...data,
        targetBudget: updatedData,
      });
    }
  };
  const handleHistorySelect = (url) => {
    if (onUpdate) {
      onUpdate({
        ...data,
        coverPhoto: url,
      });
    }
  };
  const handleZoomChange = (delta) => {
    setPreviewZoom((prev) => Math.max(50, Math.min(200, prev + delta)));
  };

  const formatBudget = (amount) => {
    return amount.toLocaleString(i18n.language);
  };

  const handleDownload = () => {
    console.log("Downloading flyer...");
  };

  return (
    <div className="target-budget">
      <div className="budget-layout">
        {/* Left Side - Budget Form */}
        <div className="budget-form">
          <h3 className="section-title">{t("targetBudget.title")}</h3>

          {showNoRewardOption && (
            <div className="form-group">
              <label
                className="checkbox-label"
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexDirection: "row",
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.noReward}
                  onChange={(e) =>
                    handleCheckboxChange("noReward", e.target.checked)
                  }
                  style={{ width: "auto", marginRight: "8px" }}
                />
                <span className="checkbox-text">{t("targetBudget.noReward")}</span>
              </label>
              <div
                style={{
                  fontSize: "12px",
                  color: "#64748b",
                  marginTop: "6px",
                }}
              >
                {t("targetBudget.noRewardHint")}
              </div>
            </div>
          )}

          {isDirectUpload && (
            <>
              <div className="form-group">
                <label className="form-label">{t("targetBudget.header")}</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={t("targetBudget.headerPlaceholder")}
                  value={data.header || ""}
                  onChange={(e) =>
                    handleContentChange("header", e.target.value)
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t("targetBudget.adContent")}</label>
                <textarea
                  className="form-input"
                  placeholder={t("targetBudget.adContentPlaceholder")}
                  rows={3}
                  value={data.adContent || ""}
                  onChange={(e) =>
                    handleContentChange("adContent", e.target.value)
                  }
                  required
                  style={{
                    height: "auto",
                    paddingTop: "8px",
                    paddingBottom: "8px",
                    resize: "vertical",
                  }}
                />
              </div>
            </>
          )}

          {/* District */}
          <div className="form-group">
            <label className="form-label">{t("targetBudget.district")}</label>
            <div className="select-wrapper">
              <select
                className="form-select"
                value={formData.district}
                onChange={(e) => handleInputChange("district", e.target.value)}
                required
              >
                <option value="">{t("qrGeneration.pleaseSelect")}</option>
                {districtOptions.map((district, idx) => (
                  <option key={idx} value={district}>
                    {district}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Property Estate/Building Name */}
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
              <label className="form-label" style={{ marginBottom: 0 }}>{t("targetBudget.buildingName")}</label>
              {isLoadingBuildings && (
                <span style={{ fontSize: "12px", color: "#64748b" }}>{t("targetBudget.loadingData")}</span>
              )}
            </div>
            
            {isLoadingBuildings && (
              <div style={{ width: "100%", height: "4px", backgroundColor: "#e2e8f0", borderRadius: "2px", marginBottom: "8px", overflow: "hidden" }}>
                <div style={{ 
                  height: "100%", 
                  width: `${loadingProgress}%`, 
                  backgroundColor: "#3b82f6", 
                  transition: "width 0.3s ease" 
                }}></div>
              </div>
            )}

            <div className="select-wrapper">
              <select
                className="form-select"
                value={formData.propertyEstate}
                onChange={(e) =>
                  handleInputChange("propertyEstate", e.target.value)
                }
                disabled={isLoadingBuildings || !formData.district}
                style={{ width: "100%" }}
                required
              >
                <option value="">
                  {isLoadingBuildings
                    ? t("targetBudget.loadingBuildings") 
                    : !formData.district 
                      ? t("targetBudget.selectDistrictFirst") 
                      : t("targetBudget.selectBuilding")}
                </option>
                {buildingOptions.map((building, idx) => (
                  <option key={idx} value={building}>
                    {building}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Targeted Group */}
          <div className="form-group">
            <label className="form-label">{t("targetBudget.targetedGroup")}</label>
            <input
              type="text"
              className="form-input"
              placeholder={t("targetBudget.pleaseType")}
              value={formData.targetedGroup}
              onChange={(e) =>
                handleInputChange("targetedGroup", e.target.value)
              }
              required
            />

            <div className="checkbox-options">
              <label
                className="checkbox-label"
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexDirection: "row",
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.aiTargeted}
                  onChange={(e) =>
                    handleCheckboxChange("aiTargeted", e.target.checked)
                  }
                  style={{ width: "auto", marginRight: "8px" }}
                />
                <span className="checkbox-text">{t("targetBudget.aiTargeted")}</span>
              </label>

              <label
                className="checkbox-label"
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexDirection: "row",
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.noSpecific}
                  onChange={(e) =>
                    handleCheckboxChange("noSpecific", e.target.checked)
                  }
                  style={{ width: "auto", marginRight: "8px" }}
                />
                <span className="checkbox-text">{t("targetBudget.noSpecific")}</span>
              </label>
            </div>
          </div>

          {!formData.noReward && (
            <div className="form-group">
              <label className="form-label">{t("targetBudget.budgetHkd")}</label>
              <div className="budget-slider-container">
                <input
                  type="range"
                  min={MIN_BUDGET}
                  max={MAX_BUDGET}
                  step="1000"
                  value={formData.budget}
                  onChange={(e) => handleBudgetChange(parseInt(e.target.value))}
                  className="budget-slider"
                  required
                />
                <div className="budget-display">
                  <span className="budget-amount">
                    {formatBudget(formData.budget)}
                  </span>
                </div>
              </div>
              <div className="audience-projection">
                <span className="projection-label">
                  {t("targetBudget.projectedAudience")}
                </span>
                <span className="projection-value">
                  {t("targetBudget.approximatePersons", {
                    count: Math.floor(formData.budget / 0.845),
                  })}
                </span>
              </div>
            </div>
          )}

          {!formData.noReward && (
            <div className="form-group">
              <label className="form-label">{t("targetBudget.payment")}</label>
              <div className="payment-options">
                <label
                  className="checkbox-label"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexDirection: "row",
                  }}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="credit-card"
                    checked={formData.paymentMethod === "credit-card"}
                    onChange={(e) =>
                      handleInputChange("paymentMethod", e.target.value)
                    }
                    style={{ width: "auto", marginRight: "8px" }}
                    required
                  />
                  <span className="checkbox-text">
                    {t("targetBudget.creditCard")}
                  </span>
                </label>

                <label
                  className="checkbox-label"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexDirection: "row",
                  }}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="bank-transfer"
                    checked={formData.paymentMethod === "bank-transfer"}
                    onChange={(e) =>
                      handleInputChange("paymentMethod", e.target.value)
                    }
                    style={{ width: "auto", marginRight: "8px" }}
                    required
                  />
                  <span className="checkbox-text">{t("targetBudget.bankTransfer")}</span>
                </label>

                <label
                  className="checkbox-label"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    flexDirection: "row",
                  }}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="fps"
                    checked={formData.paymentMethod === "fps"}
                    onChange={(e) =>
                      handleInputChange("paymentMethod", e.target.value)
                    }
                    style={{ width: "auto", marginRight: "8px" }}
                    required
                  />
                  <span className="checkbox-text">{t("targetBudget.fps")}</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Right Side - Flyer Preview */}
        <div className="flyer-preview">
          <div className="preview-container">
            {history && history.length > 0 && (
              <div
                className="history-thumbnails"
                style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: "12px",
                  justifyContent: "center",
                }}
              >
                {history.map((url, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleHistorySelect(url)}
                    style={{
                      width: "60px",
                      height: "84px",
                      cursor: "pointer",
                      border:
                        data.coverPhoto === url
                          ? "2px solid #3b82f6"
                          : "1px solid #e2e8f0",
                      borderRadius: "4px",
                      overflow: "hidden",
                      opacity: data.coverPhoto === url ? 1 : 0.6,
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    }}
                      title={t("flyerPage.version", { number: history.length - idx })}
                  >
                    <img
                      src={url}
                      alt={t("flyerPage.version", { number: idx + 1 })}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="preview-image">
              {/* Show generated image if available, otherwise show placeholder */}
              {data?.coverPhoto ? (
                <div
                  className="generated-flyer"
                  style={{ transform: `scale(${previewZoom / 100})` }}
                >
                  <img
                    src={data.coverPhoto}
                    alt={t("targetBudget.generatedLeaflet")}
                    className="generated-flyer-image"
                  />
                </div>
              ) : (
                <div className="flyer-placeholder">
                  <div className="placeholder-content">
                    <div className="placeholder-header">{t("targetBudget.placeholderHeader")}</div>
                    <div className="placeholder-main">
                      <div className="placeholder-figure"></div>
                      <div className="placeholder-text">{t("targetBudget.placeholderTrial")}</div>
                      <div className="placeholder-subtitle">
                        {t("targetBudget.placeholderSubtitle")}
                      </div>
                    </div>
                    <div className="placeholder-footer">
                      <div className="placeholder-qr"></div>
                      <div className="placeholder-contact">{t("targetBudget.apply")}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="preview-controls">
              <button
                className="zoom-button"
                onClick={() => handleZoomChange(-10)}
              >
                <Minus size={16} />
              </button>
              <span className="zoom-display">{previewZoom}%</span>
              <button
                className="zoom-button"
                onClick={() => handleZoomChange(10)}
              >
                <Plus size={16} />
              </button>
              <button className="download-button" onClick={handleDownload}>
                <Download size={16} />
                {t("targetBudget.download")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TargetBudget;
