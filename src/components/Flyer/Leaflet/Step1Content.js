import React, { useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import './Step1Content.css';

const Step1Content = ({ onNext }) => {
  const [formData, setFormData] = useState({
    aspectRatio: '',
    adType: '',
    referenceFlyer: null,
    designStyle: '',
    themeColor: '',
    backgroundPhoto: null,
    header: '',
    subheader: '',
    adContent: '',
    flyerPrompts: '',
    promotionMessage: '',
    productPhoto: null,
    productDescriptions: '',
    tags: []
  });

  const [newTag, setNewTag] = useState('');

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleFileUpload = (field) => {
    // Handle file upload logic
    console.log(`Uploading file for ${field}`);
  };

  return (
    <div className="step1-content">
      <div className="form-grid">
        {/* Aspect Ratio */}
        <div className="form-group">
          <label className="form-label">
            Aspect Ratio* 
            <span className="ratio-options">1:1 4:5 9:16</span>
          </label>
          <div className="select-wrapper">
            <select 
              className="form-select"
              value={formData.aspectRatio}
              onChange={(e) => handleInputChange('aspectRatio', e.target.value)}
            >
              <option value="">Please select</option>
              <option value="1:1">1:1</option>
              <option value="4:5">4:5</option>
              <option value="9:16">9:16</option>
            </select>
            <ChevronRight className="select-icon" size={16} />
          </div>
        </div>

        {/* Select Ad Type */}
        <div className="form-group">
          <label className="form-label">Select Ad Type*</label>
          <div className="select-wrapper">
            <select 
              className="form-select"
              value={formData.adType}
              onChange={(e) => handleInputChange('adType', e.target.value)}
            >
              <option value="">Please select</option>
              <option value="promotional">Promotional</option>
              <option value="informational">Informational</option>
              <option value="event">Event</option>
            </select>
            <ChevronRight className="select-icon" size={16} />
          </div>
        </div>

        {/* Upload Reference Flyer Photo */}
        <div className="form-group full-width">
          <label className="form-label">Upload Reference Flyer Photo (optional)</label>
          <div className="upload-area" onClick={() => handleFileUpload('referenceFlyer')}>
            <Plus size={24} />
          </div>
        </div>

        {/* Select Design Style */}
        <div className="form-group">
          <label className="form-label">Select Design Style (optional)</label>
          <div className="select-wrapper">
            <select 
              className="form-select"
              value={formData.designStyle}
              onChange={(e) => handleInputChange('designStyle', e.target.value)}
            >
              <option value="">Please select</option>
              <option value="modern">Modern</option>
              <option value="classic">Classic</option>
              <option value="minimalist">Minimalist</option>
            </select>
            <ChevronRight className="select-icon" size={16} />
          </div>
        </div>

        {/* Select Theme Colour */}
        <div className="form-group">
          <label className="form-label">Select Theme Colour (optional)</label>
          <div className="select-wrapper">
            <select 
              className="form-select"
              value={formData.themeColor}
              onChange={(e) => handleInputChange('themeColor', e.target.value)}
            >
              <option value="">Please select</option>
              <option value="blue">Blue</option>
              <option value="red">Red</option>
              <option value="green">Green</option>
            </select>
            <ChevronRight className="select-icon" size={16} />
          </div>
        </div>

        {/* Upload Background Photo */}
        <div className="form-group full-width">
          <label className="form-label">Upload Background Photo (optional)</label>
          <div className="file-select" onClick={() => handleFileUpload('backgroundPhoto')}>
            <span>Select file</span>
            <ChevronRight size={16} />
          </div>
        </div>
      </div>

      {/* Input Your Customised Content */}
      <div className="content-section">
        <h3 className="section-title">Input Your Customised Content</h3>
        
        <div className="form-grid">
          {/* Header */}
          <div className="form-group">
            <label className="form-label">Header*</label>
            <input
              type="text"
              className="form-input"
              placeholder="Please enter"
              value={formData.header}
              onChange={(e) => handleInputChange('header', e.target.value)}
            />
          </div>

          {/* Subheader */}
          <div className="form-group">
            <label className="form-label">Subheader</label>
            <input
              type="text"
              className="form-input"
              placeholder="Please enter"
              value={formData.subheader}
              onChange={(e) => handleInputChange('subheader', e.target.value)}
            />
          </div>

          {/* Ad Content */}
          <div className="form-group full-width">
            <label className="form-label">Ad Content*</label>
            <textarea
              className="form-textarea"
              placeholder="Please enter the promotional content/message"
              rows={4}
              value={formData.adContent}
              onChange={(e) => handleInputChange('adContent', e.target.value)}
            />
          </div>

          {/* Prompts of Your Flyer */}
          <div className="form-group full-width">
            <label className="form-label">Prompts of Your Flyer*</label>
            <textarea
              className="form-textarea"
              placeholder="Please describe the design, content & message of the flyer"
              rows={6}
              value={formData.flyerPrompts}
              onChange={(e) => handleInputChange('flyerPrompts', e.target.value)}
            />
          </div>

          {/* Promotion Message/Slogan */}
          <div className="form-group full-width">
            <label className="form-label">Promotion Message/Slogan (optional)</label>
            <textarea
              className="form-textarea"
              placeholder="Please enter"
              rows={3}
              value={formData.promotionMessage}
              onChange={(e) => handleInputChange('promotionMessage', e.target.value)}
            />
          </div>

          {/* Upload Product Photo */}
          <div className="form-group full-width">
            <label className="form-label">Upload Product Photo (optional) <span className="counter">0/5</span></label>
            <div className="file-select" onClick={() => handleFileUpload('productPhoto')}>
              <span>Select file</span>
              <ChevronRight size={16} />
            </div>
          </div>

          {/* Product Descriptions */}
          <div className="form-group full-width">
            <label className="form-label">Product Descriptions (optional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Please enter"
              value={formData.productDescriptions}
              onChange={(e) => handleInputChange('productDescriptions', e.target.value)}
            />
          </div>

          {/* Tag */}
          <div className="form-group">
            <label className="form-label">Tag (optional, max 3)</label>
            <div className="tag-input-container">
              <div className="tag-input">
                <span className="hash">#</span>
                <input
                  type="text"
                  placeholder="Please enter"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                />
              </div>
              {formData.tags.length > 0 && (
                <div className="tags-display">
                  {formData.tags.map((tag, index) => (
                    <span key={index} className="tag">
                      #{tag}
                      <button 
                        type="button" 
                        className="tag-remove"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step1Content;
