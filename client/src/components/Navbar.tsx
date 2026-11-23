import React from 'react';
import { Shield, LogOut, Plus, Home } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api';

export const Navbar: React.FC = () => {
  const user = authApi.getCurrentUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    authApi.logout();
    navigate('/login');
  };

  return (
    <nav className="border-b border-slate-800 bg-slate-950/85 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:border-emerald-500/40 transition">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <span className="text-lg font-bold bg-gradient-to-r from-emerald-400 via-emerald-200 to-white bg-clip-text text-transparent">
                RentShield
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                {user?.role === 'LANDLORD' ? 'Owner Portal' : 'Tenant Portal'}
              </span>
            </div>
          </Link>

          {user ? (
            <div className="flex items-center space-x-4">
              <Link
                to="/verify"
                className="hidden sm:inline-flex items-center space-x-1.5 text-xs text-slate-300 hover:text-emerald-400 font-medium transition px-2.5 py-1 rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800"
              >
                <span>Verify Hash</span>
              </Link>
              {user.role === 'TENANT' && (
                <Link
                  to="/tenancy/new"
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold transition shadow-md shadow-emerald-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Protect New Deposit</span>
                </Link>
              )}
              <div className="hidden md:flex items-center space-x-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-medium text-slate-200">{user.name || user.email}</span>
                <span className="text-slate-600">•</span>
                <span className="font-semibold text-emerald-400 uppercase tracking-wider">{user.role}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link
                to="/verify"
                className="text-xs text-slate-400 hover:text-emerald-400 font-medium transition"
              >
                Verify Hash
              </Link>
              <Link
                to="/login"
                className="text-sm font-semibold px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition shadow-lg shadow-emerald-500/20"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
