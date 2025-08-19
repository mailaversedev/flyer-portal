import React, { useState, useEffect } from 'react';
import Step1Content from '../../../components/Flyer/Leaflet/Step1Content';
import TargetBudget from '../../../components/Flyer/TargetBudget';
import { ChevronLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';
import './Leaflet.css';

const LeafletCreation = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [leafletData, setLeafletData] = useState({
    generatedImage: null, // Will store the generated leaflet image
    formData: {}
  });
  const navigate = useNavigate();
  const location = useLocation();

  // Handle direct upload from flyer selection page
  useEffect(() => {
    if (location.state?.isDirectUpload && location.state?.uploadedImage) {
      // Set the uploaded image as the generated image and skip to step 2
      setLeafletData({
        generatedImage: location.state.uploadedImage,
        formData: {
          fileName: location.state.fileName,
          fileSize: location.state.fileSize,
          isDirectUpload: true
        }
      });
      setCurrentStep(2);
    }
  }, [location.state]);

  const handleNext = (formData) => {
    if (currentStep < 2) {
      // Update leaflet data with form data
      setLeafletData(prev => ({
        ...prev,
        formData: formData
      }));
      
      // TODO: Make API call to generate leaflet image
      // For now, we'll simulate this with a placeholder
      const simulateApiCall = async () => {
        console.log('Generating leaflet with data:', formData);
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simulate generated image (in real implementation, this would be the API response)
        const generatedImageUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDIwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjNjM2NmYxIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTUwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE2Ij5HZW5lcmF0ZWQgTGVhZmxldDwvdGV4dD4KPHR3eHQgeD0iMTAwIiB5PSIxODAiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTIiPkZyb20gQVBJPC90ZXh0Pgo8L3N2Zz4K';
        
        setLeafletData(prev => ({
          ...prev,
          generatedImage: generatedImageUrl
        }));
      };
      
      simulateApiCall();
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate('/flyer');
    }
  };

  const handleGenerate = () => {
    // Handle flyer generation logic here
    console.log('Generating flyer...');
    // Could navigate to a preview page or back to flyer list
  };

  return (
    <div className="flyer-creation">
      <div className="creation-container">
        <div className="step-header">
          <div className="step-indicators">
            <div className={`step-indicator ${currentStep >= 1 ? 'active' : ''}`}>
              <span className="step-number">1</span>
              <span className="step-label">Content</span>
            </div>
            <div className={`step-connector ${currentStep >= 2 ? 'active' : ''}`}></div>
            <div className={`step-indicator ${currentStep >= 2 ? 'active' : ''}`}>
              <span className="step-number">2</span>
              <span className="step-label">Target & Budget</span>
            </div>
          </div>
        </div>

        <div className="step-content">
          {currentStep === 1 && <Step1Content onNext={handleNext} />}
          {currentStep === 2 && (
            <TargetBudget 
              data={leafletData}
              onBack={handleBack} 
              onGenerate={handleGenerate} 
            />
          )}
        </div>

        <div className="step-navigation">
          <button className="nav-button back-button" onClick={handleBack}>
            <ChevronLeft size={16} />
            Back
          </button>
          
          {currentStep === 1 && (
            <button className="nav-button next-button" onClick={handleNext}>
              Next
            </button>
          )}
          
          {currentStep === 2 && (
            <button className="nav-button generate-button" onClick={handleGenerate}>
              GENERATE
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeafletCreation;
