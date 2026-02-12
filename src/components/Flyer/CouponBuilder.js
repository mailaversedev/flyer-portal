import React, { useState } from 'react';
import { Upload, Calendar, X } from 'lucide-react';
import './CouponBuilder.css';

const DigitalCoupon = ({ companyIcon, value, description, expire, couponType }) => {
  const renderCouponValue = () => {
    if (couponType === 'fixed') {
      return (
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span style={{ color: 'black', fontSize: '26px', lineHeight: '1.2', fontWeight: 'bold' }}>$</span>
          <span style={{ color: 'black', fontSize: '45px', lineHeight: '1', fontWeight: 'bold', marginLeft: '4px' }}>{value}</span>
        </div>
      );
    } else if (couponType === 'buy_one_get_one') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <span style={{ color: 'black', fontSize: '26px', lineHeight: '1', fontWeight: 'bold' }}>BUY 1 GET 1 FREE</span>
        </div>
      );
    } else {
      return (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ color: 'black', fontSize: '45px', lineHeight: '1', fontWeight: 'bold' }}>
            {couponType === 'free' ? description : value}
          </span>
          {couponType === 'percentage' && (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginLeft: '4px' }}>
              <span style={{ color: 'black', fontSize: '25px', lineHeight: '0.9' }}>%</span>
              <span style={{ color: 'black', fontSize: '14px' }}>OFF</span>
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <div className="digital-coupon-preview" style={{
      width: '100%',
      height: '120px',
      backgroundColor: 'white',
      borderRadius: '16px',
      display: 'flex',
      overflow: 'hidden',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      marginTop: '20px'
    }}>
      {/* Left side with logo */}
      <div style={{ 
        width: '100px', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '15px 5px 5px 15px',
        borderRight: '2px dashed #e5e5e5',
        position: 'relative'
      }}>
        {/* Semi-circles for dashed line effect */}
        <div style={{ position: 'absolute', top: -10, right: -10, width: 20, height: 20, borderRadius: '50%', backgroundColor: '#1e2433' }}></div>
        <div style={{ position: 'absolute', bottom: -10, right: -10, width: 20, height: 20, borderRadius: '50%', backgroundColor: '#1e2433' }}></div>
        
        {companyIcon ? (
           <img 
            src={companyIcon} 
            alt="Company Logo" 
            style={{ width: '40px', height: '40px', objectFit: 'contain' }} 
            onError={(e) => { e.target.onerror = null; e.target.src = 'placeholder-icon-url'; }} // Add placeholder handling
          />
        ) : (
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <span style={{ fontSize: '20px', color: '#999' }}>Store</span>
          </div>
        )}
      </div>

      {/* Right side with details */}
      <div style={{ 
        flex: 1, 
        padding: '12px 16px', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center',
        alignItems: 'flex-start'
      }}>
        {renderCouponValue()}
        
        <div style={{ 
          color: 'rgba(0,0,0,0.54)', 
          margin: '8px 0', 
          fontSize: '14px', 
          fontWeight: '500', 
          lineHeight: '1.2' 
        }}>
          {couponType === 'free' ? 'YOUR ENTIRE PURCHASE' : description || 'Item Description'}
        </div>
        
        <div style={{ color: 'rgba(0,0,0,0.38)', fontSize: '12px' }}>
          Offer valid until {expire || 'YYYY-MM-DD'}
        </div>
      </div>
    </div>
  );
};

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
      <div className="coupon-layout" style={{ display: 'flex', gap: '40px', alignItems: 'flex-start' }}>
        <div className="coupon-form" style={{ flex: 1 }}>
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

        {/* Right Side - Preview */}
        <div className="coupon-preview-container" style={{ width: '380px', flexShrink: 0 }}>
            <div className="form-group">
                <div style={{ 
                  padding: '20px', 
                  backgroundColor: '#1E1E1E', 
                  borderRadius: '20px',
                  border: '1px solid #333' 
                }}>
                  <DigitalCoupon
                      companyIcon={data?.companyIcon || ''}
                      value={formData.discountValue}
                      description={formData.itemDescription}
                      expire={formData.expiredDate}
                      couponType={formData.couponType}
                  />
                  <div style={{ textAlign: 'center', color: '#666', marginTop: '10px', fontSize: '12px' }}>
                    Mobile View
                  </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CouponBuilder;
