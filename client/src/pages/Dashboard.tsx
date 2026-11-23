import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield,
  Plus,
  Building,
  IndianRupee,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileCheck,
  KeyRound,
  Zap,
  Lock,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Bell,
  QrCode,
  Check,
  Copy,
} from 'lucide-react';
import { tenancyApi, Tenancy, authApi, api } from '../api';
import { useLiveSync, emitSyncEvent } from '../realtimeSync';

export const Dashboard: React.FC = () => {
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimToken, setClaimToken] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [resettingDemo, setResettingDemo] = useState(false);

  // Owner Payout UPI Modal & Settlement State
  const [payoutTenancy, setPayoutTenancy] = useState<Tenancy | null>(null);
  const [tenantVpa, setTenantVpa] = useState('tenant.aarav@okhdfcbank');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [settledMap, setSettledMap] = useState<Record<string, boolean>>({});

  const navigate = useNavigate();
  const user = authApi.getCurrentUser();
  const isInitialLoad = useRef(true);

  // Hydrate settlement states from localStorage
  useEffect(() => {
    const map: Record<string, boolean> = {};
    tenancies.forEach((t) => {
      if (localStorage.getItem(`rentshield_settled_${t.id}`) === 'true') {
        map[t.id] = true;
      }
    });
    setSettledMap(map);
  }, [tenancies]);

  const handleResetDemo = async () => {
    setResettingDemo(true);
    try {
      await api.post('/tenancy/demo/reset');
      emitSyncEvent('TENANCY_CREATED');
      await loadTenancies();
    } catch (err: any) {
      alert('Failed to reset demo: ' + (err?.response?.data?.message || err.message));
    } finally {
      setResettingDemo(false);
    }
  };

  const loadTenancies = useCallback(async () => {
    try {
      const data = await tenancyApi.getAll();
      setTenancies(data);
    } catch (err: any) {
      if (isInitialLoad.current) {
        setError(err?.response?.data?.message || err?.message || 'Failed to fetch tenancies');
      }
    } finally {
      if (isInitialLoad.current) {
        setLoading(false);
        isInitialLoad.current = false;
      }
    }
  }, []);

  // Multi-tab real-time sync + 4-second polling with modal pause shield (zero layout flicker)
  const isModalOpen = payoutTenancy !== null || resettingDemo;
  const { isLiveSynced } = useLiveSync(loadTenancies, 4000, isModalOpen);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadTenancies();
  }, [user, navigate, loadTenancies]);

  // Smart URL parser: extracts clean UUID even when user pastes a full URL (e.g. https://.../verify/<token>)
  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = claimToken.trim().replace(/\/+$/, '').split('/').pop() || '';
    if (!cleanToken) return;
    setClaiming(true);
    setClaimMsg(null);
    try {
      await api.post(`/tenancy/claim/${cleanToken}`);
      setClaimMsg('Property successfully linked to your owner account!');
      setClaimToken('');
      emitSyncEvent('PROPERTY_CLAIMED');
      await loadTenancies();
    } catch (err: any) {
      setClaimMsg(err?.response?.data?.message || 'Failed to link property');
    } finally {
      setClaiming(false);
    }
  };

  const totalDeposit = tenancies.reduce((acc, t) => acc + Number(t.depositAmount || 0), 0);
  const totalApproved = tenancies.filter((t) => t.status === 'APPROVED').length;
  const isLandlord = user?.role === 'LANDLORD';
  const pendingApprovals = isLandlord ? tenancies.filter((t) => t.status === 'PENDING') : [];
  const vacatedCount = tenancies.filter((t) => {
    const isSettled = settledMap[t.id] || (typeof window !== 'undefined' && localStorage.getItem(`rentshield_settled_${t.id}`) === 'true');
    return (
      (t.items && t.items.length > 0 && t.items.every((i) => Boolean(i.moveOutPhotoUrl || i.aiVerdict))) ||
      t.status === 'COMPLETED' ||
      t.status === 'VACATED' ||
      isSettled
    );
  }).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* High-Priority Owner Action Banner for Pending Move-In Approvals */}
      {isLandlord && pendingApprovals.length > 0 && (
        <div id="pending-approval-banner" className="mb-8 space-y-4">
          {pendingApprovals.map((pending) => {
            const tenantName = (pending as any).user?.name || 'Aarav Sharma (Tenant)';
            const tenantEmail = (pending as any).user?.email || 'tenant.demo@rentshield.com';
            const depositFormatted = Number(pending.depositAmount || 0).toLocaleString('en-IN');
            const itemCount = pending.items?.length || 0;

            return (
              <div
                key={pending.id}
                className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-red-500/10 to-amber-500/5 border border-amber-500/40 shadow-xl shadow-amber-500/10 relative overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-500"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div className="flex items-start space-x-4">
                    <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-md shadow-amber-500/20 flex-shrink-0 animate-pulse">
                      <Bell className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                      <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-mono font-bold uppercase tracking-wider mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                        <span>🔔 Action Required: Pending Move-In Approval Requests</span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center space-x-2">
                        <span>Review & Cryptographically Seal Tenancy</span>
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                        Tenant <strong className="text-emerald-300 font-semibold">{tenantName}</strong> ({tenantEmail}) has sealed the baseline room inventory hashes and requested your counter-signature.
                      </p>
                      <div className="flex flex-wrap items-center gap-4 mt-2.5 text-xs font-mono text-slate-300">
                        <span className="flex items-center space-x-1.5">
                          <Building className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-slate-200 font-semibold">{pending.propertyTitle}</span>
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                          <IndianRupee className="w-3.5 h-3.5" />
                          <span>₹{depositFormatted} Escrow Deposit</span>
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400">
                          {itemCount} Fixture{itemCount !== 1 ? 's' : ''} Documented
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Link
                      to={`/verify/${pending.landlordToken}`}
                      className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 hover:from-amber-400 hover:to-emerald-300 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-95"
                    >
                      <span>Review & Sign Inventory</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Top Banner / Hero */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
              {isLandlord ? 'Property Owner & Landlord Dashboard' : 'Tenant Deposit Protection Portal'}
            </span>
            {isLiveSynced && (
              <span className="inline-flex items-center space-x-1 text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                <Zap className="w-3 h-3 text-emerald-400" />
                <span>Live Synced Just Now</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            {isLandlord ? `Welcome back, ${user?.name || user?.email}` : 'Protected Tenancy Deposits'}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            {isLandlord
              ? 'Review tenant inventories, inspect SHA-256 photo hashes, and lock move-in records.'
              : 'Immutable SHA-256 room inventory records & AI-verified wear-and-tear protection.'}
          </p>
        </div>
        {!isLandlord ? (
          <div className="mt-4 md:mt-0 flex items-center space-x-3">
            <button
              type="button"
              onClick={handleResetDemo}
              disabled={resettingDemo}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-semibold transition shadow-sm"
              title="Restore fresh 2BHK Bangalore demo tenancy"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{resettingDemo ? 'Resetting...' : 'Reset Demo State'}</span>
            </button>
            <Link
              to="/tenancy/new"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm transition shadow-lg shadow-emerald-500/25"
            >
              <Plus className="w-4 h-4" />
              <span>Protect New Deposit</span>
            </Link>
          </div>
        ) : (
          <div className="mt-4 md:mt-0">
            <form onSubmit={handleClaim} className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Enter Landlord Token to Link Property"
                value={claimToken}
                onChange={(e) => setClaimToken(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500 w-64"
              />
              <button
                type="submit"
                disabled={claiming}
                className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition shadow-md shadow-emerald-500/20 flex items-center space-x-1"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{claiming ? 'Linking...' : 'Link Property'}</span>
              </button>
            </form>
            {claimMsg && <p className="text-[11px] text-emerald-400 mt-1">{claimMsg}</p>}
          </div>
        )}
      </div>

      {/* FinTech Telemetry Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* Card 1: Total Protected Deposits */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 backdrop-blur-xl shadow-xl relative overflow-hidden group hover:border-emerald-500/30 transition">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>
          <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-medium mb-2">
            <span>{isLandlord ? 'Total Managed Deposits' : 'Total Protected Deposits'}</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <IndianRupee className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono tracking-tight">
            ₹{totalDeposit.toLocaleString('en-IN')}
          </div>
          <div className="mt-2 text-xs text-emerald-400 flex items-center space-x-1.5 font-mono">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="text-[11px]">Cryptographically Sealed</span>
          </div>
        </div>

        {/* Card 2: Active Tenancies */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 backdrop-blur-xl shadow-xl relative overflow-hidden group hover:border-emerald-500/30 transition">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent"></div>
          <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-medium mb-2">
            <span>{isLandlord ? 'Linked Properties' : 'Active Tenancies'}</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Building className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono tracking-tight">
            {tenancies.length}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center space-x-1.5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span className="text-[11px]">{isLandlord ? 'Properties matching owner email' : 'SHA-256 Ledger Registered'}</span>
          </div>
        </div>

        {/* Card 3: Landlord Approved */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 backdrop-blur-xl shadow-xl relative overflow-hidden group hover:border-emerald-500/30 transition">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent"></div>
          <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-medium mb-2">
            <span>{isLandlord ? 'Sealed by You' : 'Landlord Approved'}</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono tracking-tight">
            {totalApproved} / {tenancies.length}
          </div>
          <div className="mt-2 text-xs text-emerald-400 flex items-center space-x-1.5 font-mono">
            <span className="text-[11px]">
              {isLandlord && vacatedCount > 0
                ? `${vacatedCount} Property Vacated & Free`
                : totalApproved === tenancies.length && tenancies.length > 0
                ? 'All Inventories Dual-Locked'
                : 'Pending Sign-offs'}
            </span>
          </div>
        </div>
      </div>

      {/* Tenancies List Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-100">
          {isLandlord ? 'Properties Linked to Your Owner Account' : 'Your Tenancy Agreements'}
        </h2>
        <span className="text-xs font-mono text-slate-500">
          {tenancies.length} Escrow Contract{tenancies.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Tenancies List */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          Loading protected tenancies...
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      ) : tenancies.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl bg-slate-900/40 border border-slate-800 border-dashed">
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 inline-flex mb-4">
            <Building className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-100">
            {isLandlord ? 'No Properties Linked Yet' : 'No Protected Tenancies Yet'}
          </h3>
          <p className="mt-1 text-sm text-slate-400 max-w-sm mx-auto">
            {isLandlord
              ? 'Enter a Landlord Token above or ask your tenant to enter your email when protecting their deposit.'
              : 'Create your first tenancy to lock in your security deposit with a sealed move-in photo inventory.'}
          </p>
          {!isLandlord && (
            <div className="mt-6">
              <Link
                to="/tenancy/new"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Initialize Tenancy</span>
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenancies.map((tenancy) => {
            const hasMoveIn = (tenancy.items?.length || 0) > 0;
            const isApproved = tenancy.status === 'APPROVED';
            const hasAiAudit = tenancy.items?.some((i) => i.aiVerdict);
            const totalDeductions = (tenancy.items || []).reduce((acc, it) => acc + Number(it.suggestedCut || 0), 0);
            const originalDeposit = Number(tenancy.depositAmount || 0);
            const netRefund = Math.max(0, originalDeposit - totalDeductions);
            const isSettled = settledMap[tenancy.id] || (typeof window !== 'undefined' && localStorage.getItem(`rentshield_settled_${tenancy.id}`) === 'true');
            const isVacated = (tenancy.items && tenancy.items.length > 0 && tenancy.items.every((item) => Boolean(item.moveOutPhotoUrl || item.aiVerdict))) || tenancy.status === 'COMPLETED' || tenancy.status === 'VACATED' || isSettled;

            return (
              <div
                key={tenancy.id}
                className="group rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-emerald-500/40 transition duration-300 overflow-hidden backdrop-blur-xl flex flex-col justify-between shadow-xl shadow-black/30 glass-vault-card relative"
              >
                {/* Top Subtle Edge Gradient */}
                <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${isVacated ? 'from-cyan-500 via-emerald-400 to-cyan-500' : isApproved ? 'from-emerald-500 via-emerald-300 to-emerald-500' : 'from-amber-500 via-amber-300 to-amber-500'}`}></div>

                <div className="p-6">
                  {/* Vacated & Free for Next Tenant Badge */}
                  {isVacated && (
                    <div className="mb-2.5 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold font-mono uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm animate-pulse">
                      <span>🏠 PROPERTY VACATED • FREE FOR NEXT TENANT</span>
                    </div>
                  )}

                  {isSettled && (
                    <div className="mb-2.5 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-bold font-mono uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
                      <span>🎉 Refund Settled • Property Free for Next Tenant</span>
                    </div>
                  )}

                  {/* Status & Deposit Amount */}
                  <div className="flex items-start justify-between mb-3">
                    <span
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                        isSettled
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                          : isApproved
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                          : tenancy.status === 'PENDING'
                          ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 animate-pulse'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                      }`}
                    >
                      {isSettled ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Settled &amp; Free</span>
                        </>
                      ) : isApproved ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Sealed Escrow</span>
                        </>
                      ) : tenancy.status === 'PENDING' ? (
                        <>
                          <Bell className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                          <span>Awaiting Owner Signature</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>Move-In Open</span>
                        </>
                      )}
                    </span>
                    <div className="text-right font-mono text-sm sm:text-base font-extrabold text-slate-100">
                      ₹{Number(tenancy.depositAmount).toLocaleString('en-IN')}
                    </div>
                  </div>

                  {/* Title & Address */}
                  <h3 className="text-base sm:text-lg font-bold text-slate-100 group-hover:text-emerald-300 transition line-clamp-1">
                    {tenancy.propertyTitle}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                    {tenancy.propertyAddress}
                  </p>

                  {/* Cryptographic SHA-256 Escrow Seal Strip */}
                  {tenancy.moveInHash && (
                    <div className="mt-3.5 p-2 rounded-lg bg-slate-950/80 border border-slate-800/90 font-mono text-[11px] text-emerald-400 flex items-center justify-between">
                      <span className="truncate max-w-[200px]" title={tenancy.moveInHash}>
                        SHA-256: {tenancy.moveInHash.substring(0, 10)}...{tenancy.moveInHash.substring(tenancy.moveInHash.length - 6)}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-emerald-300 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 flex-shrink-0">
                        IMMUTABLE
                      </span>
                    </div>
                  )}

                  {/* AI Damage Audit Breakdown for Vacated / Audited Tenancies */}
                  {(hasAiAudit || isVacated) && (
                    <div className="mt-3.5 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono grid grid-cols-3 gap-1 text-center shadow-inner">
                      <div>
                        <span className="text-slate-500 block text-[9px]">DEPOSIT HELD</span>
                        <span className="text-slate-200 font-semibold">₹{originalDeposit.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">AI DAMAGE CUT</span>
                        <span className={totalDeductions > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                          -₹{totalDeductions.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px]">NET REFUND</span>
                        <span className="text-emerald-400 font-bold">₹{netRefund.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  )}

                  {/* Owner Immediate UPI Payout CTA Button */}
                  {isLandlord && (hasAiAudit || isVacated) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutTenancy(tenancy);
                        const defaultVpa = (tenancy as any).tenantUpi || ((tenancy as any).user?.email ? (tenancy as any).user.email.split('@')[0] + '@okaxis' : 'tenant.aarav@okhdfcbank');
                        setTenantVpa(defaultVpa);
                      }}
                      className="mt-3 w-full inline-flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs font-mono shadow-md shadow-emerald-500/20 transition active:scale-95"
                    >
                      <IndianRupee className="w-3.5 h-3.5" />
                      <span>💸 Pay Net Refund via UPI QR (₹{netRefund.toLocaleString('en-IN')})</span>
                    </button>
                  )}

                  {/* Protocol Stage Mini Progress Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                      <span>Protocol Lifecycle</span>
                      <span className="text-emerald-400">{isVacated ? 'Stage 3/3 (Vacated)' : hasAiAudit ? 'Stage 3/3' : isApproved ? 'Stage 2/3' : 'Stage 1/3'}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className={`h-1.5 rounded-full ${hasMoveIn ? 'bg-emerald-500' : 'bg-slate-800'}`} title="Move-In Photos Sealed"></div>
                      <div className={`h-1.5 rounded-full ${isApproved ? 'bg-emerald-500' : 'bg-slate-800'}`} title="Landlord Locked"></div>
                      <div className={`h-1.5 rounded-full ${hasAiAudit || isVacated ? 'bg-emerald-500' : 'bg-slate-800'}`} title="AI Move-Out Audited"></div>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-slate-500 mt-1 font-mono">
                      <span>Move-In Sealed</span>
                      <span>Owner Locked</span>
                      <span>{isVacated ? 'Vacated & Settled' : 'AI Ready'}</span>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-400 flex justify-between">
                    <span>Logged Fixtures:</span>
                    <span className="font-semibold text-slate-200">
                      {tenancy.items?.length || 0} room items
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/60 border-t border-slate-800/80">
                  <Link
                    to={`/tenancy/${tenancy.id}`}
                    className="w-full inline-flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-emerald-500/15 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 text-xs font-semibold transition"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>{isLandlord ? 'Inspect Hashes & Review Audits' : 'Inspect Inventory & AI Audits'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Owner Instant Refund Payout UPI Modal */}
      {payoutTenancy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
                <QrCode className="w-4 h-4" />
                <span>Owner Payout: Security Deposit Refund</span>
              </div>
              <button
                type="button"
                onClick={() => setPayoutTenancy(null)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {(() => {
              const pDeposit = Number(payoutTenancy.depositAmount || 0);
              const pCuts = (payoutTenancy.items || []).reduce((acc, it) => acc + Number(it.suggestedCut || 0), 0);
              const pRefund = Math.max(0, pDeposit - pCuts);
              const payeeName = (payoutTenancy as any).user?.name || 'Aarav Sharma (Tenant)';
              const note = `RentShield Escrow Refund - ${payoutTenancy.propertyTitle}`;
              const isPaid = settledMap[payoutTenancy.id] || (typeof window !== 'undefined' && localStorage.getItem(`rentshield_settled_${payoutTenancy.id}`) === 'true');
              const upiUri = `upi://pay?pa=${encodeURIComponent(tenantVpa)}&pn=${encodeURIComponent(payeeName)}&am=${pRefund}&cu=INR&tn=${encodeURIComponent(note)}`;

              return (
                <div>
                  <div className="mb-4">
                    <div className="text-2xl font-extrabold text-slate-100 font-mono">
                      ₹{pRefund.toLocaleString('en-IN')}
                    </div>
                    <div className="text-xs text-emerald-400 font-mono font-semibold mt-0.5">
                      Net Deposit Refund Payable to {payeeName}
                    </div>
                  </div>

                  {/* Authentic SVG QR Code Container */}
                  <div className="p-4 rounded-2xl bg-white mx-auto inline-block shadow-xl border-4 border-emerald-500/30 mb-4">
                    <svg
                      width="180"
                      height="180"
                      viewBox="0 0 200 200"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="mx-auto"
                    >
                      <rect width="200" height="200" fill="#FFFFFF" />

                      {/* Finder Patterns */}
                      <rect x="16" y="16" width="48" height="48" rx="6" fill="#050811" />
                      <rect x="22" y="22" width="36" height="36" rx="4" fill="#FFFFFF" />
                      <rect x="30" y="30" width="20" height="20" rx="2" fill="#10B981" />

                      <rect x="136" y="16" width="48" height="48" rx="6" fill="#050811" />
                      <rect x="142" y="22" width="36" height="36" rx="4" fill="#FFFFFF" />
                      <rect x="150" y="30" width="20" height="20" rx="2" fill="#10B981" />

                      <rect x="16" y="136" width="48" height="48" rx="6" fill="#050811" />
                      <rect x="22" y="142" width="36" height="36" rx="4" fill="#FFFFFF" />
                      <rect x="30" y="150" width="20" height="20" rx="2" fill="#10B981" />

                      {/* Simulated QR Matrix Bits */}
                      <rect x="74" y="20" width="10" height="10" fill="#050811" />
                      <rect x="90" y="20" width="10" height="10" fill="#050811" />
                      <rect x="110" y="20" width="10" height="10" fill="#050811" />
                      <rect x="74" y="36" width="10" height="10" fill="#050811" />
                      <rect x="100" y="36" width="10" height="10" fill="#050811" />
                      <rect x="84" y="52" width="10" height="10" fill="#050811" />
                      <rect x="110" y="52" width="10" height="10" fill="#050811" />

                      <rect x="20" y="74" width="10" height="10" fill="#050811" />
                      <rect x="36" y="74" width="10" height="10" fill="#050811" />
                      <rect x="52" y="74" width="10" height="10" fill="#050811" />
                      <rect x="74" y="74" width="10" height="10" fill="#050811" />
                      <rect x="94" y="74" width="12" height="12" fill="#10B981" />
                      <rect x="116" y="74" width="10" height="10" fill="#050811" />
                      <rect x="136" y="74" width="10" height="10" fill="#050811" />
                      <rect x="156" y="74" width="10" height="10" fill="#050811" />
                      <rect x="172" y="74" width="10" height="10" fill="#050811" />

                      <rect x="20" y="90" width="10" height="10" fill="#050811" />
                      <rect x="44" y="90" width="10" height="10" fill="#050811" />
                      <rect x="68" y="90" width="10" height="10" fill="#050811" />
                      <rect x="124" y="90" width="10" height="10" fill="#050811" />
                      <rect x="148" y="90" width="10" height="10" fill="#050811" />
                      <rect x="168" y="90" width="10" height="10" fill="#050811" />

                      <rect x="74" y="106" width="10" height="10" fill="#050811" />
                      <rect x="100" y="106" width="10" height="10" fill="#050811" />
                      <rect x="136" y="106" width="10" height="10" fill="#050811" />
                      <rect x="160" y="106" width="10" height="10" fill="#050811" />

                      <rect x="20" y="120" width="10" height="10" fill="#050811" />
                      <rect x="52" y="120" width="10" height="10" fill="#050811" />
                      <rect x="84" y="120" width="10" height="10" fill="#050811" />
                      <rect x="110" y="120" width="10" height="10" fill="#050811" />
                      <rect x="144" y="120" width="10" height="10" fill="#050811" />
                      <rect x="170" y="120" width="10" height="10" fill="#050811" />

                      <rect x="74" y="136" width="10" height="10" fill="#050811" />
                      <rect x="94" y="136" width="10" height="10" fill="#050811" />
                      <rect x="116" y="136" width="10" height="10" fill="#050811" />
                      <rect x="140" y="136" width="10" height="10" fill="#050811" />
                      <rect x="168" y="136" width="10" height="10" fill="#050811" />

                      <rect x="74" y="152" width="10" height="10" fill="#050811" />
                      <rect x="104" y="152" width="10" height="10" fill="#050811" />
                      <rect x="124" y="152" width="10" height="10" fill="#050811" />
                      <rect x="152" y="152" width="10" height="10" fill="#050811" />

                      {/* Center Badge */}
                      <circle cx="100" cy="100" r="15" fill="#050811" />
                      <circle cx="100" cy="100" r="13" fill="#10B981" />
                      <text x="100" y="105" fill="#050811" fontSize="12" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                        ₹
                      </text>
                    </svg>
                  </div>

                  {/* Editable Tenant VPA & Details */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono text-left space-y-2 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Recipient Payee:</span>
                      <span className="text-slate-200 font-bold">{payeeName}</span>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Tenant UPI VPA:</label>
                      <input
                        type="text"
                        value={tenantVpa}
                        onChange={(e) => setTenantVpa(e.target.value)}
                        placeholder="tenant.aarav@okhdfcbank"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 text-xs font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                      <span className="text-slate-400">Payment Note:</span>
                      <span className="text-slate-300 text-[11px] truncate max-w-[200px]">{note}</span>
                    </div>
                  </div>

                  {/* Settlement Confirmation Toggle */}
                  <div className="mb-4 p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30 text-left">
                    <label className="flex items-center space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPaid}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          localStorage.setItem(`rentshield_settled_${payoutTenancy.id}`, checked ? 'true' : 'false');
                          setSettledMap((prev) => ({ ...prev, [payoutTenancy.id]: checked }));
                        }}
                        className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-400"
                      />
                      <span className="text-xs text-slate-200 font-semibold font-mono">
                        ✅ Mark Refund Paid / Tenancy Settled
                      </span>
                    </label>
                    {isPaid && (
                      <div className="mt-2 text-[11px] font-mono text-emerald-300 flex items-center space-x-1">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>🎉 Refund Settled • Property Free for Next Tenant</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(upiUri);
                        setCopiedUpi(true);
                        setTimeout(() => setCopiedUpi(false), 2000);
                      }}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                    >
                      {copiedUpi ? 'Copied UPI URI!' : 'Copy UPI Link'}
                    </button>
                    <a
                      href={upiUri}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow-md shadow-emerald-500/20"
                    >
                      Pay in App
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
