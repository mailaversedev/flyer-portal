import React, { useState } from 'react';
import { Upload, Calendar, X } from 'lucide-react';
import './CouponBuilder.css';

const CouponBuilder = ({ data, onUpdate }) => {
  const [formData, setFormData] = useState({
    couponType: data?.couponType || '',
    couponFile: data?.couponFile || null,
    termsConditions: data?.termsConditions || '',
    expiredDate: data?.expiredDate || '',
    discountValue: data?.discountValue || '',
    itemDescription: data?.itemDescription || '',
  });

  const handleInputChange = (field, value) => {
    const updatedData = {
      ...formData,
      [field]: value
    };
    setFormData(updatedData);
    if (onUpdate) {
      onUpdate(updatedData);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        handleInputChange('couponFile', e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="coupon-builder">
      <div className="coupon-layout">
        <div className="coupon-form">
          <h2 className="section-title">Coupon Builder</h2>
          
          <div className="form-section">
            <div className="form-group">
              <label className="form-label">Select Types of Coupon</label>
              <select 
                className="form-select"
                value={formData.couponType}
                onChange={(e) => handleInputChange('couponType', e.target.value)}
              >
                <option value="">Please select</option>
                <option value="percentage">Percentage Discount</option>
                <option value="fixed">Fixed Amount Discount</option>
                <option value="free">Free</option>
                <option value="buy_one_get_one">Buy One Get One Free</option>
              </select>
            </div>

            {(formData.couponType === 'percentage' || formData.couponType === 'fixed') && (
              <div className="form-group">
                <label className="form-label">
                  {formData.couponType === 'percentage' ? 'Discount Percentage (%)' : 'Discount Amount'}
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder={formData.couponType === 'percentage' ? "Enter percentage" : "Enter amount"}
                  value={formData.discountValue || ''}
                  onChange={(e) => handleInputChange('discountValue', e.target.value)}
                  disabled={!!formData.couponFile}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Item Description</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter item description"
                value={formData.itemDescription || ''}
                onChange={(e) => handleInputChange('itemDescription', e.target.value)}
                disabled={!!formData.couponFile}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Upload</label>
              <div className="upload-container">
                <input
                  type="file"
                  id="coupon-upload"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button 
                  className="upload-button"
                  onClick={() => document.getElementById('coupon-upload').click()}
                >
                  <span>{formData.couponFile ? 'File Selected' : 'Select file'}</span>
                  <Upload size={16} />
                </button>
                {formData.couponFile && (
                  <div className="preview-container">
                    <img src={formData.couponFile} alt="Preview" className="file-preview" />
                    <button 
                      className="remove-file"
                      onClick={() => handleInputChange('couponFile', null)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Terms & Conditions</label>
              <textarea
                className="form-textarea"
                placeholder="Please enter"
                value={formData.termsConditions}
                onChange={(e) => handleInputChange('termsConditions', e.target.value)}
                rows={5}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Expired Date</label>
              <div className="date-input-container">
                <input
                  type="date"
                  className="form-input date-input"
                  value={formData.expiredDate}
                  onChange={(e) => handleInputChange('expiredDate', e.target.value)}
                />
                <Calendar className="date-icon" size={20} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CouponBuilder;
