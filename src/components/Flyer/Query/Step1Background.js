import React, { useState } from 'react';
import { Upload, Plus, X } from 'lucide-react';
import './Step1Background.css';

const Step1Background = ({ data, onUpdate }) => {
  const [formData, setFormData] = useState({
    coverPhoto: data.coverPhoto || null,
    adCategory: data.adCategory || '',
    header: data.header || '',
    content: data.content || '',
    tags: data.tags || [],
    ...data
  });

  const [newTag, setNewTag] = useState('');

  const handleInputChange = (field, value) => {
    const updatedData = {
      ...formData,
      [field]: value
    };
    setFormData(updatedData);
    onUpdate(updatedData);
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

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      const updatedTags = [...formData.tags, newTag.trim()];
      handleInputChange('tags', updatedTags);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    const updatedTags = formData.tags.filter(tag => tag !== tagToRemove);
    handleInputChange('tags', updatedTags);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const adCategories = [
    'Electronics',
    'Fashion',
    'Home & Garden',
    'Sports & Outdoors',
    'Books & Media',
    'Automotive',
    'Health & Beauty',
    'Food & Beverage',
    'Travel & Tourism',
    'Services',
    'Real Estate',
    'Education',
    'Technology',
    'Entertainment'
  ];

  return (
    <div className="step1-background">
      <div className="background-layout">
        {/* Left Side - Form */}
        <div className="background-form">
          <div className="form-section">
            <h2 className="section-title">Background Information</h2>
            
            {/* Cover Photo Upload */}
            <div className="form-group">
              <label className="form-label">Cover Photo</label>
              <div className="upload-area">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="file-input"
                  id="cover-upload"
                />
                <label htmlFor="cover-upload" className="upload-label">
                  <Upload size={24} />
                  <span>Click to upload cover photo</span>
                  <span className="upload-hint">PNG, JPG up to 10MB</span>
                </label>
              </div>
            </div>

            {/* Ad Category */}
            <div className="form-group">
              <label className="form-label">Ad Category</label>
              <div className="select-wrapper">
                <select
                  value={formData.adCategory}
                  onChange={(e) => handleInputChange('adCategory', e.target.value)}
                  className="form-select"
                >
                  <option value="">Select a category</option>
                  {adCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Header */}
            <div className="form-group">
              <label className="form-label">Header</label>
              <textarea
                value={formData.header}
                onChange={(e) => handleInputChange('header', e.target.value)}
                placeholder="Enter your ad header..."
                className="form-textarea header-input"
                rows={3}
              />
            </div>

            {/* Content */}
            <div className="form-group">
              <label className="form-label">Content</label>
              <textarea
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                placeholder="Enter your ad content..."
                className="form-textarea content-input"
                rows={6}
              />
            </div>

            {/* Tags */}
            <div className="form-group">
              <label className="form-label">Tags</label>
              <div className="tags-input-container">
                <div className="tag-input-wrapper">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Add a tag..."
                    className="tag-input"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="add-tag-btn"
                    disabled={!newTag.trim()}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                
                {formData.tags.length > 0 && (
                  <div className="tags-list">
                    {formData.tags.map((tag, index) => (
                      <span key={index} className="tag-item">
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="remove-tag-btn"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Preview */}
        <div className="preview-panel">
          <div className="preview-container">
            <h3 className="preview-title">Preview</h3>
            <div className="preview-content">
              <div className="preview-ad">
                {/* Cover Photo Preview */}
                <div className="preview-cover">
                  {formData.coverPhoto ? (
                    <img 
                      src={formData.coverPhoto} 
                      alt="Cover preview" 
                      className="cover-image"
                    />
                  ) : (
                    <div className="cover-placeholder">
                      <Upload size={48} />
                      <span>No cover photo uploaded</span>
                    </div>
                  )}
                </div>

                {/* Category Badge */}
                {formData.adCategory && (
                  <div className="category-badge">
                    {formData.adCategory}
                  </div>
                )}

                {/* Header Preview */}
                {formData.header && (
                  <h4 className="preview-header">
                    {formData.header}
                  </h4>
                )}

                {/* Content Preview */}
                {formData.content && (
                  <p className="preview-text">
                    {formData.content}
                  </p>
                )}

                {/* Tags Preview */}
                {formData.tags.length > 0 && (
                  <div className="preview-tags">
                    {formData.tags.map((tag, index) => (
                      <span key={index} className="preview-tag">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step1Background;
