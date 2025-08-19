import React from 'react';
import { ChevronDown } from 'lucide-react';
import UserMetrics from './UserMetrics'
import './BudgetCard.css';

const BudgetCard = () => {
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const [selectedYear, setSelectedYear] = React.useState('2025');
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  return (
    <div className="budget-card">
      <div className="budget-header">
        <div className="budget-title-section">
          <h3 className="budget-title">Total Budget Spent</h3>
          <div className="time-filter">
            <span
              className="dropdown-label"
              onClick={() => setDropdownOpen((open) => !open)}
            >
              {selectedYear}
              <ChevronDown size={16} />
            </span>
            {dropdownOpen && (
              <ul className="dropdown-menu">
                {years.map(year => (
                  <li
                    key={year}
                    onClick={() => { setSelectedYear(year); setDropdownOpen(false); }}
                  >
                    {year}
                  </li>
                ))}
              </ul>
            )}
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
