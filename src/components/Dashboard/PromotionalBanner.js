import React from 'react';
import { useNavigate } from 'react-router';
import { Play } from 'lucide-react';
import './PromotionalBanner.css';

const PromotionalBanner = () => {
  const navigate = useNavigate();

  return (
    <div className="promotional-banner">
      <div className="banner-content">
        <h2 className="banner-title">Create promotional flyers</h2>
        <p className="banner-subtitle">
          Our FlyerGenie AI helps create ads and digital coupons in minutes
        </p>
      </div>
      <button className="start-button" onClick={() => navigate('/flyer')}>
        <Play size={16} fill="currentColor" />
        Start
      </button>
    </div>
  );
};

export default PromotionalBanner;
