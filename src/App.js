import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import Marketplace from './pages/Marketplace/Marketplace';
import Flyer from './pages/Flyer/Flyer';
import LeafletCreation from './pages/Flyer/FlyerCreation/Leaflet';
import QueryCreation from './pages/Flyer/FlyerCreation/Query';
import QRGeneration from './pages/Flyer/FlyerCreation/QRGeneration';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/flyer" element={<Flyer />} />
            <Route path="/flyer/create/leaflet" element={<LeafletCreation />} />
            <Route path="/flyer/create/query" element={<QueryCreation />} />
            <Route path="/flyer/create/qr" element={<QRGeneration />} />
            <Route path="/wallet" element={<div>Wallet Page</div>} />
          </Routes>
        </Layout>
      </div>
    </Router>
  );
}

export default App;
