import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import ApiService from "../../services/ApiService";
import { isSuperAdmin } from "../../utils/AuthUtil";
import {
  MIN_BUDGET,
  MAX_BUDGET,
  DEFAULT_BUDGET,
  validateTargetBudgetStep,
} from "../../utils/FlyerValidationUtil";
import {
  getSpreadingCoefficientByIndustry,
  getStoredCompanyNature,
} from "../../utils/LeafletNormalizationUtil";
import FlyerPreview from "./FlyerPreview";

import "./TargetBudget.css";

const TargetBudget = ({
  data,
  onUpdate,
  history = [],
  isDirectUpload = false,
  isFreeAttempt = false,
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

  const [districtOptions, setDistrictOptions] = useState([]);
  const [buildingOptions, setBuildingOptions] = useState([]);
  const [isLoadingBuildings, setIsLoadingBuildings] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [wallet, setWallet] = useState(null);

  const companyNature =
    data?.companyNature || ApiService.getCurrentCompany()?.nature || getStoredCompanyNature();
  const spreadingCoefficient = getSpreadingCoefficientByIndustry(companyNature);
  const projectedAudienceCount = Math.max(
    0,
    Math.floor((Number(formData.budget) || 0) / spreadingCoefficient),
  );

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

  // Fetch wallet on mount
  useEffect(() => {
    if (showNoRewardOption) {
      return undefined;
    }

    const fetchWallet = async () => {
      try {
        const res = await ApiService.getCompanyWallet();
        if (res.success && res.data) {
          setWallet(res.data);
        }
      } catch (error) {
        console.error("Failed to load company wallet", error);
      }
    };
    fetchWallet();
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

  const formatBudget = (amount) => {
    return amount.toLocaleString(i18n.language);
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
              
              {wallet && (
                <div className="wallet-balance-display">
                  <span>Current Wallet Balance:</span>
                  <strong className="wallet-balance-amount">HK${(Number(wallet.creditBalanceHkd) || 0).toFixed(2)}</strong>
                </div>
              )}

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
                    count: projectedAudienceCount,
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
        <FlyerPreview
          coverPhoto={data?.coverPhoto}
          history={history}
          onHistorySelect={handleHistorySelect}
          isFreeAttempt={isFreeAttempt}
          t={t}
        />
      </div>
    </div>
  );
};

export default TargetBudget;
