import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router";
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
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import "./App.css";

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
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/coupons" element={<Coupons />} />
                    <Route path="/marketplace" element={<Marketplace />} />
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
                      element={<div>{t("walletPage.title")}</div>}
                    />
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
