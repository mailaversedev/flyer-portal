import React, { useState, useEffect } from 'react';
import ApiService from '../../services/ApiService';
import './CampaignTable.css';

const CampaignTable = () => {
  const [activeTab, setActiveTab] = useState('Read to Earn');
  const [campaignData, setCampaignData] = useState([]);
  const [loading, setLoading] = useState(true);

  const tabs = ['Read to Earn', 'Survey to Earn', 'Scan to Earn'];

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
        const formattedData = response.data.map(flyer => {
          const lottery = flyer.lottery || {};

          return {
            id: flyer.id,
            thumbnail: flyer.data?.coverPhoto || '📄',
            adTitle: flyer.data?.header || `Promotion ${flyer.id.substr(0, 6)}`,
            status: flyer.status === 'active' ? 'Live' : 'Completed', // Map specific statuses if needed
            adType: flyer.type.charAt(0).toUpperCase() + flyer.type.slice(1),
            totalReached: lottery.claims || 0,
            browseRate: lottery.maxUsers ? ((lottery.claims / (lottery.maxUsers - 1)) * 100).toFixed(2) + '%' : '-',
            totalBudget: lottery.pool ? `HK$${lottery.pool.toFixed(2)}` : '-',
            remainingPool: lottery.remaining ? `HK$${lottery.remaining.toFixed(2)}` : '-',
            costPerBrowse: '-', // Not available yet
            downloadRate: '-', // Not available yet
            convertedRate: '-' // Not available yet
          };
        });
        setCampaignData(formattedData);
      }
    } catch (error) {
      console.error("Failed to fetch campaigns", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = campaignData.filter(campaign => {
    if (activeTab === 'Read to Earn') return campaign.adType === 'Leaflet';
    if (activeTab === 'Survey to Earn') return campaign.adType === 'Query';
    if (activeTab === 'Scan to Earn') return campaign.adType === 'Qr';
    return true;
  });

  return (
    <div className="campaign-table">
      <div className="table-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`table-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      
      <div className="table-container">
        {loading ? (
          <div className="table-loading">Loading campaigns...</div>
        ) : (
        <table className="campaigns-table">
          <thead>
            <tr>
              <th>Thumbnail</th>
              <th>Ad Title</th>
              <th>Status</th>
              <th>Ad Type</th>
              <th>Total Reached</th>
              <th>Browse Rate(%)</th>
              <th>Total Budget</th>
              <th>Remaining Pool</th>
              <th>Cost per Browse(CPB)</th>
              <th>Download (%)</th>
              <th>Converted (%)</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((campaign) => (
              <tr key={campaign.id}>
                <td>
                  <div className="campaign-thumbnail">
                    {/* <span className="thumbnail-id">{campaign.id.substr(0,4)}</span> */}
                    {campaign.coverPhoto.startsWith('http') ? (
                      <img src={campaign.coverPhoto} alt="thumb" className="thumbnail-img" style={{width: 32, height: 32, borderRadius: 4, objectFit: 'cover'}} />
                    ) : (
                      <span className="thumbnail-emoji">{campaign.coverPhoto}</span>
                    )}
                  </div>
                </td>
                <td className="ad-title" title={campaign.adTitle}>
                  {campaign.adTitle.length > 30 ? campaign.adTitle.substring(0, 30) + '...' : campaign.adTitle}
                </td>
                <td>
                  <span className={`status ${campaign.status.toLowerCase()}`}>
                    {campaign.status}
                  </span>
                </td>
                <td>{campaign.adType}</td>
                <td>{campaign.totalReached}</td>
                <td>{campaign.browseRate}</td>
                <td>{campaign.totalBudget}</td>
                <td>{campaign.remainingPool}</td>
                <td>{campaign.costPerBrowse}</td>
                <td>{campaign.downloadRate}</td>
                <td>{campaign.convertedRate}</td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan="11" style={{textAlign: 'center', padding: '20px'}}>No campaigns found</td>
              </tr>
            )}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
};

export default CampaignTable;
