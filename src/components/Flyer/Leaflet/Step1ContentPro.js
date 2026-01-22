import React, { useState, useImperativeHandle, forwardRef } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import './Step1Content.css';

const Step1ContentPro = forwardRef(({ data, onUpdate }, ref) => {
  const [newTag, setNewTag] = useState('');
  const [errors, setErrors] = useState({});

  const proAspectRatios = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
  const logoPositions = ["natural placement", "top-left", "top-right", "bottom-left", "bottom-right", "center"];

  const validateRequiredFields = () => {
    const newErrors = {};
    
    if (!data.aspectRatio || data.aspectRatio.trim() === '') {
      newErrors.aspectRatio = 'Aspect Ratio is required';
    }
    
    if (!data.productName || data.productName.trim() === '') {
      newErrors.productName = 'Product Name is required';
    }

    if (!data.header || data.header.trim() === '') {
      newErrors.header = 'Copy Line (Header) is required';
    }
    
    if (!data.adContent || data.adContent.trim() === '') {
      newErrors.adContent = 'Body Copy is required';
    }
    
    if (!data.flyerPrompts || data.flyerPrompts.trim() === '') {
      newErrors.flyerPrompts = 'Context/Prompts is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Expose validation function to parent via ref
  useImperativeHandle(ref, () => ({
    validateRequiredFields
  }));

  const handleInputChange = (field, value) => {
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
    
    if (field === 'productPhoto') {
      input.multiple = true;
    }
    
    input.onchange = (event) => {
      const files = Array.from(event.target.files);
      
      if (field === 'productPhoto') {
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
      const updatedData = {
        ...data,
        [field]: data[field].filter((_, i) => i !== index)
      };
      onUpdate(updatedData);
    } else {
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
        {/* Product Name - REQUIRED */}
        <div className="form-group full-width">
          <label className="form-label">Product Name*</label>
          <input
            type="text"
            className={`form-input ${errors.productName ? 'error' : ''}`}
            placeholder="e.g. NeonFizz Energy Drink"
            value={data.productName || ''}
            onChange={(e) => handleInputChange('productName', e.target.value)}
          />
          {errors.productName && <span className="error-message">{errors.productName}</span>}
        </div>

        {/* Aspect Ratio */}
        <div className="form-group">
          <label className="form-label">Aspect Ratio*</label>
          <div className="select-wrapper">
            <select 
              className={`form-select ${errors.aspectRatio ? 'error' : ''}`}
              value={data.aspectRatio}
              onChange={(e) => handleInputChange('aspectRatio', e.target.value)}
            >
              <option value="">Select Ratio</option>
              {proAspectRatios.map(ratio => (
                <option key={ratio} value={ratio}>{ratio}</option>
              ))}
            </select>
            <ChevronRight className="select-icon" size={16} />
          </div>
          {errors.aspectRatio && <span className="error-message">{errors.aspectRatio}</span>}
        </div>

        {/* Resolution */}
        <div className="form-group">
          <label className="form-label">Resolution</label>
          <div className="select-wrapper">
            <select 
              className="form-select"
              value={data.resolution || '2K'}
              onChange={(e) => handleInputChange('resolution', e.target.value)}
            >
              <option value="1K">1K</option>
              <option value="2K">2K</option>
              <option value="4K">4K</option>
            </select>
            <ChevronRight className="select-icon" size={16} />
          </div>
        </div>

        {/* Reference Image / Campaign Moodboard */}
        <div className="form-group full-width">
          <label className="form-label">Campaign Moodboard / Reference Image (optional)</label>
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
                id="referenceFlyerInputPro"
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
                onClick={() => document.getElementById('referenceFlyerInputPro').click()}
                tabIndex={0}
                role="button"
              >
                <Plus size={24} />
              </div>
            </>
          )}
        </div>

        {/* Brand & Styling Section */}
        <div className="form-group">
          <label className="form-label">Primary Color (Hex)</label>
           <input
            type="text"
            className="form-input"
            placeholder="#FFFFFF"
            value={data.primaryColor || ''}
            onChange={(e) => handleInputChange('primaryColor', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Secondary Color (Hex)</label>
           <input
            type="text"
            className="form-input"
            placeholder="#A1B2C3"
            value={data.secondaryColor || ''}
            onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Typography</label>
           <input
            type="text"
            className="form-input"
            placeholder="e.g. Sans-serif, Clean"
            value={data.typography || ''}
            onChange={(e) => handleInputChange('typography', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Brand Voice</label>
           <input
            type="text"
            className="form-input"
            placeholder="e.g. Edgy, Youthful"
            value={data.brandVoice || ''}
            onChange={(e) => handleInputChange('brandVoice', e.target.value)}
          />
        </div>
        
        {/* Upload Logo */}
        <div className="form-group full-width">
          <label className="form-label">Upload Logo (optional)</label>
          {data.logoImage ? (
             <SingleImageDisplay 
              imageObj={data.logoImage} 
              field="logoImage" 
              onRemove={handleRemoveImage}
            />
          ) : (
             <>
              <input
                type="file"
                style={{ display: 'none' }}
                id="logoImageInput"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      handleInputChange('logoImage', {
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
              <div className="file-select" onClick={() => document.getElementById('logoImageInput').click()}>
                <span>Select Logo file</span>
                <ChevronRight size={16} />
              </div>
             </>
          )}
        </div>

        {/* Logo Position */}
        <div className="form-group">
          <label className="form-label">Logo Position</label>
          <div className="select-wrapper">
            <select 
              className="form-select"
              value={data.logoPosition || 'natural placement'}
              onChange={(e) => handleInputChange('logoPosition', e.target.value)}
            >
              {logoPositions.map(pos => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
            <ChevronRight className="select-icon" size={16} />
          </div>
        </div>

      </div>

      <div className="content-section">
        <h3 className="section-title">Copy & Content</h3>
        
        <div className="form-grid">
           {/* Copy Line (Header) */}
          <div className="form-group full-width">
            <label className="form-label">Copy Line (Header)*</label>
            <input
              type="text"
              className={`form-input ${errors.header ? 'error' : ''}`}
              placeholder="e.g. Ignite the Night"
              value={data.header || ''}
              onChange={(e) => handleInputChange('header', e.target.value)}
            />
            {errors.header && <span className="error-message">{errors.header}</span>}
          </div>
          
           {/* Body Copy (Ad Content) */}
          <div className="form-group full-width">
            <label className="form-label">Body Copy (Ad Content)*</label>
            <textarea
              className={`form-textarea ${errors.adContent ? 'error' : ''}`}
              placeholder="Main advertising text..."
              rows={4}
              value={data.adContent || ''}
              onChange={(e) => handleInputChange('adContent', e.target.value)}
            />
            {errors.adContent && <span className="error-message">{errors.adContent}</span>}
          </div>

          {/* Query_Context / Flyer Prompts */}
          <div className="form-group full-width">
            <label className="form-label">Prompts / Query Context*</label>
            <textarea
              className={`form-textarea ${errors.flyerPrompts ? 'error' : ''}`}
              placeholder="Describe the context: e.g. a drink that is energizing and refreshing..."
              rows={6}
              value={data.flyerPrompts}
              onChange={(e) => handleInputChange('flyerPrompts', e.target.value)}
            />
            {errors.flyerPrompts && <span className="error-message">{errors.flyerPrompts}</span>}
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

export default Step1ContentPro;
