import React from "react";
import { BrowserRouter as Router, Navigate, Routes, Route } from "react-router";
import { useTranslation } from "react-i18next";
import Layout from "./components/Layout/Layout";
import Dashboard from "./pages/Dashboard/Dashboard";
import Coupons from "./pages/Coupons/Coupons";
import Marketplace from "./pages/Marketplace/Marketplace";
import Flyer from "./pages/Flyer/Flyer";
import LeafletCreation from "./pages/Flyer/FlyerCreation/Leaflet";
import QueryCreation from "./pages/Flyer/FlyerCreation/Query";
import QRGeneration from "./pages/Flyer/FlyerCreation/QRGeneration";
import StaffLogin from "./pages/Login/StaffLogin";
import Profile from "./pages/Profile/Profile";
import PlatformAdmin from "./pages/PlatformAdmin/PlatformAdmin";
import PlatformVouchers from "./pages/PlatformVouchers/PlatformVouchers";
import CrmCampaigns from "./pages/CrmCampaigns/CrmCampaigns";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import { isSuperAdmin } from "./utils/AuthUtil";
import "./App.css";

const SuperAdminRedirect = ({ children }) => {
  if (isSuperAdmin()) {
    return <Navigate to="/platform-admin" replace />;
  }

  return children;
};

const DefaultHome = () => {
  if (isSuperAdmin()) {
    return <Navigate to="/platform-admin" replace />;
  }

  return <Dashboard />;
};

function App() {
  const { t } = useTranslation();

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/staff/login" element={<StaffLogin />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<DefaultHome />} />
                    <Route
                      path="/dashboard"
                      element={
                        <SuperAdminRedirect>
                          <Dashboard />
                        </SuperAdminRedirect>
                      }
                    />
                    <Route
                      path="/coupons"
                      element={
                        <SuperAdminRedirect>
                          <Coupons />
                        </SuperAdminRedirect>
                      }
                    />
                    <Route
                      path="/marketplace"
                      element={
                        <SuperAdminRedirect>
                          <Marketplace />
                        </SuperAdminRedirect>
                      }
                    />
                    <Route path="/flyer" element={<Flyer />} />
                    <Route
                      path="/flyer/create/leaflet"
                      element={<LeafletCreation />}
                    />
                    <Route
                      path="/flyer/create/query"
                      element={<QueryCreation />}
                    />
                    <Route path="/flyer/create/qr" element={<QRGeneration />} />
                    <Route
                      path="/flyer/edit/leaflet/:flyerId"
                      element={<LeafletCreation />}
                    />
                    <Route
                      path="/flyer/edit/qr/:flyerId"
                      element={<QRGeneration />}
                    />
                    <Route
                      path="/wallet"
                      element={
                        <SuperAdminRedirect>
                          <div>{t("walletPage.title")}</div>
                        </SuperAdminRedirect>
                      }
                    />
                    <Route path="/platform-admin" element={<PlatformAdmin />} />
                    <Route path="/platform-vouchers" element={<PlatformVouchers />} />
                    <Route path="/crm-campaigns" element={<CrmCampaigns />} />
                    <Route path="/profile" element={<Profile />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
