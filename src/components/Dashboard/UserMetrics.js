import React from 'react';
import './UserMetrics.css';

const UserMetrics = ({ totalInteracted, avgBrowseRate }) => {
  return (
    <div className="user-metrics">
      <div className="metrics-header">
        <h3 className="metrics-title">Total Interacted Users</h3>
      </div>
      
      <div className="user-count">
        <span className="count">{totalInteracted ? totalInteracted.toLocaleString() : '0'}</span>
        <span className="growth positive">-</span>
      </div>
      
      <div className="metrics-breakdown">
        <div className="metric-item">
          <div className="metric-value">{avgBrowseRate ? `${avgBrowseRate}%` : '-'}</div>
          <div className="metric-label">Browsed</div>
        </div>
        <div className="metric-item">
          <div className="metric-value">-</div>
          <div className="metric-label">Downloaded</div>
        </div>
        <div className="metric-item">
          <div className="metric-value">-</div>
          <div className="metric-label">Converted</div>
        </div>
      </div>
    </div>
  );
};

export default UserMetrics;
