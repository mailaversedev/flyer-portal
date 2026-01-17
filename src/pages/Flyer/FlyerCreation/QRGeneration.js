import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, Upload, Minus, Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import QRCode from 'qrcode';
import TargetBudget from '../../../components/Flyer/TargetBudget';
import CouponBuilder from '../../../components/Flyer/CouponBuilder';
import ApiService from '../../../services/ApiService';
import './QRGeneration.css';

// Simple QR Code component
const QRCodeComponent = ({ website }) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const qrCodeUrl = await QRCode.toDataURL(website, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        setQrCodeDataUrl(qrCodeUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };

    if (website) {
      generateQRCode();
    }
  }, [website]);

  return qrCodeDataUrl ? (
    <img 
      src={qrCodeDataUrl} 
      alt="Generated QR Code" 
      className="generated-qr-code"
      style={{ width: '200px', height: '200px' }}
    />
  ) : (
    <div>Generating QR Code...</div>
  );
};

const QRGeneration = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [showQRModal, setShowQRModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [qrData, setQrData] = useState({
    // Step 1 - Background data
    coverPhoto: null,
    adCategories: '',
    location: '',
    website: '',
    startingDate: '',
    header: '',
    content: '',
    zoom: 100,
    selectedSize: '500*800', // Default to the second option
    // Step 3 - Coupon data
    couponType: '',
    couponFile: null,
    termsConditions: '',
    expiredDate: ''
  });
  const [loading, setLoading] = useState("");

  const navigate = useNavigate();

  const fileInputRef = useRef(null);

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate('/flyer');
    }
  };

  const handleProceedToQRCode = () => {
    // Validate required fields before proceeding
    if (!validateRequiredFields()) {
      // Validation failed, errors will be shown in the form
      return;
    }

    setShowQRModal(true);
    console.log('Opening QR Code modal...', qrData);
  };

  const handleSaveAndProceed = () => {
    console.log('Saving QR Code and proceeding...', qrData);
    setShowQRModal(false);
    setCurrentStep(2); // Proceed to next step
  };

  const handleNext = () => {
    if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handleCloseModal = () => {
    setShowQRModal(false);
  };

  const handleUpload = () => {
    // Trigger the hidden file input
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        // Upload the file using the API
        const uploadResponse = await ApiService.uploadFile(file, 'cover-photo');
        
        if (uploadResponse.success) {
          // Use the returned URL from the upload
          handleInputChange('coverPhoto', uploadResponse.url);
        } else {
          console.error('Failed to upload file:', uploadResponse.message);
          // Fallback to local preview if upload fails
          const reader = new FileReader();
          reader.onload = (e) => {
            handleInputChange('coverPhoto', e.target.result);
          };
          reader.readAsDataURL(file);
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        // Fallback to local preview if upload fails
        const reader = new FileReader();
        reader.onload = (e) => {
          handleInputChange('coverPhoto', e.target.result);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleCreate = async () => {
    try {
      console.log('Creating QR flyer...', qrData);
      setLoading('Creating QR flyer, please wait...');
      
      // Upload only file fields and get their URLs
      const uploadedFileUrls = await ApiService.uploadFilesFromData(qrData);
      console.log('Files uploaded, URLs:', uploadedFileUrls);
      
      // Merge uploaded URLs with original data
      let companyIcon = '';
      try {
        const companyStr = localStorage.getItem('company');
        if (companyStr) {
          companyIcon = JSON.parse(companyStr)?.icon || '';
        }
      } catch (e) {
        console.warn('Failed to parse company info for icon', e);
      }

      const finalQrData = {
        ...qrData, // All original data
        ...uploadedFileUrls, // Override with uploaded file URLs
        companyIcon
      };
      
      // Create the final flyer using the API
      const response = await ApiService.createFlyer({
        type: 'qr',
        data: finalQrData,
        targetBudget: finalQrData.targetBudget || {}
      });
      
      if (response.success) {
        console.log('QR flyer created successfully:', response);
        // Navigate to a success page or back to flyer list
        navigate('/flyer', { 
          state: { 
            success: true, 
            message: 'QR Code flyer created successfully!',
          } 
        });
      } else {
        console.error('Failed to create flyer:', response.message);
        alert('Failed to create flyer. Please try again.');
      }
    } catch (error) {
      console.error('Error creating flyer:', error);
      alert('An error occurred while creating the flyer. Please try again.');
    } finally {
      setLoading('');
    }
  };

  const updateQrData = (data) => {
    setQrData(prev => ({
      ...prev,
      ...data
    }));
  };

  const validateRequiredFields = () => {
    const newErrors = {};
    
    if (!qrData.website || qrData.website.trim() === '') {
      newErrors.website = 'Website is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field, value) => {
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    
    updateQrData({ [field]: value });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        handleInputChange('coverPhoto', e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleZoomChange = (delta) => {
    const newZoom = Math.max(50, Math.min(200, qrData.zoom + delta));
    handleInputChange('zoom', newZoom);
  };

  return (
    <div className="qr-generation">
      {/* Hidden file input for cover photo upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        style={{ display: 'none' }}
      />
      
      <div className="qr-container">
        <div className="step-header">
          <div className="step-indicators">
            <div className={`step-indicator ${currentStep >= 1 ? 'active' : ''}`}>
              <span className="step-number">1</span>
              <span className="step-label">Background</span>
            </div>
            <div className={`step-connector ${currentStep >= 2 ? 'active' : ''}`}></div>
            <div className={`step-indicator ${currentStep >= 2 ? 'active' : ''}`}>
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
            <div className="step1-background-qr">
              <div className="background-layout">
                {/* Left Side - Form */}
                <div className="background-form">
                  <h3 className="section-title">Background Information</h3>
                  
                  {/* Cover Photo Upload */}
                  <div className="form-group">
                    <label className="form-label">Upload Cover Photo</label>
                    <div className="upload-options">
                      <div className="size-options">
                        <div 
                          className={`size-option ${qrData.selectedSize === '500*500' ? 'active' : ''}`}
                          onClick={() => handleInputChange('selectedSize', '500*500')}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="size-box"></div>
                          <span className="size-label">500*500</span>
                        </div>
                        <div 
                          className={`size-option ${qrData.selectedSize === '500*800' ? 'active' : ''}`}
                          onClick={() => handleInputChange('selectedSize', '500*800')}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="size-box"></div>
                          <span className="size-label">500*800</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ad Categories */}
                  <div className="form-group">
                    <label className="form-label">Ad Categories</label>
                    <div className="select-wrapper">
                      <select
                        value={qrData.adCategories}
                        onChange={(e) => handleInputChange('adCategories', e.target.value)}
                        className="form-select"
                      >
                        <option value="">Please select</option>
                        <option value="electronics">Electronics</option>
                        <option value="fashion">Fashion</option>
                        <option value="food">Food & Beverage</option>
                        <option value="fitness">Health & Fitness</option>
                        <option value="services">Services</option>
                      </select>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Please enter location address"
                      value={qrData.location}
                      onChange={(e) => handleInputChange('location', e.target.value)}
                    />
                  </div>

                  {/* Website */}
                  <div className="form-group">
                    <label className="form-label">Website <span style={{color: '#ff4444'}}>*</span></label>
                    <input
                      type="url"
                      className={`form-input ${errors.website ? 'error' : ''}`}
                      placeholder="Please enter url (required)"
                      value={qrData.website}
                      onChange={(e) => handleInputChange('website', e.target.value)}
                      required
                    />
                    {errors.website && <span className="error-message">{errors.website}</span>}
                  </div>

                  {/* Starting Date */}
                  <div className="form-group">
                    <label className="form-label">Starting Date</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="DDMMYYYY"
                      value={qrData.startingDate}
                      onChange={(e) => handleInputChange('startingDate', e.target.value)}
                    />
                  </div>

                  {/* Header */}
                  <div className="form-group">
                    <label className="form-label">Header</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Please enter"
                      value={qrData.header}
                      onChange={(e) => handleInputChange('header', e.target.value)}
                      rows={3}
                    />
                  </div>

                  {/* Content */}
                  <div className="form-group">
                    <label className="form-label">Content</label>
                    <textarea
                      className="form-textarea"
                      placeholder="Please enter"
                      value={qrData.content}
                      onChange={(e) => handleInputChange('content', e.target.value)}
                      rows={5}
                    />
                  </div>
                </div>

                {/* Right Side - Preview */}
                <div className="preview-panel">
                  <div className="preview-container">
                    <div className="preview-upload-area">
                      {qrData.coverPhoto ? (
                        <img 
                          src={qrData.coverPhoto} 
                          alt="Cover preview" 
                          className="preview-image"
                        />
                      ) : (
                        <div className="upload-placeholder">
                          <div className="upload-icon">
                            <Upload size={48} />
                          </div>
                          <div className="upload-text">
                            <p>Place the image here or <span className="upload-link">Upload a file</span></p>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="file-input"
                            id="cover-upload-qr"
                          />
                          <label htmlFor="cover-upload-qr" className="file-input-label"></label>
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
                      <span className="zoom-display">{qrData.zoom}%</span>
                      <button 
                        className="zoom-button"
                        onClick={() => handleZoomChange(10)}
                      >
                        <Plus size={16} />
                      </button>
                      <button 
                        className="upload-button"
                        onClick={handleUpload}
                      >
                        <Upload size={16} />
                        Upload
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <TargetBudget 
              data={qrData} 
              onUpdate={updateQrData}
            />
          )}

          {currentStep === 3 && (
            <CouponBuilder 
              data={qrData} 
              onUpdate={updateQrData}
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
          <button className="nav-button back-button" onClick={handleBack} disabled={loading}>
            <ChevronLeft size={16} />
            Back
          </button>
          
          {currentStep === 1 && (
            <button 
              className={`nav-button next-button ${errors.website || !qrData.website || qrData.website.trim() === '' ? 'disabled' : ''}`}
              onClick={handleProceedToQRCode}
              disabled={loading || errors.website || !qrData.website || qrData.website.trim() === ''}
            >
            Proceed to QR Code
            </button>
          )}

          {currentStep === 2 && (
            <button className="nav-button next-button" onClick={handleNext} disabled={loading}>
              Next: Create Coupon
            </button>
          )}
          
          {currentStep === 3 && (
            <button className="nav-button complete-button" onClick={handleCreate} disabled={loading}>
              Create
            </button>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">QR Code</h3>
              <button className="close-button" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <div className="qr-code-container">
                <div className="qr-code-placeholder">
                  {/* Display the generated QR code */}
                  <div className="qr-code-image">
                    {qrData.website ? (
                      <QRCodeComponent website={qrData.website} />
                    ) : (
                      <div className="qr-pattern">
                        {/* Fallback pattern if website is not provided */}
                        {Array.from({ length: 13 }, (_, i) => (
                          <div key={i} className="qr-row">
                            {Array.from({ length: 13 }, (_, j) => (
                              <div 
                                key={j} 
                                className={`qr-cell ${(i + j) % 3 === 0 ? 'filled' : ''}`}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="modal-description">
                <p>Print And Paste In A Prominent Position On Your Own</p>
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="cancel-button" onClick={handleCloseModal}>
                Cancel
              </button>
              <button className="save-proceed-button" onClick={handleSaveAndProceed}>
                Save & Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRGeneration;
