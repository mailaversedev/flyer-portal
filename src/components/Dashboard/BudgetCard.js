import React from 'react';
import { ChevronDown } from 'lucide-react';
import UserMetrics from './UserMetrics'
import './BudgetCard.css';

const BudgetCard = () => {
  return (
    <div className="budget-card">
      <div className="budget-header">
        <div className="budget-title-section">
          <h3 className="budget-title">Total Budget Spent</h3>
          <div className="time-filter">
            <span>YTD</span>
            <ChevronDown size={16} />
          </div>
          <UserMetrics />
        </div>
        <div className="budget-amount">
          <span className="currency">HK$</span>
          <span className="amount">23,156.00</span>
        </div>
      </div>
    </div>
  );
};

export default BudgetCard;
