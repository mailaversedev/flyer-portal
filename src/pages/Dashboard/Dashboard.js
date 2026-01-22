import React, { useState, useEffect } from 'react';
import PromotionalBanner from '../../components/Dashboard/PromotionalBanner';
import BudgetCard from '../../components/Dashboard/BudgetCard';
import PerformanceStats from '../../components/Dashboard/PerformanceStats';
import CarbonFootprint from '../../components/Dashboard/CarbonFootprint';
import CampaignTable from '../../components/Dashboard/CampaignTable';
import ApiService from '../../services/ApiService';
import './Dashboard.css';

const Dashboard = () => {
  const [campaignData, setCampaignData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalBudget: 0,
    avgBrowseRate: 0,
  });

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      
      // Get companyId from localStorage
      let companyId = null;
      try {
        const companyStr = localStorage.getItem('company');
        if (companyStr) {
          companyId = JSON.parse(companyStr)?.id;
        }
      } catch (e) {
        console.warn('Failed to parse company info', e);
      }

      const response = await ApiService.getFlyers(100, null, 'createdAt', 'desc', companyId);
      if (response.success) {
        // Transform API data to table format
        let totalBudget = 0;
        let totalBrowseRate = 0;
        let totalInteracted = 0;
        let count = 0;

        const formattedData = response.data.map(flyer => {
          const lottery = flyer.lottery || {};
          
          if (lottery.pool) {
            totalBudget += (lottery.pool - (lottery.remaining || 0));
          }

          if (lottery.claims) {
            totalInteracted += lottery.claims;
          }

          let browseRateVal = 0;
          if (lottery.maxUsers && lottery.maxUsers > 1) {
             browseRateVal = (lottery.claims / (lottery.maxUsers - 1)) * 100;
             totalBrowseRate += browseRateVal;
             count++;
          }

          return {
            id: flyer.id,
            thumbnail: flyer?.coverPhoto || '📄',
            adTitle: flyer.header || `Promotion ${flyer.id.substr(0, 6)}`,
            status: flyer.status === 'active' ? 'Live' : 'Completed', 
            adType: flyer.type.charAt(0).toUpperCase() + flyer.type.slice(1),
            totalReached: lottery.claims || 0,
            browseRate: browseRateVal > 0 ? browseRateVal.toFixed(2) + '%' : '-',
            totalBudget: lottery.pool ? `HK$${lottery.pool.toFixed(2)}` : '-',
            remainingPool: lottery.remaining ? `HK$${lottery.remaining.toFixed(2)}` : '-',
            costPerBrowse: '-', 
            downloadRate: '-', 
            convertedRate: '-' 
          };
        });

        setMetrics({
          totalBudget,
          avgBrowseRate: count > 0 ? (totalBrowseRate / count).toFixed(2) : 0,
          totalInteracted
        });

        setCampaignData(formattedData);
      }
    } catch (error) {
      console.error("Failed to fetch campaigns", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard">
      <PromotionalBanner />
      
      <div className="dashboard-grid">
        <div className="left-column">
          <BudgetCard metrics={metrics} />
          <PerformanceStats statsData={metrics} />
        </div>
        
        <div className="middle-column">
          <CarbonFootprint />
        </div>
      </div>
      
      <div className="dashboard-table">
        <CampaignTable campaignData={campaignData} loading={loading} />
      </div>
    </div>
  );
};

export default Dashboard;
