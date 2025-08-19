import React from 'react';
import FlyerDistributionCard from '../../components/Flyer/FlyerDistributionCard';
import './Flyer.css';

const Flyer = () => {
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
    </div>
  );
};

export default Flyer;
