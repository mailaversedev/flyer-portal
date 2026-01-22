import React from 'react';
import { Recycle } from 'lucide-react';
import './CarbonFootprint.css';
import { useNavigate } from 'react-router';

const CarbonFootprint = ({ metrics }) => {
  const navigate = useNavigate();
  const counts = metrics?.typeCounts || {};

  return (
    <div className="carbon-footprint">
      <div className="carbon-header">
        <h3 className="carbon-title">Your Carbon Footprint</h3>
        <div className="contribution-tabs">
          <button
            className="active tab"
            onClick={() => navigate('/marketplace')}
          >
            Marketplace
          </button>
        </div>
      </div>
      
      <div className="carbon-visual">
        <div className="carbon-circle">
          <div className="carbon-icon">
            <Recycle size={32} />
          </div>
          <div className="carbon-value">-111,042.16</div>
          <div className="carbon-unit">KgCO2</div>
        </div>
        <div className="carbon-arc">
          <svg width="200" height="120" viewBox="0 0 200 120">
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#4b5563"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M 20 100 A 80 80 0 0 1 140 30"
              fill="none"
              stroke="#10b981"
              strokeWidth="8"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
      
      <div className="carbon-metrics">
        <div className="carbon-metric">
          <span className="metric-label">Read To Earn</span>
          <span className="metric-value">{counts.leaflet || 0}</span>
        </div>
        <div className="carbon-metric">
          <span className="metric-label">Survey To Earn</span>
          <span className="metric-value">{counts.survey || 0}</span>
        </div>
        <div className="carbon-metric">
          <span className="metric-label">Scan To Earn</span>
          <span className="metric-value">{counts.coupon || 0}</span>
        </div>
      </div>
    </div>
  );
};

export default CarbonFootprint;
