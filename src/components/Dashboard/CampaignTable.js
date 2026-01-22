import React, { useState } from 'react';
import './CampaignTable.css';

const CampaignTable = ({ campaignData, loading }) => {
  const [activeTab, setActiveTab] = useState('Read to Earn');

  const tabs = ['Read to Earn', 'Survey to Earn', 'Scan to Earn'];

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
                    {campaign.thumbnail && campaign.thumbnail.startsWith('http') ? (
                      <img src={campaign.thumbnail} alt="thumb" className="thumbnail-img" style={{width: 32, height: 32, borderRadius: 4, objectFit: 'cover'}} />
                    ) : (
                      <span className="thumbnail-placeholder">{'📄'}</span>
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
