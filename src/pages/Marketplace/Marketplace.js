import React, { useState } from 'react';
import CarbonDonationCard from '../../components/Marketplace/CarbonDonationCard';
import './Marketplace.css';

const Marketplace = () => {
  const [activeTab, setActiveTab] = useState('latest');

  const carbonProjects = [
    {
      id: 1,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 2,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 3,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: true
    },
    {
      id: 4,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 5,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 6,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    // Second row
    {
      id: 7,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 8,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 9,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 10,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 11,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 12,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    // Third row
    {
      id: 13,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 14,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 15,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 16,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 17,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 18,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    // Fourth row
    {
      id: 19,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 20,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 21,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 22,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 23,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    },
    {
      id: 24,
      carbonAmount: '0.12',
      unit: 'KgCO2',
      donationAmount: 'HKD 12.09',
      isVerified: false
    }
  ];

  return (
    <div className="marketplace">
      <div className="marketplace-header">
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${activeTab === 'latest' ? 'active' : ''}`}
            onClick={() => setActiveTab('latest')}
          >
            Latest
          </button>
          <button 
            className={`filter-tab ${activeTab === 'lowest-cost' ? 'active' : ''}`}
            onClick={() => setActiveTab('lowest-cost')}
          >
            Lowest Cost
          </button>
          <button 
            className={`filter-tab ${activeTab === 'highest-cost' ? 'active' : ''}`}
            onClick={() => setActiveTab('highest-cost')}
          >
            Highest Cost
          </button>
        </div>
        
        <button className="donation-button">
          Donation
        </button>
      </div>
      
      <div className="carbon-grid">
        {carbonProjects.map((project) => (
          <CarbonDonationCard
            key={project.id}
            carbonAmount={project.carbonAmount}
            unit={project.unit}
            donationAmount={project.donationAmount}
            isVerified={project.isVerified}
          />
        ))}
      </div>
    </div>
  );
};

export default Marketplace;
