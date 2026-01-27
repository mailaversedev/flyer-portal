import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import './Step1Content.css';

const Step1Content = forwardRef(({ data, onUpdate }, ref) => {
  const [newTag, setNewTag] = useState('');
  const [errors, setErrors] = useState({});

  const validateRequiredFields = () => {
    const newErrors = {};
    
    if (!data.aspectRatio || data.aspectRatio.trim() === '') {
      newErrors.aspectRatio = 'Aspect Ratio is required';
    }
    
    if (!data.adType || data.adType.trim() === '') {
      newErrors.adType = 'Ad Type is required';
    }
    
    if (!data.header || data.header.trim() === '') {
      newErrors.header = 'Header is required';
    }
    
    if (!data.adContent || data.adContent.trim() === '') {
      newErrors.adContent = 'Ad Content is required';
    }
    
    if (!data.flyerPrompts || data.flyerPrompts.trim() === '') {
      newErrors.flyerPrompts = 'Flyer Prompts is required';
    }

    if (!data.promotionMessage || data.promotionMessage.trim() === '') {
      newErrors.promotionMessage = 'Promotion Message/Slogan is required';
    }

    if (!data.productDescriptions || data.productDescriptions.trim() === '') {
      newErrors.productDescriptions = 'Product Descriptions is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Expose validation function to parent via ref
  useImperativeHandle(ref, () => ({
    validateRequiredFields
  }));

  const handleInputChange = (field, value) => {
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    
    const updatedData = {
      ...data,
      [field]: value
    };
    onUpdate(updatedData);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !data.tags.includes(newTag.trim())) {
      const updatedData = {
        ...data,
        tags: [...data.tags, newTag.trim()]
      };
      onUpdate(updatedData);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    const updatedData = {
      ...data,
      tags: data.tags.filter(tag => tag !== tagToRemove)
    };
    onUpdate(updatedData);
  };

  const handleFileUpload = (field) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    // Only product photos support multiple selection
    if (field === 'productPhoto') {
      input.multiple = true;
    }
    
    input.onchange = (event) => {
      const files = Array.from(event.target.files);
      
      if (field === 'productPhoto') {
        // Handle multiple files for product photos
        const filePromises = files.map(file => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve({
              file,
              name: file.name,
              size: file.size,
              preview: e.target.result
            });
            reader.readAsDataURL(file);
          });
        });
        
        Promise.all(filePromises).then(fileObjects => {
          const updatedData = {
            ...data,
            [field]: [...data[field], ...fileObjects]
          };
          onUpdate(updatedData);
        });
      } else {
        // Handle single file for reference flyer and background photo
        const file = files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const updatedData = {
              ...data,
              [field]: {
                file,
                name: file.name,
                size: file.size,
                preview: e.target.result
              }
            };
            onUpdate(updatedData);
          };
          reader.readAsDataURL(file);
        }
      }
    };
    input.click();
  };

  const handleRemoveImage = (field, index = null) => {
    if (field === 'productPhoto' && index !== null) {
      // Remove specific product photo
      const updatedData = {
        ...data,
        [field]: data[field].filter((_, i) => i !== index)
      };
      onUpdate(updatedData);
    } else {
      // Remove single image (reference flyer or background photo)
      const updatedData = {
        ...data,
        [field]: null
      };
      onUpdate(updatedData);
    }
  };

  const ThumbnailRow = ({ images, field }) => {
    if (!images || images.length === 0) return null;
    
    return (
      <div className="thumbnail-row">
        {images.map((imageObj, index) => (
          <div key={index} className="thumbnail-item">
            <img 
              src={imageObj.preview} 
              alt={imageObj.name} 
              className="thumbnail-image"
            />
            <button 
              type="button"
              className="thumbnail-remove"
              onClick={() => handleRemoveImage(field, index)}
            >
              ×
            </button>
            <div className="thumbnail-name">{imageObj.name}</div>
          </div>
        ))}
      </div>
    );
  };

  const SingleImageDisplay = ({ imageObj, field, onRemove }) => {
    if (!imageObj) return null;
    
    return (
      <div className="single-image-display">
        <img 
          src={imageObj.preview} 
          alt={imageObj.name} 
          className="single-image"
        />
        <button 
          type="button"
          className="single-image-remove"
          onClick={() => onRemove(field)}
        >
          ×
        </button>
        <div className="single-image-name">{imageObj.name}</div>
      </div>
    );
  };

  return (
    <div className="step1-content">
      <div className="form-grid">
        {/* Aspect Ratio */}
        <div className="form-group">
          <label className="form-label">
            Aspect Ratio* 
            <span className="ratio-options">1:1 3:4 9:16</span>
          </label>
          <div className="select-wrapper">
            <select 
              className={`form-select ${errors.aspectRatio ? 'error' : ''}`}
              value={data.aspectRatio}
              onChange={(e) => handleInputChange('aspectRatio', e.target.value)}
            >
              <option value="">Please select</option>
              <option value="1:1">1:1</option>
              <option value="3:4">3:4</option>
              <option value="9:16">9:16</option>
            </select>
            <ChevronRight className="select-icon" size={16} />
          </div>
          {errors.aspectRatio && <span className="error-message">{errors.aspectRatio}</span>}
        </div>

        {/* Select Ad Type */}
        <div className="form-group">
          <label className="form-label">Select Ad Type*</label>
          <div className="select-wrapper">
            <select 
              className={`form-select ${errors.adType ? 'error' : ''}`}
              value={data.adType}
              onChange={(e) => handleInputChange('adType', e.target.value)}
            >
              <option value="">Please select</option>
              <option value="promotional">Promotional</option>
              <option value="informational">Informational</option>
              <option value="event">Event</option>
            </select>
            <ChevronRight className="select-icon" size={16} />
          </div>
          {errors.adType && <span className="error-message">{errors.adType}</span>}
        </div>

        {/* Upload Reference Flyer Photo */}
        <div className="form-group full-width">
          <label className="form-label">Upload Reference Flyer Photo (optional)</label>
          {data.referenceFlyer ? (
            <SingleImageDisplay 
              imageObj={data.referenceFlyer} 
              field="referenceFlyer" 
              onRemove={handleRemoveImage}
            />
          ) : (
            <>
              <input
                type="file"
                style={{ display: 'none' }}
                id="referenceFlyerInput"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      handleInputChange('referenceFlyer', {
                        file,
                        name: file.name,
                        size: file.size,
                        preview: event.target.result
                      });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <div
                className="upload-area"
                onClick={() => document.getElementById('referenceFlyerInput').click()}
                tabIndex={0}
                role="button"
              >
                <Plus size={24} />
              </div>
            </>
          )}
        </div>

        {/* Select Design Style */}
        <div className="form-group">
          <label className="form-label">Select Design Style (optional)</label>
          <div className="select-wrapper">
            <select 
              className="form-select"
              value={data.designStyle}
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
              value={data.themeColor}
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
          {data.backgroundPhoto ? (
            <SingleImageDisplay 
              imageObj={data.backgroundPhoto} 
              field="backgroundPhoto" 
              onRemove={handleRemoveImage}
            />
          ) : (
            <>
              <input
                type="file"
                style={{ display: 'none' }}
                id="backgroundPhotoInput"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      handleInputChange('backgroundPhoto', {
                        file,
                        name: file.name,
                        size: file.size,
                        preview: event.target.result
                      });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <div
                className="upload-area"
                onClick={() => document.getElementById('backgroundPhotoInput').click()}
                tabIndex={0}
                role="button"
              >
                <Plus size={24} />
              </div>
            </>
          )}
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
              className={`form-input ${errors.header ? 'error' : ''}`}
              placeholder="Please enter"
              value={data.header}
              onChange={(e) => handleInputChange('header', e.target.value)}
            />
            {errors.header && <span className="error-message">{errors.header}</span>}
          </div>

          {/* Subheader */}
          <div className="form-group">
            <label className="form-label">Subheader</label>
            <input
              type="text"
              className="form-input"
              placeholder="Please enter"
              value={data.subheader}
              onChange={(e) => handleInputChange('subheader', e.target.value)}
            />
          </div>

          {/* Ad Content */}
          <div className="form-group full-width">
            <label className="form-label">Ad Content*</label>
            <textarea
              className={`form-textarea ${errors.adContent ? 'error' : ''}`}
              placeholder="Please enter the promotional content/message"
              rows={4}
              value={data.adContent}
              onChange={(e) => handleInputChange('adContent', e.target.value)}
            />
            {errors.adContent && <span className="error-message">{errors.adContent}</span>}
          </div>

          {/* Prompts of Your Flyer */}
          <div className="form-group full-width">
            <label className="form-label">Prompts of Your Flyer*</label>
            <textarea
              className={`form-textarea ${errors.flyerPrompts ? 'error' : ''}`}
              placeholder="Please describe the design, content & message of the flyer"
              rows={6}
              value={data.flyerPrompts}
              onChange={(e) => handleInputChange('flyerPrompts', e.target.value)}
            />
            {errors.flyerPrompts && <span className="error-message">{errors.flyerPrompts}</span>}
          </div>

          {/* Promotion Message/Slogan */}
          <div className="form-group full-width">
            <label className="form-label">Promotion Message/Slogan*</label>
            <textarea
              className={`form-textarea ${errors.promotionMessage ? 'error' : ''}`}
              placeholder="Please enter"
              rows={3}
              value={data.promotionMessage}
              onChange={(e) => handleInputChange('promotionMessage', e.target.value)}
            />
            {errors.promotionMessage && <span className="error-message">{errors.promotionMessage}</span>}
          </div>

          {/* Upload Product Photo */}
          <div className="form-group full-width">
            <label className="form-label">Upload Product Photo (optional) <span className="counter">{data.productPhoto.length}/5</span></label>
            <div className="file-select" onClick={() => handleFileUpload('productPhoto')}>
              <span>Select file</span>
              <ChevronRight size={16} />
            </div>
            <ThumbnailRow images={data.productPhoto} field="productPhoto" />
          </div>

          {/* Product Descriptions */}
          <div className="form-group full-width">
            <label className="form-label">Product Descriptions*</label>
            <input
              type="text"
              className={`form-input ${errors.productDescriptions ? 'error' : ''}`}
              placeholder="Please enter"
              value={data.productDescriptions}
              onChange={(e) => handleInputChange('productDescriptions', e.target.value)}
            />
            {errors.productDescriptions && <span className="error-message">{errors.productDescriptions}</span>}
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
              {data.tags.length > 0 && (
                <div className="tags-display">
                  {data.tags.map((tag, index) => (
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
});

// Export validation function for parent component to use (keeping for backward compatibility)
Step1Content.validateRequiredFields = (data, setErrorsCallback = null) => {
  const errors = {};
  
  if (!data.aspectRatio || data.aspectRatio.trim() === '') {
    errors.aspectRatio = 'Aspect Ratio is required';
  }
  
  if (!data.adType || data.adType.trim() === '') {
    errors.adType = 'Ad Type is required';
  }
  
  if (!data.header || data.header.trim() === '') {
    errors.header = 'Header is required';
  }
  
  if (!data.adContent || data.adContent.trim() === '') {
    errors.adContent = 'Ad Content is required';
  }
  
  if (!data.flyerPrompts || data.flyerPrompts.trim() === '') {
    errors.flyerPrompts = 'Flyer Prompts is required';
  }

  if (!data.promotionMessage || data.promotionMessage.trim() === '') {
    errors.promotionMessage = 'Promotion Message/Slogan is required';
  }

  if (!data.productDescriptions || data.productDescriptions.trim() === '') {
    errors.productDescriptions = 'Product Descriptions is required';
  }
  
  // Set errors in component state if callback provided
  if (setErrorsCallback) {
    setErrorsCallback(errors);
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export default Step1Content;
