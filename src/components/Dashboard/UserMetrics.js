import React from 'react';
import './UserMetrics.css';

const UserMetrics = () => {
  return (
    <div className="user-metrics">
      <div className="metrics-header">
        <h3 className="metrics-title">Total Interacted Users</h3>
      </div>
      
      <div className="user-count">
        <span className="count">29,322</span>
        <span className="growth positive">+133.14%</span>
      </div>
      
      <div className="metrics-breakdown">
        <div className="metric-item">
          <div className="metric-value">85.6%</div>
          <div className="metric-label">Browsed</div>
        </div>
        <div className="metric-item">
          <div className="metric-value">30.3%</div>
          <div className="metric-label">Downloaded</div>
        </div>
        <div className="metric-item">
          <div className="metric-value">15.9%</div>
          <div className="metric-label">Converted</div>
        </div>
      </div>
    </div>
  );
};

export default UserMetrics;
