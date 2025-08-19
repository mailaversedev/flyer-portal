import React from 'react';
import PromotionalBanner from '../../components/Dashboard/PromotionalBanner';
import BudgetCard from '../../components/Dashboard/BudgetCard';
import PerformanceStats from '../../components/Dashboard/PerformanceStats';
import CarbonFootprint from '../../components/Dashboard/CarbonFootprint';
import CampaignTable from '../../components/Dashboard/CampaignTable';
import './Dashboard.css';

const Dashboard = () => {
  return (
    <div className="dashboard">
      <PromotionalBanner />
      
      <div className="dashboard-grid">
        <div className="left-column">
          <BudgetCard />
          <PerformanceStats />
        </div>
        
        <div className="middle-column">
          <CarbonFootprint />
        </div>
      </div>
      
      <div className="dashboard-table">
        <CampaignTable />
      </div>
    </div>
  );
};

export default Dashboard;
