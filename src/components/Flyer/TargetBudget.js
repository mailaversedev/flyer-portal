import React, { useState } from "react";
import { Download, Minus, Plus } from "lucide-react";
import "./TargetBudget.css";

const MIN_BUDGET = 1000;
const MAX_BUDGET = 50000;
const DEFAULT_BUDGET = 5000;

const TargetBudget = ({
  data,
  onUpdate,
  history = [],
  isDirectUpload = false,
}) => {
  const [formData, setFormData] = useState({
    district: data?.district || "",
    propertyEstate: data?.propertyEstate || "",
    targetedGroup: data?.targetedGroup || "",
    aiTargeted: data?.aiTargeted || false,
    noSpecific: data?.noSpecific || false,
    budget: data?.budget || DEFAULT_BUDGET,
    paymentMethod: data?.paymentMethod || "",
  });

  const [previewZoom, setPreviewZoom] = useState(100);

  const handleInputChange = (field, value) => {
    const updatedData = {
      ...formData,
      [field]: value,
    };
    setFormData(updatedData);
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
    setFormData(updatedData);
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
    setFormData(updatedData);
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
    return amount.toLocaleString();
  };

  const handleDownload = () => {
    console.log("Downloading flyer...");
  };

  return (
    <div className="target-budget">
      <div className="budget-layout">
        {/* Left Side - Budget Form */}
        <div className="budget-form">
          <h3 className="section-title">Budget the Leaflet/Flyer</h3>

          {isDirectUpload && (
            <>
              <div className="form-group">
                <label className="form-label">Header</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Summer Sale"
                  value={data.header || ""}
                  onChange={(e) =>
                    handleContentChange("header", e.target.value)
                  }
                />
              </div>
              <div className="form-group">
                <label className="form-label">Product Description</label>
                <textarea
                  className="form-input"
                  placeholder="Description..."
                  rows={3}
                  value={data.productDescriptions || ""}
                  onChange={(e) =>
                    handleContentChange("productDescriptions", e.target.value)
                  }
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
            <label className="form-label">District</label>
            <div className="select-wrapper">
              <select
                className="form-select"
                value={formData.district}
                onChange={(e) => handleInputChange("district", e.target.value)}
              >
                <option value="">Please select</option>
                <option value="central-&-western">Central & Western</option>
                <option value="wan-chai">Wan Chai</option>
                <option value="eastern">Eastern</option>
                <option value="southern">Southern</option>
                <option value="yau-tsim-mong">Yau Tsim Mong</option>
                <option value="sham-shui-po">Sham Shui Po</option>
                <option value="kowloon-city">Kowloon City</option>
                <option value="wong-tai-sin">Wong Tai Sin</option>
                <option value="kwun-tong">Kwun Tong</option>
                <option value="tsuen-wan">Tsuen Wan</option>
                <option value="tuen-mun">Tuen Mun</option>
                <option value="yuen-long">Yuen Long</option>
                <option value="north">North</option>
                <option value="tai-po">Tai Po</option>
                <option value="sai-kung">Sai Kung</option>
                <option value="sha-tin">Sha Tin</option>
                <option value="kwai-tsing">Kwai Tsing</option>
                <option value="islands">Islands</option>
              </select>
            </div>
          </div>

          {/* Property Estate/Building Name */}
          <div className="form-group">
            <label className="form-label">Property Estate/Building Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="Please type"
              value={formData.propertyEstate}
              onChange={(e) =>
                handleInputChange("propertyEstate", e.target.value)
              }
            />
          </div>

          {/* Targeted Group */}
          <div className="form-group">
            <label className="form-label">Targeted Group (if any)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Please type"
              value={formData.targetedGroup}
              onChange={(e) =>
                handleInputChange("targetedGroup", e.target.value)
              }
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
                <span className="checkbox-text">By AI Targeted Group</span>
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
                <span className="checkbox-text">No Specific</span>
              </label>
            </div>
          </div>

          {/* Budget */}
          <div className="form-group">
            <label className="form-label">Budget (HK$)</label>
            <div className="budget-slider-container">
              <input
                type="range"
                min={MIN_BUDGET}
                max={MAX_BUDGET}
                step="1000"
                value={formData.budget}
                onChange={(e) => handleBudgetChange(parseInt(e.target.value))}
                className="budget-slider"
              />
              <div className="budget-display">
                <span className="budget-amount">
                  {formatBudget(formData.budget)}
                </span>
              </div>
            </div>
            <div className="audience-projection">
              <span className="projection-label">
                Projected Reached Audience
              </span>
              <span className="projection-value">
                approximate {Math.floor(formData.budget / 0.845)} persons
              </span>
            </div>
          </div>

          {/* Payment */}
          <div className="form-group">
            <label className="form-label">Payment</label>
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
                />
                <span className="checkbox-text">
                  Credit Card (VISA, Master)
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
                />
                <span className="checkbox-text">By Bank Transfer</span>
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
                />
                <span className="checkbox-text">By FPS</span>
              </label>
            </div>
          </div>
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
                    title={`Version ${history.length - idx}`}
                  >
                    <img
                      src={url}
                      alt={`Generated Version ${idx + 1}`}
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
                    alt="Generated Leaflet"
                    className="generated-flyer-image"
                  />
                </div>
              ) : (
                <div className="flyer-placeholder">
                  <div className="placeholder-content">
                    <div className="placeholder-header">FIRE FITNESS</div>
                    <div className="placeholder-main">
                      <div className="placeholder-figure"></div>
                      <div className="placeholder-text">FREE 1-HOUR TRIAL</div>
                      <div className="placeholder-subtitle">
                        THIS IS MORE FOR &gt; JUST A FITNESS PLACE IT'S NOT
                        WORLD PLACE
                        <br />
                        FULL OF VITALITY AND PASSION
                      </div>
                    </div>
                    <div className="placeholder-footer">
                      <div className="placeholder-qr"></div>
                      <div className="placeholder-contact">Apply</div>
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
                Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TargetBudget;
