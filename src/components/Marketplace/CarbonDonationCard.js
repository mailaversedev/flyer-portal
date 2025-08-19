import React from 'react';
import { CheckCircle } from 'lucide-react';
import './CarbonDonationCard.css';

const CarbonDonationCard = ({ carbonAmount, unit, donationAmount, isVerified }) => {
  return (
    <div className="carbon-donation-card">
      <div className="card-background">
        {isVerified && (
          <div className="verification-badge">
            <CheckCircle size={16} />
          </div>
        )}
        
        <div className="carbon-info">
          <div className="carbon-amount">{carbonAmount}</div>
          <div className="carbon-unit">{unit}</div>
        </div>
        
        <button className="donate-button">
          DONATE {donationAmount}
        </button>
      </div>
    </div>
  );
};

export default CarbonDonationCard;
