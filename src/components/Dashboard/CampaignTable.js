import React, { useState } from 'react';
import './CampaignTable.css';

const CampaignTable = () => {
  const [activeTab, setActiveTab] = useState('Read to Earn');
  
  const tabs = ['Read to Earn', 'Survey to Earn', 'Scan to Earn'];
  
  const campaignData = [
    {
      id: 3,
      thumbnail: '🔥',
      adTitle: '[Free 1 Hour] New Welcome...',
      status: 'Live',
      adType: 'Read',
      totalReached: '12285',
      browseRate: '90.1%',
      totalBudget: 'HK$5000.00',
      remainingPool: 'HK$251.50',
      costPerBrowse: 'HK$0.43',
      downloadRate: '22.6%',
      convertedRate: '7.5%'
    },
    {
      id: 2,
      thumbnail: '🏮',
      adTitle: '[新年優惠990/ HKBK人造肉炒餐]',
      status: 'Completed',
      adType: 'Read',
      totalReached: '12285',
      browseRate: '90.1%',
      totalBudget: 'HK$5000.00',
      remainingPool: 'HK$251.50',
      costPerBrowse: 'HK$0.43',
      downloadRate: '22.6%',
      convertedRate: '7.5%'
    }
  ];

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
            {campaignData.map((campaign) => (
              <tr key={campaign.id}>
                <td>
                  <div className="campaign-thumbnail">
                    <span className="thumbnail-id">{campaign.id}</span>
                    <span className="thumbnail-emoji">{campaign.thumbnail}</span>
                  </div>
                </td>
                <td className="ad-title">{campaign.adTitle}</td>
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
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CampaignTable;
