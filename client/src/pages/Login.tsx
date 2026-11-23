import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, ArrowRight, Lock, Mail, AlertCircle, User as UserIcon, Building2, KeyRound } from 'lucide-react';
import { authApi } from '../api';

export const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'TENANT' | 'LANDLORD'>('TENANT');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        await authApi.register(email, password, role, name || (role === 'TENANT' ? 'Tenant Guest' : 'Property Owner'));
      } else {
        await authApi.login(email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleJudgeDemo = async (demoRole: 'TENANT' | 'LANDLORD') => {
    setError(null);
    setLoading(true);
    const demoEmail = demoRole === 'TENANT' ? 'tenant.demo@rentshield.com' : 'landlord.demo@rentshield.com';
    const demoPass = 'password123';
    const demoName = demoRole === 'TENANT' ? 'Aarav Tenant' : 'Ramesh Malik (Owner)';

    try {
      await authApi.login(demoEmail, demoPass);
      navigate('/');
    } catch {
      try {
        await authApi.register(demoEmail, demoPass, demoRole, demoName);
        navigate('/');
      } catch (regErr: any) {
        setError(regErr?.response?.data?.message || 'Demo login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
            <Shield className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-100">
            {isRegister ? 'Create RentShield Account' : 'Welcome to RentShield'}
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            {isRegister
              ? 'Protect your security deposit with tamper-proof cryptographic inventory records'
              : 'Sign in to access your tenancy inventories and deposit audit trail'}
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-xl shadow-black/40">
          {/* 1-Click Judge Demo Quick Access */}
          <div className="mb-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-1">
                <KeyRound className="w-3.5 h-3.5" />
                <span>1-Click Judge Demo Access</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Instant Auto-Login</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleJudgeDemo('TENANT')}
                className="py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/50 text-slate-200 text-xs font-medium transition flex items-center justify-center space-x-1.5 group"
              >
                <UserIcon className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition" />
                <span>Demo as Tenant</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleJudgeDemo('LANDLORD')}
                className="py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500/50 text-slate-200 text-xs font-medium transition flex items-center justify-center space-x-1.5 group"
              >
                <Building2 className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition" />
                <span>Demo as Owner</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start space-x-2.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dual Role Selector for Register */}
            {isRegister && (
              <div className="space-y-2 mb-4">
                <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Select Your Account Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('TENANT')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      role === 'TENANT'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500'
                        : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1.5">
                      <UserIcon className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs text-slate-100">Tenant / Guest</span>
                    </div>
                    <span className="text-[11px] text-slate-400 leading-tight">
                      Move-in proofs &amp; protect deposit
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('LANDLORD')}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      role === 'LANDLORD'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500'
                        : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2 mb-1.5">
                      <Building2 className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-xs text-slate-100">Property Owner / Malik</span>
                    </div>
                    <span className="text-[11px] text-slate-400 leading-tight">
                      Verify property condition &amp; settle deposits
                    </span>
                  </button>
                </div>
              </div>
            )}

            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={role === 'TENANT' ? 'e.g. Aarav Sharma' : 'e.g. Ramesh Malik (Owner)'}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={role === 'TENANT' ? 'tenant@example.com' : 'owner@example.com'}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-800 text-center space-y-3">
            <div>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError(null);
                }}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition"
              >
                {isRegister
                  ? 'Already have an account? Sign in here'
                  : "Don't have an account yet? Create one here"}
              </button>
            </div>
            <div>
              <Link
                to="/verify"
                className="text-[11px] text-slate-400 hover:text-emerald-400 transition inline-flex items-center space-x-1"
              >
                <span>Public Certificate &amp; Hash Verifier</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
