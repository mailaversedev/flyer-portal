import React, { useState, useEffect, useRef } from "react";
import Step1Content from "../../../components/Flyer/Leaflet/Step1Content";
import TargetBudget from "../../../components/Flyer/TargetBudget";
import { ChevronLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router";
import ApiService from "../../../services/ApiService";
import "./Leaflet.css";

const LeafletCreation = () => {
  const [currentStep, setCurrentStep] = useState(1);
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
    productDescriptions: "",
    tags: [],
  });
  const [loading, setLoading] = useState("");

  const step1Ref = useRef();

  const navigate = useNavigate();
  const location = useLocation();

  // Handle direct upload from flyer selection page
  useEffect(() => {
    if (location.state?.isDirectUpload && location.state?.uploadedImage) {
      setCurrentStep(2);
    }
  }, [location.state]);

  const handleNext = async () => {
    if (currentStep < 2) {
      // Validate required fields before proceeding
      if (step1Ref.current && !step1Ref.current.validateRequiredFields()) {
        // Validation failed, errors will be shown in the component
        return;
      }

      setLoading("Generating leaflet, please wait...");
      console.log("Generating leaflet with data:", leafletData);

      try {
        // Make API call to generate leaflet image
        const response = await ApiService.generateLeaflet(leafletData);
        if (response.flyer_output_path) {
          setLeafletData((prev) => ({
            ...prev,
            coverPhoto: response.flyer_output_path,
          }));
        } else {
          console.error("Failed to generate leaflet:", response.message);
        }
      } catch (error) {
        console.error("Error generating leaflet:", error);
      } finally {
        setLoading("");
      }
      setCurrentStep(currentStep + 1);
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
      const {
        referenceFlyer,
        productPhoto,
        backgroundPhoto,
        ...remainingData
      } = leafletData;

      console.log("Creating flyer with leaflet data:", remainingData);
      setLoading("Creating flyer, please wait...");

      // Create the final flyer using the API
      const response = await ApiService.createFlyer({
        type: "leaflet",
        data: remainingData,
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
          </div>
        </div>

        <div className="step-content">
          {currentStep === 1 && (
            <Step1Content
              ref={step1Ref}
              data={leafletData}
              onUpdate={updateLeafletData}
            />
          )}
          {currentStep === 2 && (
            <TargetBudget data={leafletData} onUpdate={updateLeafletData} />
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
