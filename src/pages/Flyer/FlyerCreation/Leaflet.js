import React, { useState, useEffect, useRef } from 'react';
import Step1Content from '../../../components/Flyer/Leaflet/Step1Content';
import Step1ContentPro from '../../../components/Flyer/Leaflet/Step1ContentPro';
import TargetBudget from '../../../components/Flyer/TargetBudget';
import CouponBuilder from '../../../components/Flyer/CouponBuilder';
import { ChevronLeft, Sparkles, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import ApiService from '../../../services/ApiService';
import './Leaflet.css';


const LeafletCreation = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isProMode, setIsProMode] = useState(false);
  const [leafletData, setLeafletData] = useState({
    aspectRatio: "",
    adType: "",
    referenceFlyer: null,
    designStyle: "",
    themeColor: "",
    backgroundPhoto: null,
    header: "",
    subheader: "",
    adContent: "",
    flyerPrompts: "",
    promotionMessage: "",
    productPhoto: [],
    productDescriptions: '',
    tags: [],
    // Pro fields
    productName: '',
    resolution: '2K',
    primaryColor: '',
    secondaryColor: '',
    typography: '',
    brandVoice: '',
    logoImage: null,
    logoPosition: 'natural placement',
    // Step 3 - Coupon data
    couponType: '',
    couponFile: null,
    termsConditions: '',
    expiredDate: '',
    discountValue: '',
    itemDescription: ''
  });
  const [loading, setLoading] = useState("");
  const [generatedHistory, setGeneratedHistory] = useState([]);

  const step1Ref = useRef();

  const navigate = useNavigate();
  const location = useLocation();

  // Handle direct upload from flyer selection page
  useEffect(() => {
    if (location.state?.isDirectUpload && location.state?.uploadedImage) {
      setLeafletData((prev) => ({
        ...prev,
        coverPhoto: location.state.uploadedImage,
      }));
      setCurrentStep(2);
    }
  }, [location.state]);

  const handleNext = async () => {
    if (currentStep === 1) {
      // Validate required fields before proceeding
      if (step1Ref.current && !step1Ref.current.validateRequiredFields()) {
        // Validation failed, errors will be shown in the component
        return;
      }

      setLoading("Generating leaflet, please wait...");
      console.log("Generating leaflet with data:", leafletData);

      try {
        // Make API call to generate leaflet image
        const response = await ApiService.generateLeaflet(leafletData, isProMode);
        if (response.flyer_output_path) {
          setLeafletData((prev) => ({
            ...prev,
            coverPhoto: response.flyer_output_path,
          }));
          
          setGeneratedHistory((prev) => {
            const newHistory = [response.flyer_output_path, ...prev];
             // Limit to 3 most recent
            return newHistory.slice(0, 3);
          });
        } else {
          console.error("Failed to generate leaflet:", response.message);
        }
      } catch (error) {
        console.error("Error generating leaflet:", error);
      } finally {
        setLoading("");
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate("/flyer");
    }
  };

  const handleCreate = async () => {
    try {
      setLoading("Creating flyer, please wait...");
      
      // Upload coupon file if exists
      const uploadedFileUrls = await ApiService.uploadFilesFromData({
        couponFile: leafletData.couponFile
      });

      const {
        referenceFlyer,
        productPhoto,
        backgroundPhoto,
        couponFile,
        ...remainingData
      } = leafletData;

      const finalData = {
        ...remainingData,
        ...uploadedFileUrls,
        coverPhoto: leafletData.coverPhoto 
      };

      console.log("Creating flyer with leaflet data:", finalData);

      // Create the final flyer using the API
      const response = await ApiService.createFlyer({
        type: "leaflet",
        data: finalData,
      });

      if (response.success) {
        console.log("Flyer created successfully:", response);
        // Navigate to a success page or back to flyer list
        navigate("/flyer", {
          state: {
            success: true,
            message: "Leaflet flyer created successfully!",
          },
        });
      } else {
        console.error("Failed to create flyer:", response.message);
        alert("Failed to create flyer. Please try again.");
      }
    } catch (error) {
      console.error("Error creating flyer:", error);
      alert("An error occurred while creating the flyer. Please try again.");
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
        <div className="step-header">
          <div className="step-indicators">
            <div
              className={`step-indicator ${currentStep >= 1 ? "active" : ""}`}
            >
              <span className="step-number">1</span>
              <span className="step-label">Content</span>
            </div>
            <div
              className={`step-connector ${currentStep >= 2 ? "active" : ""}`}
            ></div>
            <div
              className={`step-indicator ${currentStep >= 2 ? "active" : ""}`}
            >
              <span className="step-number">2</span>
              <span className="step-label">Target & Budget</span>
            </div>
            <div className={`step-connector ${currentStep >= 3 ? 'active' : ''}`}></div>
            <div className={`step-indicator ${currentStep >= 3 ? 'active' : ''}`}>
              <span className="step-number">3</span>
              <span className="step-label">Create Coupon</span>
            </div>
          </div>
        </div>

        <div className="step-content">
          {currentStep === 1 && (
            <>
              <div style={{display: 'flex', justifyContent: 'flex-end', marginBottom: '20px'}}>
                <div style={{
                  display: 'inline-flex', 
                  backgroundColor: '#1e2433', 
                  borderRadius: '8px', 
                  padding: '4px'
                }}>
                  <button
                    type="button"
                    onClick={() => setIsProMode(false)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: !isProMode ? '#3b82f6' : 'transparent',
                      color: !isProMode ? 'white' : '#94a3b8',
                      cursor: 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Settings size={16} /> Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsProMode(true)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: isProMode ? '#8b5cf6' : 'transparent',
                      color: isProMode ? 'white' : '#94a3b8',
                      cursor: 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Sparkles size={16} /> Pro
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
            />
          )}
          {currentStep === 3 && (
            <CouponBuilder 
              data={leafletData}
              onUpdate={updateLeafletData}
            />
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
            Back
          </button>

          {currentStep === 1 && (
            <button
              className="nav-button next-button"
              onClick={handleNext}
              disabled={loading}
            >
              {loading ? "Generating..." : "Next"}
            </button>
          )}

          {currentStep === 2 && (
            <div style={{ display: 'flex', gap: '10px' }}>
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
                No Coupon this time
              </button>
              <button
                className="nav-button next-button"
                onClick={handleNext}
                disabled={loading}
              >
                Proceed to Coupon Builder
              </button>
            </div>
          )}

          {currentStep === 3 && (
            <button
              className="nav-button generate-button"
              onClick={handleCreate}
              disabled={loading}
            >
              Create
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeafletCreation;
