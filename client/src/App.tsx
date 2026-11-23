import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { IntroSplash } from './components/IntroSplash';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CreateTenancy } from './pages/CreateTenancy';
import { TenancyDetail } from './pages/TenancyDetail';
import { LandlordVerify } from './pages/LandlordVerify';
import { PublicVerifier } from './pages/PublicVerifier';
import { authApi } from './api';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = authApi.getCurrentUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  // Hide navbar on dedicated landlord token review link only
  const isDedicatedLandlordPortal = location.pathname.startsWith('/verify/') && location.pathname !== '/verify';

  return (
    <div className="min-h-screen bg-[#050811] cyber-grid-bg text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {!isDedicatedLandlordPortal && <Navbar />}
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-900/80 bg-slate-950/60 backdrop-blur-md py-6 text-center text-xs text-slate-500">
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-3">
          <span>RentShield &copy; {new Date().getFullYear()}</span>
          <span className="hidden sm:inline text-slate-700">&bull;</span>
          <span className="text-emerald-400/90 font-mono text-[11px]">WebCrypto SHA-256 Sealed Escrow</span>
          <span className="hidden sm:inline text-slate-700">&bull;</span>
          <span>Zero Security Deposit Disputes</span>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <IntroSplash />
      <Layout>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tenancy/new"
            element={
              <ProtectedRoute>
                <CreateTenancy />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tenancy/:id"
            element={
              <ProtectedRoute>
                <TenancyDetail />
              </ProtectedRoute>
            }
          />
          {/* Public Standalone Client-Side PDF & Hash Verifier */}
          <Route path="/verify" element={<PublicVerifier />} />
          {/* Public Landlord Verification Magic Token Route */}
          <Route path="/verify/:landlordToken" element={<LandlordVerify />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};
export default App;
