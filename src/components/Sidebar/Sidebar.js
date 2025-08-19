import React from 'react';
import { NavLink } from 'react-router';
import { LayoutDashboard, ShoppingBag, FileText, Wallet } from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {
  const navigationItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      active: true
    },
    {
      name: 'Marketplace',
      path: '/marketplace',
      icon: ShoppingBag
    },
    {
      name: 'Flyer',
      path: '/flyer',
      icon: FileText
    },
    {
      name: 'Wallet',
      path: '/wallet',
      icon: Wallet
    }
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">M</div>
          <h2 className="logo-text">MAILAVERSE</h2>
        </div>
      </div>
      
      <nav className="sidebar-nav">
        {navigationItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => 
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            <item.icon className="nav-icon" size={20} />
            <span className="nav-text">{item.name}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;
