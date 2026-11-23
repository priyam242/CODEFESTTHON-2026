import React, { useState, useEffect, useCallback } from 'react';
import { Shield, LogOut, Plus, CheckCircle2, Cpu, Bell } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { authApi, tenancyApi } from '../api';
import { useLiveSync } from '../realtimeSync';
import { replayIntroAnimation } from './IntroSplash';

export const Navbar: React.FC = () => {
  const user = authApi.getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState<number>(0);

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isDashboard = location.pathname === '/';
  const isLandlord = user?.role === 'LANDLORD';

  const checkPending = useCallback(async () => {
    if (!user || user.role !== 'LANDLORD') {
      setPendingCount(0);
      return;
    }
    try {
      const data = await tenancyApi.getAll();
      const count = data.filter((t) => t.status === 'PENDING').length;
      setPendingCount(count);
    } catch {
      // Graceful offline/silent handling
    }
  }, [user]);

  // Real-time synchronization + 4-second polling for live notification popup
  useLiveSync(checkPending, 4000);

  useEffect(() => {
    checkPending();
  }, [checkPending]);

  const handleLogout = () => {
    authApi.logout();
    navigate('/login');
  };

  const handleSignInClick = (e: React.MouseEvent) => {
    if (location.pathname === '/login') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('rentshield-switch-to-login'));
      const emailInput = document.querySelector<HTMLInputElement>('input[type="email"]');
      const loginCard = document.getElementById('login-auth-card');

      if (emailInput) {
        emailInput.focus();
        emailInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        emailInput.classList.add('ring-2', 'ring-emerald-400', 'border-emerald-400');
        setTimeout(() => {
          emailInput.classList.remove('ring-2', 'ring-emerald-400', 'border-emerald-400');
        }, 1200);
      } else if (loginCard) {
        loginCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      navigate('/login');
    }
  };

  return (
    <nav className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            to="/"
            id="navbar-brand-logo"
            onClick={(e) => {
              if (location.pathname === '/') {
                replayIntroAnimation();
              }
            }}
            className="inline-flex w-fit items-center space-x-3 group relative z-50 cursor-pointer pointer-events-auto flex-shrink-0"
            title="RentShield Cyber-Escrow (Click to replay intro animation)"
          >
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
            <div className="flex items-center space-x-3 sm:space-x-4 relative z-50 pointer-events-auto">
              <div className="hidden sm:inline-flex items-center space-x-2 text-xs font-mono px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 shadow-sm shadow-emerald-500/10 pointer-events-none select-none">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] font-semibold">Gemini 2.5 Flash + WebCrypto Active</span>
              </div>
              <Link
                to="/verify"
                className="relative z-50 cursor-pointer pointer-events-auto text-xs font-medium text-slate-300 hover:text-emerald-400 px-3 py-1.5 rounded-xl hover:bg-slate-900 border border-slate-800/60 transition"
              >
                Verify Hash
              </Link>
              <Link
                to="/login"
                onClick={handleSignInClick}
                className="relative z-50 cursor-pointer pointer-events-auto text-xs font-bold px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 transition shadow-lg shadow-emerald-500/20 flex items-center justify-center select-none"
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

              {/* Landlord Notification Bell */}
              {isLandlord && (
                <button
                  onClick={() => {
                    if (location.pathname !== '/') {
                      navigate('/');
                    } else {
                      const el = document.getElementById('pending-approval-banner');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  title={
                    pendingCount > 0
                      ? `${pendingCount} Pending Move-In Approval Request${pendingCount > 1 ? 's' : ''}`
                      : 'No pending approvals'
                  }
                  className={`relative p-2 rounded-xl transition border ${
                    pendingCount > 0
                      ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40 shadow-sm shadow-amber-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border-slate-800/60'
                  }`}
                >
                  <Bell className={`w-4 h-4 ${pendingCount > 0 ? 'animate-bounce' : ''}`} />
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm shadow-red-500/50 animate-pulse">
                      {pendingCount}
                    </span>
                  )}
                </button>
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
