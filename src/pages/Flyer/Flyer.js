import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import FlyerDistributionCard from '../../components/Flyer/FlyerDistributionCard';
import './Flyer.css';

const Flyer = () => {
  const [showBanner, setShowBanner] = useState(false);

  const location = useLocation();
  const successMessage = location.state?.success ? (location.state?.message || 'Flyer created successfully!') : null;

  useEffect(() => {
    if (successMessage) {
      setShowBanner(true);
      const timer = setTimeout(() => setShowBanner(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const flyerTypes = [
    {
      id: 1,
      title: 'Distribute Your Leaflet',
      subtitle: 'Read to Earn',
      icon: 'leaflet',
      primaryButton: 'Create by FlyerGenie',
      secondaryButton: 'Direct Upload',
      primaryRoute: '/flyer/create/leaflet',
      isPrimary: true
    },
    {
      id: 2,
      title: 'Build Your Survey',
      subtitle: 'Survey to Earn',
      icon: 'survey',
      primaryButton: 'Select',
      primaryRoute: '/flyer/create/query',
      isPrimary: false
    },
    {
      id: 3,
      title: 'Create QR Code',
      subtitle: 'Survey to Earn',
      icon: 'qr',
      primaryButton: 'Select',
      primaryRoute: '/flyer/create/qr',
      isPrimary: false
    }
  ];

  return (
    <div className="flyer">
      <div className="flyer-header">
        <h1 className="flyer-title">Types of Flyer Distribution</h1>
      </div>
      <div className="flyer-distribution-grid">
        {flyerTypes.map((type) => (
          <FlyerDistributionCard
            key={type.id}
            title={type.title}
            subtitle={type.subtitle}
            icon={type.icon}
            primaryButton={type.primaryButton}
            secondaryButton={type.secondaryButton}
            primaryRoute={type.primaryRoute}
            isPrimary={type.isPrimary}
          />
        ))}
      </div>
      {showBanner && (
        <div className="flyer-success-banner">
          {successMessage}
        </div>
      )}
    </div>
  );
};

export default Flyer;
