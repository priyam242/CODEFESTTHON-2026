import React from 'react';
import { Shield, LogOut, Plus, CheckCircle2, Cpu } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../api';

export const Navbar: React.FC = () => {
  const user = authApi.getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isDashboard = location.pathname === '/';

  const handleLogout = () => {
    authApi.logout();
    navigate('/login');
  };

  return (
    <nav className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:border-emerald-500/50 group-hover:scale-105 transition-all shadow-lg shadow-emerald-500/10">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-extrabold bg-gradient-to-r from-emerald-400 via-emerald-200 to-white bg-clip-text text-transparent tracking-tight">
                RentShield
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                Cyber-Escrow
              </span>
            </div>
          </Link>

          {/* Show protocol status pill when on auth page or unauthenticated */}
          {isAuthPage || !user ? (
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="hidden sm:inline-flex items-center space-x-2 text-xs font-mono px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 shadow-sm shadow-emerald-500/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] font-semibold">Gemini 2.5 Flash + WebCrypto Active</span>
              </div>
              <Link
                to="/verify"
                className="text-xs font-medium text-slate-300 hover:text-emerald-400 px-3 py-1.5 rounded-xl hover:bg-slate-900 border border-slate-800/60 transition"
              >
                Verify Hash
              </Link>
              <Link
                to="/login"
                className="text-xs font-bold px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20"
              >
                Sign In
              </Link>
            </div>
          ) : (
            <div className="flex items-center space-x-3 sm:space-x-4">
              <Link
                to="/verify"
                className="hidden sm:inline-flex items-center space-x-1.5 text-xs text-slate-300 hover:text-emerald-400 font-medium transition px-3 py-1.5 rounded-xl hover:bg-slate-900 border border-slate-800/60"
              >
                <span>Verify Hash</span>
              </Link>

              {/* Show CTA only when NOT on dashboard (preventing duplicate CTA conflict with hero button) */}
              {user.role === 'TENANT' && !isDashboard && (
                <Link
                  to="/tenancy/new"
                  className="hidden sm:inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow-md shadow-emerald-500/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Protect New Deposit</span>
                </Link>
              )}

              {/* User Identity Chip */}
              <div className="flex items-center space-x-2 text-xs text-slate-300 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-medium text-slate-200 max-w-[130px] truncate">{user.name || user.email}</span>
                <span className="text-slate-700">•</span>
                <span className="font-mono text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{user.role}</span>
              </div>

              <button
                onClick={handleLogout}
                title="Logout"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800/60 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
