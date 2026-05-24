import React from "react";
import { NavLink, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Building2,
  LayoutDashboard,
  Mail,
  ShoppingBag,
  FileText,
  Wallet,
  Percent,
  Shield,
  Gift,
  Users,
} from "lucide-react";
import { isSuperAdmin } from "../../utils/AuthUtil";
import "./Sidebar.css";

const Sidebar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const showSuperAdminItem = isSuperAdmin();
  const isPlatformAdminSection =
    location.pathname === "/platform-admin" ||
    location.pathname.startsWith("/platform-admin/");

  const navigationItems = showSuperAdminItem
    ? [
        {
          name: t("common.platformAdmin"),
          path: "/platform-admin",
          icon: Shield,
          isSectionRoot: true,
        },
        {
          name: t("adminPage.usersTab"),
          path: "/platform-admin/users",
          icon: Users,
          isChild: true,
        },
        {
          name: t("adminPage.companiesTab"),
          path: "/platform-admin/companies",
          icon: Building2,
          isChild: true,
        },
        {
          name: t("common.vouchers"),
          path: "/platform-vouchers",
          icon: Gift,
        },
        {
          name: t("common.crmCampaigns"),
          path: "/crm-campaigns",
          icon: Mail,
        },
        {
          name: t("common.flyer"),
          path: "/flyer",
          icon: FileText,
        },
      ]
    : [
        {
          name: t("common.dashboard"),
          path: "/dashboard",
          icon: LayoutDashboard,
          active: true,
        },
        {
          name: t("common.marketplace"),
          path: "/marketplace",
          icon: ShoppingBag,
        },
        {
          name: t("common.coupons"),
          path: "/coupons",
          icon: Percent,
        },
        {
          name: t("common.flyer"),
          path: "/flyer",
          icon: FileText,
        },
        {
          name: t("common.wallet"),
          path: "/wallet",
          icon: Wallet,
        },
      ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">
            <img
              src={`${process.env.PUBLIC_URL}/favicon.ico`}
              alt="Mailaverse logo"
              className="logo-icon-image"
            />
          </div>
          <h2 className="logo-text">MAILAVERSE</h2>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navigationItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => {
              const isItemActive =
                isActive || (item.isSectionRoot && isPlatformAdminSection);

              return `nav-item ${isItemActive ? "active" : ""} ${item.isChild ? "child" : ""}`;
            }}
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
