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
    productPhoto: [],
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
          setFormData(prev => ({
            ...prev,
            [field]: [...prev[field], ...fileObjects]
          }));
        });
      } else {
        // Handle single file for reference flyer and background photo
        const file = files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            setFormData(prev => ({
              ...prev,
              [field]: {
                file,
                name: file.name,
                size: file.size,
                preview: e.target.result
              }
            }));
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
      setFormData(prev => ({
        ...prev,
        [field]: prev[field].filter((_, i) => i !== index)
      }));
    } else {
      // Remove single image (reference flyer or background photo)
      setFormData(prev => ({
        ...prev,
        [field]: null
      }));
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

  const handleNext = () => {
    // Pass the current form data to the parent component
    onNext(formData);
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
          {formData.referenceFlyer ? (
            <SingleImageDisplay 
              imageObj={formData.referenceFlyer} 
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
                      setFormData(prev => ({
                        ...prev,
                        referenceFlyer: {
                          file,
                          name: file.name,
                          size: file.size,
                          preview: event.target.result
                        }
                      }));
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
          {formData.backgroundPhoto ? (
            <SingleImageDisplay 
              imageObj={formData.backgroundPhoto} 
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
                      setFormData(prev => ({
                        ...prev,
                        backgroundPhoto: {
                          file,
                          name: file.name,
                          size: file.size,
                          preview: event.target.result
                        }
                      }));
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
            <label className="form-label">Upload Product Photo (optional) <span className="counter">{formData.productPhoto.length}/5</span></label>
            <div className="file-select" onClick={() => handleFileUpload('productPhoto')}>
              <span>Select file</span>
              <ChevronRight size={16} />
            </div>
            <ThumbnailRow images={formData.productPhoto} field="productPhoto" />
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
