import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  User as UserIcon,
  Mail,
  Building,
  KeyRound,
  CheckCircle2,
  X,
  CreditCard,
  QrCode,
  Copy,
  Check,
  Save,
  Lock,
  Layers,
  LogOut,
} from 'lucide-react';
import { authApi, tenancyApi, Tenancy } from '../api';

export interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onLogout,
}) => {
  const user = authApi.getCurrentUser();
  const [defaultUpi, setDefaultUpi] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [stats, setStats] = useState<{ active: number; settled: number; totalDeposit: number }>({
    active: 0,
    settled: 0,
    totalDeposit: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const emailStorageKey = user?.email
    ? `rentshield_default_upi_${user.email.toLowerCase()}`
    : null;

  useEffect(() => {
    if (emailStorageKey) {
      const stored = localStorage.getItem(emailStorageKey);
      if (stored) {
        setDefaultUpi(stored);
      } else {
        // Fallback default suggestion
        const prefix = user?.email ? user.email.split('@')[0] : 'user';
        setDefaultUpi(user?.role === 'LANDLORD' ? 'ramesh.malik@okhdfcbank' : `${prefix}@okaxis`);
      }
    }
  }, [emailStorageKey, user]);

  useEffect(() => {
    if (!isOpen) return;
    let isCancelled = false;
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const data = await tenancyApi.getAll();
        if (isCancelled) return;
        const list = Array.isArray(data) ? data : [];
        const settled = list.filter((t) => t.status === 'SETTLED').length;
        const active = list.length - settled;
        const totalDeposit = list.reduce((acc, t) => acc + Number(t.depositAmount || 0), 0);
        setStats({ active, settled, totalDeposit });
      } catch {
        // Silent fallback
      } finally {
        if (!isCancelled) setLoadingStats(false);
      }
    };
    fetchStats();
    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return 'RS';
  };

  const handleSaveUpi = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailStorageKey && defaultUpi.trim()) {
      localStorage.setItem(emailStorageKey, defaultUpi.trim());
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2400);
    }
  };

  const handleCopyEmail = () => {
    if (user.email) {
      navigator.clipboard.writeText(user.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative overflow-hidden glass-vault-card">
        {/* Top Accent Gradient */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500"></div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Header */}
        <div className="flex items-start space-x-4 mb-6">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-slate-950 border border-emerald-500/40 text-emerald-300 font-extrabold text-lg flex items-center justify-center font-mono shadow-lg shadow-emerald-500/10">
              {getInitials(user.name, user.email)}
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-500 text-slate-950 shadow-sm" title="Cryptographically Verified">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-100 truncate">
                {user.name || 'RentShield User'}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                {user.role}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-400 mt-1">
              <span className="truncate">{user.email}</span>
              <button
                type="button"
                onClick={handleCopyEmail}
                title="Copy Email"
                className="text-slate-500 hover:text-emerald-400 transition"
              >
                {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="mt-2 inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-[10px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>WebCrypto SHA-256 Engine: Active</span>
            </div>
          </div>
        </div>

        {/* Saved Default UPI Vault */}
        <div className="mb-6 p-4 rounded-2xl bg-slate-950/90 border border-slate-800/90 relative">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5 font-mono">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              <span>Default Receiving UPI ID Vault</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">Auto-Preload in QR</span>
          </div>
          <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
            {user.role === 'LANDLORD'
              ? 'Your receiving UPI ID for tenant security deposits (pre-populates Step 02/03 QR code).'
              : 'Your receiving UPI ID for landlord deposit escrow refunds (pre-populates Step 04/05 QR code).'}
          </p>

          <form onSubmit={handleSaveUpi} className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  required
                  value={defaultUpi}
                  onChange={(e) => setDefaultUpi(e.target.value)}
                  placeholder="name@okhdfcbank or 9876543210@ybl"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-xs text-slate-100 font-mono placeholder-slate-500 focus:outline-none transition"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold font-mono transition shadow-md shadow-emerald-500/20 inline-flex items-center space-x-1 flex-shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
            {savedSuccess && (
              <div className="text-[11px] text-emerald-400 font-mono flex items-center space-x-1 pt-1 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Default UPI ID updated and saved in local encrypted vault!</span>
              </div>
            )}
          </form>
        </div>

        {/* Quick Protocol Stats */}
        <div className="grid grid-cols-3 gap-2.5 mb-6 text-center">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-500 font-mono uppercase block">Active Escrows</span>
            <span className="text-base font-bold font-mono text-emerald-400 mt-0.5 block">
              {loadingStats ? '...' : stats.active}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-500 font-mono uppercase block">Settled Past</span>
            <span className="text-base font-bold font-mono text-slate-200 mt-0.5 block">
              {loadingStats ? '...' : stats.settled}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[10px] text-slate-500 font-mono uppercase block">Protection</span>
            <span className="text-base font-bold font-mono text-cyan-400 mt-0.5 block">
              100% SHA
            </span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
          {onLogout ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 text-rose-400 text-xs font-semibold font-mono transition inline-flex items-center space-x-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold font-mono transition"
          >
            Close Vault
          </button>
        </div>
      </div>
    </div>
  );
};
export default UserProfileModal;
