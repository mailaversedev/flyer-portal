import React, { useState } from 'react';
import Step1Content from '../../../components/Flyer/Leaflet/Step1Content';
import TargetBudget from '../../../components/Flyer/TargetBudget';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import './Leaflet.css';

const LeafletCreation = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentStep < 2) {
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
          {currentStep === 2 && <TargetBudget onBack={handleBack} onGenerate={handleGenerate} />}
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
