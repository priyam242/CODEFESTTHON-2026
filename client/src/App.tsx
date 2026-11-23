import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {!isDedicatedLandlordPortal && <Navbar />}
      <main className="flex-1">{children}</main>
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-600">
        RentShield &copy; {new Date().getFullYear()} &bull; Sealed Move-In Inventory &bull; Zero Deposit Disputes
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
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
