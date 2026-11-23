import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Shield,
  ArrowRight,
  Lock,
  Mail,
  AlertCircle,
  User as UserIcon,
  Building2,
  KeyRound,
  Sparkles,
  Camera,
  CheckCircle2,
  Cpu,
  Layers,
  FileCheck2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { authApi } from '../api';

export const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'TENANT' | 'LANDLORD'>('TENANT');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    const demoName = demoRole === 'TENANT' ? 'Aarav Sharma (Tenant)' : 'Ramesh Malik (Owner)';

    try {
      await authApi.login(demoEmail, demoPass);
      navigate('/');
    } catch (loginErr: any) {
      try {
        await authApi.register(demoEmail, demoPass, demoRole, demoName);
        navigate('/');
      } catch (regErr: any) {
        const errorMsg =
          loginErr?.response?.data?.message ||
          regErr?.response?.data?.message ||
          loginErr?.message ||
          regErr?.message ||
          'Demo login failed. Please verify API connection.';
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* LEFT COLUMN: PROTOCOL SHOWCASE & TELEMETRY */}
        <div className="lg:col-span-7 space-y-8">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono mb-4 shadow-sm shadow-emerald-500/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-semibold uppercase tracking-wider">PROTOCOL SPECIFICATION • CODEFESTTHON 2026</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight leading-tight">
              Stop Losing <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">40% of Your Rental Deposit</span> to Unfair Claims.
            </h1>
            <p className="mt-4 text-sm sm:text-base text-slate-400 max-w-xl leading-relaxed">
              RentShield turns move-in room photos into immutable SHA-256 cryptographic hashes right in your browser, backed by Gemini 2.5 Flash multimodal damage arbitration and zero-server byte verification.
            </p>
          </div>

          {/* 3-Step Visual Protocol Pipeline */}
          <div className="space-y-3.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-xl">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2">
              Three-Layer Escrow Defense Pipeline
            </div>

            <div className="flex items-start space-x-3.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 group hover:border-emerald-500/40 transition">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex-shrink-0 mt-0.5">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100 flex items-center space-x-2">
                  <span>01 Move-In SHA-256 Browser Seal</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Local Web Crypto</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tenant photographs room fixtures. Raw pixel bytes are hashed client-side using native SHA-256 before any upload.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 group hover:border-amber-500/40 transition">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex-shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100 flex items-center space-x-2">
                  <span>02 Landlord Magic-Link Lock</span>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Real-Time Sync</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Owner inspects baseline hashes through an authenticated single-use magic link and locks deposit liability.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 group hover:border-emerald-500/40 transition">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex-shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100 flex items-center space-x-2">
                  <span>03 Gemini 2.5 Flash INR Arbitration</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Multimodal AI</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Compares move-in vs move-out photos, filters standard Indian wear-and-tear, and calculates fair itemized deductions.
                </p>
              </div>
            </div>
          </div>

          {/* Trust Metrics Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
              <div className="text-lg sm:text-xl font-bold font-mono text-slate-100">₹1.2L Cr+</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Indian Rental Market</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
              <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400">Zero-Server</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Byte Verification</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-center">
              <div className="text-lg sm:text-xl font-bold font-mono text-amber-300">&lt; 3s</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Multimodal Audit</div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: GLASS VAULT AUTH & 1-CLICK JUDGE ACCESS */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl shadow-black/60 glass-vault-card relative overflow-hidden">
            {/* Ambient top highlight */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>

            <div className="text-center mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 mb-3 shadow-lg shadow-emerald-500/10">
                <Shield className="w-7 h-7" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
                {isRegister ? 'Create RentShield Vault' : 'Access Escrow Vault'}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {isRegister
                  ? 'Protect your security deposit with tamper-proof cryptographic inventory records'
                  : 'Sign in to access your tenancy inventories and deposit audit trail'}
              </p>
            </div>

            {/* 1-Click Judge Demo Quick Access - Shimmer Highlighted */}
            <div className="mb-6 p-4 rounded-xl bg-slate-950/90 border border-amber-500/30 shimmer-badge shadow-inner">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center space-x-1.5 font-mono">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>1-Click Judge Demo Access</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Instant Auto-Login
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleJudgeDemo('TENANT')}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800/90 border border-slate-700/80 hover:border-emerald-500/60 text-slate-200 text-xs font-semibold transition flex flex-col items-center justify-center space-y-1 group"
                >
                  <div className="flex items-center space-x-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition" />
                    <span className="font-bold">Demo as Tenant</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-normal">Aarav Sharma • 2BHK Indiranagar</span>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleJudgeDemo('LANDLORD')}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800/90 border border-slate-700/80 hover:border-amber-500/60 text-slate-200 text-xs font-semibold transition flex flex-col items-center justify-center space-y-1 group"
                >
                  <div className="flex items-center space-x-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition" />
                    <span className="font-bold">Demo as Owner</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-normal">Ramesh Malik • Property Owner</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
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
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
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
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-emerald-400 focus:outline-none transition cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400 hover:text-slate-200" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-2"
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
    </div>
  );
};
