import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Settings, Sparkles } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router";

import Step1Content from "../../../components/Flyer/Leaflet/Step1Content";
import Step1ContentPro from "../../../components/Flyer/Leaflet/Step1ContentPro";
import TargetBudget, {
  validateTargetBudgetStep,
} from "../../../components/Flyer/TargetBudget";
import CouponBuilder from "../../../components/Flyer/CouponBuilder";
import ApiService from "../../../services/ApiService";
import "../../../components/Flyer/Leaflet/Step1Content.css";
import "./Leaflet.css";

const DEFAULT_LEAFLET_DATA = {
  aspectRatio: "1:1",
  adType: "",
  referenceFlyer: null,
  designStyle: "",
  themeColor: "",
  backgroundPhoto: null,
  header: "",
  subheader: "",
  adContent: "",
  bodyCopy: "",
  flyerPrompts: "",
  promotionMessage: "",
  productPhoto: [],
  productDescriptions: "",
  tags: [],
  productName: "",
  resolution: "2K",
  primaryColor: "",
  secondaryColor: "",
  typography: "",
  brandVoice: "",
  logoImage: null,
  copyPosition: "natural placement",
  bodyCopyPosition: "natural placement",
  logoPosition: "natural placement",
};

const buildLeafletEditPayload = (data) => ({
  header: data.header,
  subheader: data.subheader,
  adContent: data.adContent,
  promotionMessage: data.promotionMessage,
  productDescriptions: data.productDescriptions,
  tags: data.tags,
});

const LeafletEditForm = ({ data, onUpdate, t }) => {
  const [newTag, setNewTag] = useState("");

  const handleAddTag = () => {
    const nextTag = newTag.trim();

    if (!nextTag || data.tags.includes(nextTag)) {
      return;
    }

    onUpdate({ tags: [...data.tags, nextTag] });
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

          <div className="form-group">
            <label className="form-label">{t("leafletStandard.subheader")}</label>
            <input
              type="text"
              className="form-input"
              placeholder={t("qrGeneration.pleaseEnter")}
              value={data.subheader || ""}
              onChange={(event) => onUpdate({ subheader: event.target.value })}
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

              {data.tags.length > 0 && (
                <div className="tags-list">
                  {data.tags.map((tag) => (
                    <span key={tag} className="tag-item">
                      {tag}
                      <button
                        type="button"
                        onClick={() =>
                          onUpdate({
                            tags: data.tags.filter((item) => item !== tag),
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
  const [currentStep, setCurrentStep] = useState(1);
  const [isProMode, setIsProMode] = useState(false);
  const [leafletData, setLeafletData] = useState(DEFAULT_LEAFLET_DATA);
  const [loading, setLoading] = useState("");
  const [isFetching, setIsFetching] = useState(isEditMode);
  const [generatedHistory, setGeneratedHistory] = useState([]);
  const step1Ref = useRef();
  const navigate = useNavigate();
  const location = useLocation();

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

  const handleNext = async () => {
    if (currentStep === 1) {
      if (step1Ref.current && !step1Ref.current.validateRequiredFields()) {
        return;
      }

      setLoading(t("leafletCreation.generatingWait"));

      try {
        const response = await ApiService.generateLeaflet(leafletData, isProMode);
        if (response.flyer_output_path) {
          setLeafletData((prev) => ({
            ...prev,
            coverPhoto: response.flyer_output_path,
          }));
          setGeneratedHistory((prev) => [response.flyer_output_path, ...prev].slice(0, 3));
        }
      } catch (error) {
        console.error("Error generating leaflet:", error);
      } finally {
        setLoading("");
      }

      setCurrentStep(2);
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
                    <div
                      style={{
                        display: "inline-flex",
                        backgroundColor: "#1e2433",
                        borderRadius: "8px",
                        padding: "4px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setIsProMode(false)}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "6px",
                          border: "none",
                          backgroundColor: !isProMode ? "#3b82f6" : "transparent",
                          color: !isProMode ? "white" : "#94a3b8",
                          cursor: "pointer",
                          fontWeight: "600",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <Settings size={16} /> {t("creation.standard")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsProMode(true)}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "6px",
                          border: "none",
                          backgroundColor: isProMode ? "#8b5cf6" : "transparent",
                          color: isProMode ? "white" : "#94a3b8",
                          cursor: "pointer",
                          fontWeight: "600",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <Sparkles size={16} /> {t("creation.pro")}
                      </button>
                    </div>
                  </div>

                  {isProMode ? (
                    <Step1ContentPro
                      ref={step1Ref}
                      data={leafletData}
                      onUpdate={updateLeafletData}
                    />
                  ) : (
                    <Step1Content
                      ref={step1Ref}
                      data={leafletData}
                      onUpdate={updateLeafletData}
                    />
                  )}
                </>
              )}

              {currentStep === 2 && (
                <TargetBudget
                  data={leafletData}
                  onUpdate={updateLeafletData}
                  history={generatedHistory}
                  isDirectUpload={location.state?.isDirectUpload}
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
                  disabled={loading}
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
      </div>
    </div>
  );
};

export default LeafletCreation;
