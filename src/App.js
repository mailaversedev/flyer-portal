import React from "react";
import { BrowserRouter as Router, Navigate, Routes, Route } from "react-router";
import { ToastContainer } from 'react-toastify';
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
import PlatformAdminUsersPage from "./pages/PlatformAdmin/PlatformAdminUsersPage";
import PlatformAdminCompaniesPage from "./pages/PlatformAdmin/PlatformAdminCompaniesPage";
import PlatformAdminCreditRequestsPage from "./pages/PlatformAdmin/PlatformAdminCreditRequestsPage";
import PlatformVouchersListPage from "./pages/PlatformVouchers/PlatformVouchersListPage";
import PlatformVouchersCreatePage from "./pages/PlatformVouchers/PlatformVouchersCreatePage";
import CrmCampaignListPage from "./pages/CrmCampaigns/CrmCampaignListPage";
import CrmCampaignCreatePage from "./pages/CrmCampaigns/CrmCampaignCreatePage";
import WalletPage from "./pages/Wallet/WalletPage";
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
  return (
    <Router>
      <div className="App">
        <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="light" />
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
                          <WalletPage />
                        </SuperAdminRedirect>
                      }
                    />
                    <Route path="/platform-admin" element={<PlatformAdmin />} />
                    <Route path="/platform-admin/users" element={<PlatformAdminUsersPage />} />
                    <Route
                      path="/platform-admin/companies"
                      element={<PlatformAdminCompaniesPage />}
                    />
                    <Route
                      path="/platform-admin/credit-requests"
                      element={<PlatformAdminCreditRequestsPage />}
                    />
                    <Route path="/platform-vouchers" element={<PlatformVouchersListPage />} />
                    <Route path="/platform-vouchers/create" element={<PlatformVouchersCreatePage />} />
                    <Route path="/crm-campaigns" element={<CrmCampaignListPage />} />
                    <Route path="/crm-campaigns/create" element={<CrmCampaignCreatePage />} />
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
