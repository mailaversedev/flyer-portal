import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router';
import { Search, Bell, ChevronDown } from 'lucide-react';

import ApiService from '../../services/ApiService';

import './Header.css';


// Example companies (replace with real data or fetch from API)
const COMPANIES = [
  { name: 'Fire Fitness Co. Ltd', id: 'fitness' },
  { name: 'Keeta', id: 'keeta' },
  { name: 'DiDi', id: 'dd' },
];

const Header = () => {
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [companies] = useState(COMPANIES);
  const [selectedCompany, setSelectedCompany] = useState(COMPANIES[0]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (ApiService) {
      ApiService.setCurrentCompany(selectedCompany);
    }
  }, [selectedCompany]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

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

  const handleCompanySelect = (company) => {
    setSelectedCompany(company);
    setDropdownOpen(false);
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
        <div className="user-menu" ref={dropdownRef}>
          <div className="user-info" onClick={() => setDropdownOpen((open) => !open)} style={{ cursor: 'pointer' }}>
            <div className="user-avatar">
              <img
                src={`/${selectedCompany.id}.png`}
                alt={selectedCompany.name}
                style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none'; }}
              />
            </div>
            <span className="user-name">{selectedCompany.name}</span>
            <ChevronDown size={16} />
          </div>
          {dropdownOpen && (
            <div className="company-dropdown">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className={`company-option${company.id === selectedCompany.id ? ' selected' : ''}`}
                  onClick={() => handleCompanySelect(company)}
                >
                  <span className="company-icon">
                    <img
                      src={`/${company.id}.png`}
                      alt={company.name}
                      style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  </span>
                  <span className="company-name">{company.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
