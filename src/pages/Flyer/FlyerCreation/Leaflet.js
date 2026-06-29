import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Sparkles } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router";

import Step1ContentPro from "../../../components/Flyer/Leaflet/Step1ContentPro";
import TargetBudget from "../../../components/Flyer/TargetBudget";
import CreditRequestModal from "../../Wallet/CreditRequestModal";
import { validateTargetBudgetStep } from "../../../utils/FlyerValidationUtil";
import CouponBuilder from "../../../components/Flyer/CouponBuilder";
import ApiService from "../../../services/ApiService";
import { isSuperAdmin } from "../../../utils/AuthUtil";
import {
  DEFAULT_TYPOGRAPHY,
  normalizeLeafletResolution,
  normalizeTypographyEntries,
} from "../../../utils/LeafletNormalizationUtil";
import "../../../components/Flyer/Leaflet/Step1Content.css";
import "./Leaflet.css";

const DEFAULT_LEAFLET_DATA = {
  aspectRatio: "4:5",
  adType: "",
  referenceFlyer: null,
  backgroundPhoto: null,
  header: "",
  adContent: "",
  flyerPrompts: "",
  promotionMessage: "",
  productPhoto: [],
  productDescriptions: "",
  tags: [],
  resolution: "2K",
  primaryColor: "",
  secondaryColor: "",
  typography: DEFAULT_TYPOGRAPHY.map((entry) => ({ ...entry })),
  brandVoice: "",
  logoImage: null,
};

const buildLeafletEditPayload = (data) => ({
  header: data.header,
  adContent: data.adContent,
  promotionMessage: data.promotionMessage,
  productDescriptions: data.productDescriptions,
  tags: data.tags,
});

const getLeafletTokenCost = (resolution = "2K") => {
  if (normalizeLeafletResolution(resolution) === "1K") {
    return 1;
  }
  return 2;
};

const LeafletEditForm = ({ data, onUpdate, t }) => {
  const [newTag, setNewTag] = useState("");
  const tags = data.tags || [];

  const handleAddTag = () => {
    const nextTag = newTag.trim();

    if (!nextTag || tags.includes(nextTag)) {
      return;
    }

    onUpdate({ tags: [...tags, nextTag] });
    setNewTag("");
  };

  return (
    <div className="step1-content">
      <div className="asset-lock-note">{t("creation.assetLocked")}</div>

      <div className="content-section" style={{ marginTop: 0 }}>
        <h3 className="section-title">{t("creation.content")}</h3>

        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">{t("leafletStandard.header")}</label>
            <input
              type="text"
              className="form-input"
              placeholder={t("qrGeneration.pleaseEnter")}
              value={data.header || ""}
              onChange={(event) => onUpdate({ header: event.target.value })}
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">{t("leafletStandard.adContent")}</label>
            <textarea
              className="form-textarea"
              placeholder={t("leafletStandard.adContentPlaceholder")}
              rows={4}
              value={data.adContent || ""}
              onChange={(event) => onUpdate({ adContent: event.target.value })}
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">{t("leafletStandard.promotionMessage")}</label>
            <textarea
              className="form-textarea"
              placeholder={t("qrGeneration.pleaseEnter")}
              rows={3}
              value={data.promotionMessage || ""}
              onChange={(event) =>
                onUpdate({ promotionMessage: event.target.value })
              }
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">{t("leafletStandard.productDescriptions")}</label>
            <input
              type="text"
              className="form-input"
              placeholder={t("qrGeneration.pleaseEnter")}
              value={data.productDescriptions || ""}
              onChange={(event) =>
                onUpdate({ productDescriptions: event.target.value })
              }
            />
          </div>

          <div className="form-group full-width">
            <label className="form-label">{t("queryStep1.tags")}</label>
            <div className="tags-input-container">
              <div className="tag-input-wrapper">
                <input
                  type="text"
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder={t("queryStep1.tagPlaceholder")}
                  className="tag-input"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="add-tag-btn"
                  disabled={!newTag.trim()}
                >
                  +
                </button>
              </div>

              {tags.length > 0 && (
                <div className="tags-list">
                  {tags.map((tag) => (
                    <span key={tag} className="tag-item">
                      {tag}
                      <button
                        type="button"
                        onClick={() =>
                          onUpdate({
                            tags: tags.filter((item) => item !== tag),
                          })
                        }
                        className="remove-tag-btn"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LeafletCreation = () => {
  const { t } = useTranslation();
  const { flyerId } = useParams();
  const isEditMode = Boolean(flyerId);
  const isSuperAdminUser = isSuperAdmin();
  const [currentStep, setCurrentStep] = useState(1);
  const [leafletData, setLeafletData] = useState(DEFAULT_LEAFLET_DATA);
  const [loading, setLoading] = useState("");
  const [isFetching, setIsFetching] = useState(isEditMode);
  const [isFreeAttempt, setIsFreeAttempt] = useState(false);
  const [generatedHistory, setGeneratedHistory] = useState([]);
  const [walletSummary, setWalletSummary] = useState(null);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const step1Ref = useRef();
  const navigate = useNavigate();
  const location = useLocation();

  const tokenCost = getLeafletTokenCost(leafletData.resolution);
  const availableTokens = Number(walletSummary?.balance) || 0;
  const freeAttemptsRemaining = Number(walletSummary?.dailyFreeAttemptsRemaining) || 0;
  const hasFreeAttemptRemaining = isSuperAdminUser || freeAttemptsRemaining > 0;
  const hasEnoughTokens = isSuperAdminUser || availableTokens >= tokenCost;
  const canGenerate = hasFreeAttemptRemaining || hasEnoughTokens;

  useEffect(() => {
    if (isEditMode) {
      return;
    }

    if (location.state?.isDirectUpload && location.state?.uploadedImage) {
      setLeafletData((prev) => ({
        ...prev,
        coverPhoto: location.state.uploadedImage,
      }));
      setCurrentStep(2);
    }
  }, [isEditMode, location.state]);

  useEffect(() => {
    if (!isEditMode) {
      return;
    }

    const fetchFlyer = async () => {
      try {
        setIsFetching(true);
        const response = await ApiService.getFlyerById(flyerId);

        if (response.success && response.data) {
          if (response.data.type !== "leaflet") {
            navigate("/dashboard", { replace: true });
            return;
          }

          setLeafletData({
            ...DEFAULT_LEAFLET_DATA,
            ...response.data,
            tags: response.data.tags || [],
            typography: normalizeTypographyEntries(response.data.typography),
          });
        }
      } catch (error) {
        console.error("Failed to load leaflet flyer:", error);
      } finally {
        setIsFetching(false);
      }
    };

    fetchFlyer();
  }, [flyerId, isEditMode, navigate]);

  useEffect(() => {
    if (isEditMode) {
      return;
    }

    const fetchWallet = async () => {
      try {
        const response = await ApiService.getCompanyWallet();

        if (response.success && response.data) {
          setWalletSummary(response.data);
        }
      } catch (error) {
        console.error("Failed to load company wallet:", error);
      }
    };

    fetchWallet();
  }, [isEditMode, isSuperAdminUser]);

  const handleCreditRequestSuccess = () => {
    setShowCreditModal(false);
    alert("Thank you. The Amount will be credited within 12hours. Please kindly email us if you have any troubles.");
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      if (step1Ref.current && !step1Ref.current.validateRequiredFields()) {
        return;
      }

      if (!isSuperAdminUser && walletSummary && !canGenerate) {
        alert(t("leafletCreation.tokenIndicatorLowBalance"));
        return;
      }

      setLoading(t("leafletCreation.generatingWait"));

      try {
        const isFree = !isSuperAdminUser && freeAttemptsRemaining > 0;
        const response = await ApiService.generateLeaflet(leafletData);
        const generatedUrls = Array.isArray(response?.images)
          ? response.images.map((image) => image?.url).filter(Boolean)
          : [];
        const flyerOutputPath = generatedUrls[0] || response?.flyer_output_path;
        const billingResolution = normalizeLeafletResolution(leafletData.resolution);

        if (flyerOutputPath) {
          setIsFreeAttempt(isFree);
          let billingResponse = null;

          if (!isSuperAdminUser) {
            billingResponse = await ApiService.consumeLeafletTokens({
              resolution: billingResolution,
              flyerOutputPath,
            });
          }

          setLeafletData((prev) => ({
            ...prev,
            coverPhoto: flyerOutputPath,
          }));
          setGeneratedHistory((prev) => {
            const mergedUrls = [...generatedUrls, flyerOutputPath, ...prev].filter(Boolean);
            return Array.from(new Set(mergedUrls)).slice(0, 3);
          });
          if (billingResponse?.success && billingResponse?.data) {
            setWalletSummary((prev) => ({
              ...(prev || {}),
              balance:
                typeof billingResponse.data.newBalance === "number"
                  ? billingResponse.data.newBalance
                  : prev?.balance,
              dailyFreeAttemptsRemaining:
                typeof billingResponse.data.dailyFreeAttemptsRemaining === "number"
                  ? billingResponse.data.dailyFreeAttemptsRemaining
                  : prev?.dailyFreeAttemptsRemaining,
              dailyFreeAttemptsUsed:
                typeof billingResponse.data.dailyFreeAttemptsUsed === "number"
                  ? billingResponse.data.dailyFreeAttemptsUsed
                  : prev?.dailyFreeAttemptsUsed,
              updatedAt: new Date().toISOString(),
            }));
          }
          setCurrentStep(2);
          return;
        }

        alert(t("leafletCreation.createFailed"));
      } catch (error) {
        console.error("Error generating leaflet:", error);
        alert(error.message || t("leafletCreation.createError"));
      } finally {
        setLoading("");
      }
      return;
    }

    if (currentStep === 2) {
      const validation = validateTargetBudgetStep({
        data: leafletData,
        isDirectUpload: location.state?.isDirectUpload,
        t,
      });
      if (!validation.isValid) {
        alert(
          `${t("targetBudget.completeRequiredFields")} ${validation.missingFields.join(", ")}`,
        );
        return;
      }

      const noReward = Boolean(leafletData?.targetBudget?.noReward || leafletData?.noReward);
      if (!noReward && !isSuperAdminUser) {
        const budget = Number(leafletData?.targetBudget?.budget || leafletData?.budget || 0);
        const creditBalanceHkd = Number(walletSummary?.creditBalanceHkd) || 0;
        
        if (budget > creditBalanceHkd) {
          setShowCreditModal(true);
          return;
        }
      }

      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (!isEditMode && currentStep > 1) {
      setCurrentStep(currentStep - 1);
      return;
    }

    navigate(isEditMode ? "/dashboard" : "/flyer");
  };

  const handleCreate = async () => {
    try {
      setLoading(t("leafletCreation.creatingWait"));

      const uploadedFileUrls = await ApiService.uploadFilesFromData({
        coverPhoto: leafletData.coverPhoto,
        couponFile: leafletData.coupon?.couponFile,
        qrCodeImage: leafletData.coupon?.qrCodeImage,
        barcodeImage: leafletData.coupon?.barcodeImage,
      });

      const {
        referenceFlyer,
        productPhoto,
        backgroundPhoto,
        coupon,
        ...remainingData
      } = leafletData;

      const finalData = {
        ...remainingData,
        tags: Array.isArray(leafletData.tags) ? leafletData.tags : [],
        coupon: {
          ...(coupon || {}),
          couponFile: uploadedFileUrls.couponFile || coupon?.couponFile || null,
          qrCodeImage: uploadedFileUrls.qrCodeImage || coupon?.qrCodeImage || null,
          barcodeImage: uploadedFileUrls.barcodeImage || coupon?.barcodeImage || null,
        },
        coverPhoto: uploadedFileUrls.coverPhoto || leafletData.coverPhoto,
      };

      const response = await ApiService.createFlyer({
        type: "leaflet",
        data: finalData,
      });

      if (response.success) {
        navigate("/flyer", {
          state: {
            success: true,
            message: t("leafletCreation.createdSuccess"),
          },
        });
      } else {
        alert(t("leafletCreation.createFailed"));
      }
    } catch (error) {
      console.error("Error creating flyer:", error);
      alert(t("leafletCreation.createError"));
    } finally {
      setLoading("");
    }
  };

  const handleUpdate = async () => {
    try {
      setLoading(t("creation.updating"));

      const response = await ApiService.updateFlyer(
        flyerId,
        buildLeafletEditPayload(leafletData),
      );

      if (response.success) {
        navigate("/dashboard");
      } else {
        alert(t("leafletCreation.createFailed"));
      }
    } catch (error) {
      console.error("Error updating leaflet flyer:", error);
      alert(t("leafletCreation.createError"));
    } finally {
      setLoading("");
    }
  };

  const updateLeafletData = (data) => {
    setLeafletData((prev) => ({
      ...prev,
      ...data,
    }));
  };

  return (
    <div className="flyer-creation">
      <div className="creation-container">
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
          ) : isEditMode ? (
            <LeafletEditForm data={leafletData} onUpdate={updateLeafletData} t={t} />
          ) : (
            <>
              {currentStep === 1 && (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginBottom: "20px",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        backgroundColor: "#1e2433",
                        color: "#e2e8f0",
                        border: "1px solid #334155",
                        borderRadius: "999px",
                        padding: "8px 14px",
                        fontWeight: 600,
                      }}
                    >
                      <Sparkles size={16} />
                      {t("creation.pro")}
                    </span>
                  </div>

                  <Step1ContentPro
                    ref={step1Ref}
                    data={leafletData}
                    onUpdate={updateLeafletData}
                  />

                  <div
                    style={{
                      marginTop: "20px",
                      padding: "18px 20px",
                      borderRadius: "16px",
                      border: `1px solid ${canGenerate ? "#334155" : "#7f1d1d"}`,
                      background: canGenerate
                        ? "linear-gradient(135deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.96))"
                        : "linear-gradient(135deg, rgba(69, 10, 10, 0.95), rgba(31, 41, 55, 0.96))",
                      color: "#e2e8f0",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "16px",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <span
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: canGenerate ? "#93c5fd" : "#fca5a5",
                        }}
                      >
                        {t("leafletCreation.tokenIndicatorTitle")}
                      </span>
                      <strong style={{ fontSize: "1.05rem" }}>
                        {hasFreeAttemptRemaining && !isSuperAdminUser
                          ? t("leafletCreation.freeAttemptMessage", {
                              count: freeAttemptsRemaining,
                            })
                          : t("leafletCreation.tokenIndicatorCost", {
                              count: tokenCost,
                              resolution: normalizeLeafletResolution(leafletData.resolution),
                            })}
                      </strong>
                      {isSuperAdminUser ? (
                        <span style={{ color: "#cbd5e1" }}>
                          {t("leafletCreation.tokenIndicatorSuperAdmin")}
                        </span>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ color: "#cbd5e1" }}>
                            {t("leafletCreation.tokenIndicatorBalance", {
                              count: availableTokens,
                            })}
                          </span>
                          <span style={{ color: "#cbd5e1" }}>
                            {t("leafletCreation.freeAttemptBalance", {
                              count: freeAttemptsRemaining,
                            })}
                          </span>
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        borderRadius: "999px",
                        padding: "8px 12px",
                        backgroundColor: canGenerate
                          ? "rgba(37, 99, 235, 0.18)"
                          : "rgba(220, 38, 38, 0.2)",
                        color: canGenerate ? "#dbeafe" : "#fecaca",
                        fontWeight: 600,
                      }}
                    >
                      {isSuperAdminUser
                        ? t("leafletCreation.tokenIndicatorExempt")
                        : hasFreeAttemptRemaining
                          ? t("leafletCreation.freeAttemptReady", {
                              count: freeAttemptsRemaining,
                            })
                        : hasEnoughTokens
                          ? t("leafletCreation.tokenIndicatorReady")
                          : t("leafletCreation.tokenIndicatorLowBalance")}
                    </div>
                  </div>
                </>
              )}

              {currentStep === 2 && (
                <TargetBudget
                  data={leafletData}
                  onUpdate={updateLeafletData}
                  history={generatedHistory}
                  isDirectUpload={location.state?.isDirectUpload}
                  isFreeAttempt={isFreeAttempt}
                />
              )}

              {currentStep === 3 && (
                <CouponBuilder data={leafletData} onUpdate={updateLeafletData} />
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
                  className="nav-button next-button"
                  onClick={handleNext}
                  disabled={loading || (!isSuperAdminUser && walletSummary && !canGenerate)}
                >
                  {loading ? t("leafletCreation.generating") : t("creation.next")}
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
                  className="nav-button generate-button"
                  onClick={handleCreate}
                  disabled={loading}
                >
                  {t("creation.create")}
                </button>
              )}
            </>
          )}
        </div>

        {showCreditModal && (
          <CreditRequestModal 
            onClose={() => setShowCreditModal(false)}
            onSuccess={handleCreditRequestSuccess}
          />
        )}
      </div>
    </div>
  );
};

export default LeafletCreation;
