import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { useNavigate } from 'react-router';
import './FlyerDistributionCard.css';

const FlyerDistributionCard = ({ 
  title, 
  subtitle, 
  icon, 
  primaryButton, 
  secondaryButton, 
  primaryRoute,
  isPrimary 
}) => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      // Create a file URL for the selected image
      const imageUrl = URL.createObjectURL(file);
      
      // Navigate to budget page with the selected image
      navigate('/flyer/create/leaflet', {
        state: {
          uploadedImage: imageUrl,
          fileName: file.name,
          fileSize: file.size,
          isDirectUpload: true
        }
      });
    }
  };

  const handleButtonClick = (buttonType) => {
    if (buttonType === 'primary' && primaryRoute) {
      navigate(primaryRoute);
    } else if (buttonType === 'secondary') {
      // For leaflet, trigger file selector
      if (icon === 'leaflet' && fileInputRef.current) {
        fileInputRef.current.click();
      } else {
        // Handle other secondary button actions
        console.log('Secondary button clicked');
      }
    }
  };

  const renderMockup = () => {
    switch (icon) {
      case 'leaflet':
        return (
          <div className="device-mockup leaflet-mockup">
            <div className="mockup-header">Leaflet Ad</div>
            <div className="mockup-content">
              <div className="content-line"></div>
              <div className="content-line"></div>
              <div className="content-line short"></div>
            </div>
          </div>
        );
      case 'survey':
        return (
          <div className="device-mockup survey-mockup">
            <div className="mockup-header">Questions</div>
            <div className="mockup-content">
              <div className="question-item">
                <div className="question-line"></div>
                <div className="question-line short"></div>
              </div>
              <div className="question-item">
                <div className="question-line"></div>
                <div className="question-line short"></div>
              </div>
              <div className="question-item">
                <div className="question-line"></div>
                <div className="question-line short"></div>
              </div>
            </div>
          </div>
        );
      case 'qr':
        return (
          <div className="device-mockup qr-mockup">
            <div className="qr-code">
              <div className="qr-pattern">
                <span>QR</span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flyer-distribution-card">
      {/* Hidden file input for direct upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/*"
        style={{ display: 'none' }}
      />
      
      <div className="card-header">
        <h3 className="card-title">{title}</h3>
        <p className="card-subtitle">{subtitle}</p>
      </div>
      
      <div className="card-visual">
        {renderMockup()}
      </div>
      
      <div className="card-actions">
        <button 
          className={`action-button ${isPrimary ? 'primary' : 'secondary'}`}
          onClick={() => handleButtonClick('primary')}
        >
          {primaryButton}
        </button>
        {secondaryButton && (
          <button 
            className="action-button secondary"
            onClick={() => handleButtonClick('secondary')}
          >
            <Upload size={16} />
            {secondaryButton}
          </button>
        )}
      </div>
    </div>
  );
};

export default FlyerDistributionCard;
