import React, { useState } from 'react';
import Step1Background from '../../../components/Flyer/Query/Step1Background';
import Step2Survey from '../../../components/Flyer/Query/Step2Survey';
import TargetBudget from '../../../components/Flyer/TargetBudget';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import ApiService from '../../../services/ApiService';
import './Query.css';

const QueryCreation = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [queryData, setQueryData] = useState({
    // Step 1 - Background data
    coverPhoto: null,
    adCategory: '',
    header: '',
    content: '',
    tags: [],
    // Step 2 - Questions data
    questions: [
      {
        id: 1,
        type: 'select-without-icon',
        question: '',
        answers: ['']
      }
    ]
  });
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentStep < 3) {
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

  const handleComplete = async () => {
    try {
      console.log('Creating query flyer...', queryData);
      
      // Upload only file fields and get their URLs
      const uploadedFileUrls = await ApiService.uploadFilesFromData(queryData);
      console.log('Files uploaded, URLs:', uploadedFileUrls);
      
      // Merge uploaded URLs with original data
      const finalQueryData = {
        ...queryData, // All original data
        ...uploadedFileUrls // Override with uploaded file URLs
      };
      
      // Create the final flyer using the API
      const response = await ApiService.createFlyer({
        type: 'query',
        data: finalQueryData,
        targetBudget: finalQueryData.targetBudget || {}
      });
      
      if (response.success) {
        console.log('Query flyer created successfully:', response);
        // Navigate to a success page or back to flyer list
        navigate('/flyer', { 
          state: { 
            success: true, 
            message: 'Survey flyer created successfully!',
          } 
        });
      } else {
        console.error('Failed to create flyer:', response.message);
        alert('Failed to create flyer. Please try again.');
      }
    } catch (error) {
      console.error('Error creating flyer:', error);
      alert('An error occurred while creating the flyer. Please try again.');
    }
  };

  const updateQueryData = (data) => {
    setQueryData(prev => ({
      ...prev,
      ...data
    }));
  };

  return (
    <div className="query-creation">
      <div className="query-container">
        <div className="step-header">
          <div className="step-indicators">
            <div className={`step-indicator ${currentStep >= 1 ? 'active' : ''}`}>
              <span className="step-number">1</span>
              <span className="step-label">Background</span>
            </div>
            <div className={`step-connector ${currentStep >= 2 ? 'active' : ''}`}></div>
            <div className={`step-indicator ${currentStep >= 2 ? 'active' : ''}`}>
              <span className="step-number">2</span>
              <span className="step-label">Survey Questions</span>
            </div>
            <div className={`step-connector ${currentStep >= 3 ? 'active' : ''}`}></div>
            <div className={`step-indicator ${currentStep >= 3 ? 'active' : ''}`}>
              <span className="step-number">3</span>
              <span className="step-label">Target & Budget</span>
            </div>
          </div>
        </div>

        <div className="step-content">
          {currentStep === 1 && (
            <Step1Background 
              data={queryData} 
              onUpdate={updateQueryData}
            />
          )}
          {currentStep === 2 && (
            <Step2Survey 
              data={queryData} 
              onUpdate={updateQueryData}
            />
          )}
          {currentStep === 3 && (
            <TargetBudget 
              data={queryData} 
              onUpdate={updateQueryData}
            />
          )}
        </div>

        <div className="step-navigation">
          <button className="nav-button back-button" onClick={handleBack}>
            <ChevronLeft size={16} />
            Back
          </button>
          
          {currentStep < 3 && (
            <button className="nav-button next-button" onClick={handleNext}>
              {currentStep === 1 ? 'Next: Survey Questions' : 'Next: Target & Budget'}
            </button>
          )}
          
          {currentStep === 3 && (
            <button className="nav-button complete-button" onClick={handleComplete}>
              Create
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QueryCreation;
