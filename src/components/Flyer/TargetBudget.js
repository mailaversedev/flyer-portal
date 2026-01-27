import React, { useState } from 'react';
import { Download, Minus, Plus } from 'lucide-react';
import './TargetBudget.css';

const TargetBudget = ({ data, onUpdate }) => {
  const [formData, setFormData] = useState({
    district: data?.district || '',
    propertyEstate: data?.propertyEstate || '',
    targetedGroup: data?.targetedGroup || '',
    aiTargeted: data?.aiTargeted || false,
    noSpecific: data?.noSpecific || false,
    budget: data?.budget || 25000,
    paymentMethod: data?.paymentMethod || '',
  });

  const [previewZoom, setPreviewZoom] = useState(100);

  const handleInputChange = (field, value) => {
    const updatedData = {
      ...formData,
      [field]: value
    };
    setFormData(updatedData);
    if (onUpdate) {
      onUpdate({
        ...data,
        targetBudget: updatedData
      });
    }
  };

  const handleCheckboxChange = (field, checked) => {
    const updatedData = {
      ...formData,
      [field]: checked
    };
    setFormData(updatedData);
    if (onUpdate) {
      onUpdate({
        ...data,
        targetBudget: updatedData
      });
    }
  };

  const handleBudgetChange = (value) => {
    const updatedData = {
      ...formData,
      budget: Math.max(0, value)
    };
    setFormData(updatedData);
    if (onUpdate) {
     onUpdate({
        ...data,
        targetBudget: updatedData
      });
    }
  };

  const handleZoomChange = (delta) => {
    setPreviewZoom(prev => Math.max(50, Math.min(200, prev + delta)));
  };

  const formatBudget = (amount) => {
    return amount.toLocaleString();
  };

  const handleDownload = () => {
    console.log('Downloading flyer...');
  };

  return (
    <div className="target-budget">
      <div className="budget-layout">
        {/* Left Side - Budget Form */}
        <div className="budget-form">
          <h3 className="section-title">Budget the Leaflet/Flyer</h3>
          
          {/* District */}
          <div className="form-group">
            <label className="form-label">District</label>
            <div className="select-wrapper">
              <select 
                className="form-select"
                value={formData.district}
                onChange={(e) => handleInputChange('district', e.target.value)}
              >
                <option value="">Please select</option>
                <option value="central">Central</option>
                <option value="wan-chai">Wan Chai</option>
                <option value="causeway-bay">Causeway Bay</option>
                <option value="tsim-sha-tsui">Tsim Sha Tsui</option>
                <option value="mong-kok">Mong Kok</option>
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
              onChange={(e) => handleInputChange('propertyEstate', e.target.value)}
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
              onChange={(e) => handleInputChange('targetedGroup', e.target.value)}
            />
            
            <div className="checkbox-options">
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', flexDirection: 'row' }}>
                <input
                  type="checkbox"
                  checked={formData.aiTargeted}
                  onChange={(e) => handleCheckboxChange('aiTargeted', e.target.checked)}
                  style={{ width: 'auto', marginRight: '8px' }}
                />
                <span className="checkbox-text">By AI Targeted Group</span>
              </label>
              
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', flexDirection: 'row' }}>
                <input
                  type="checkbox"
                  checked={formData.noSpecific}
                  onChange={(e) => handleCheckboxChange('noSpecific', e.target.checked)}
                  style={{ width: 'auto', marginRight: '8px' }}
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
                min="5000"
                max="1000000"
                step="1000"
                value={formData.budget}
                onChange={(e) => handleBudgetChange(parseInt(e.target.value))}
                className="budget-slider"
              />
              <div className="budget-display">
                <span className="budget-amount">{formatBudget(formData.budget)}</span>
              </div>
            </div>
            <div className="audience-projection">
              <span className="projection-label">Projected Reached Audience</span>
              <span className="projection-value">approximate {Math.floor(formData.budget / 0.6 / 20)} persons</span>
            </div>
          </div>

          {/* Payment */}
          <div className="form-group">
            <label className="form-label">Payment</label>
            <div className="payment-options">
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', flexDirection: 'row' }}>
                <input
                  type="radio"
                  name="payment"
                  value="credit-card"
                  checked={formData.paymentMethod === 'credit-card'}
                  onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                  style={{ width: 'auto', marginRight: '8px' }}
                />
                <span className="checkbox-text">Credit Card (VISA, Master)</span>
              </label>
              
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', flexDirection: 'row' }}>
                <input
                  type="radio"
                  name="payment"
                  value="bank-transfer"
                  checked={formData.paymentMethod === 'bank-transfer'}
                  onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                  style={{ width: 'auto', marginRight: '8px' }}
                />
                <span className="checkbox-text">By Bank Transfer</span>
              </label>
              
              <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', flexDirection: 'row' }}>
                <input
                  type="radio"
                  name="payment"
                  value="fps"
                  checked={formData.paymentMethod === 'fps'}
                  onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                  style={{ width: 'auto', marginRight: '8px' }}
                />
                <span className="checkbox-text">By FPS</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Side - Flyer Preview */}
        <div className="flyer-preview">
          <div className="preview-container">
            <div className="preview-image">
              {/* Show generated image if available, otherwise show placeholder */}
              {data?.coverPhoto ? (
                <div className="generated-flyer" style={{ transform: `scale(${previewZoom / 100})` }}>
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
                      <div className="placeholder-subtitle">THIS IS MORE FOR &gt; JUST A FITNESS PLACE IT'S NOT WORLD PLACE<br/>FULL OF VITALITY AND PASSION</div>
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
              <button 
                className="download-button"
                onClick={handleDownload}
              >
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
