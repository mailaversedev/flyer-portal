import React from 'react';
import { useLocation } from 'react-router';
import { Search, Bell, ChevronDown } from 'lucide-react';
import './Header.css';

const Header = () => {
  const location = useLocation();
  
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
      case '/dashboard':
        return 'Dashboard';
      case '/marketplace':
        return 'Marketplace';
      case '/flyer':
        return 'Types of Flyer Distribution';
      case '/flyer/create':
        return 'Create Your Flyer';
      case '/wallet':
        return 'Wallet';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="page-title">{getPageTitle()}</h1>
      </div>
      
      <div className="header-center">
        <div className="search-container">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            placeholder="Search..."
            className="search-input"
          />
        </div>
      </div>
      
      <div className="header-right">
        <button className="notification-btn">
          <Bell size={20} />
        </button>
        
        <div className="user-menu">
          <div className="user-info">
            <div className="user-avatar">🔥</div>
            <span className="user-name">Fire Fitness Co. Ltd</span>
            <ChevronDown size={16} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
