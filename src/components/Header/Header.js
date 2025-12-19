import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Search, Bell, LogOut } from 'lucide-react';

import ApiService from '../../services/ApiService';

import './Header.css';

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);

  useEffect(() => {
    const storedCompany = localStorage.getItem('company');
    if (storedCompany) {
      try {
        const parsedCompany = JSON.parse(storedCompany);
        setCompany(parsedCompany);
        ApiService.setCurrentCompany(parsedCompany);
      } catch (e) {
        console.error("Failed to parse company info", e);
      }
    }
  }, []);

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('company');
    navigate('/staff/login');
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
        
        {company && (
          <div className="user-info">
            <div className="user-avatar">
              {company.icon ? (
                <img
                  src={company.icon}
                  alt={company.name}
                  style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: '#ccc' }}></div>
              )}
            </div>
            <span className="user-name">{company.name}</span>
          </div>
        )}

        <button className="logout-btn" onClick={handleLogout} title="Logout">
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
};

export default Header;
