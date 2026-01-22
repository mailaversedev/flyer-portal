import React from 'react';
import './PerformanceStats.css';

const PerformanceStats = ({ statsData }) => {
  const stats = [
    {
      value: statsData ? `${statsData.avgBrowseRate}%` : '-',
      label: 'Avg Browse Rate',
      color: '#10b981'
    },
    {
      value: '-', // Not available yet
      label: 'Avg Download',
      color: '#3b82f6'
    },
    {
      value: '-', // Not available yet
      label: 'Avg Conversion',
      color: '#8b5cf6'
    },
    {
      value: '-', // Not available yet
      label: 'Cost per Browse (CPB)',
      color: '#f59e0b'
    }
  ];

  return (
    <div className="performance-stats">
      <h3 className="stats-title">Overall Statistic Performance:</h3>
      <div className="stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className="stat-card">
            <div 
              className="stat-value" 
              style={{ color: stat.color }}
            >
              {stat.value}
            </div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PerformanceStats;
