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
  Receipt,
  RotateCcw,
  CreditCard,
} from 'lucide-react';
import { Tenancy, tenancyApi, authApi, api } from '../api';
import { useLiveSync, emitSyncEvent } from '../realtimeSync';
import { PaymentModal } from '../components/PaymentModal';
import { SocietyGatePassModal } from '../components/SocietyGatePassModal';
import { EscrowReceiptModal } from '../components/EscrowReceiptModal';
import { getEscrowState } from '../utils/escrowSequence';

export const Dashboard: React.FC = () => {
  const [tenancies, setTenancies] = useState<Tenancy[]>(() => tenancyApi.getCachedTenancies() || []);
  const [loading, setLoading] = useState(() => !tenancyApi.getCachedTenancies()?.length);
  const [error, setError] = useState<string | null>(null);
  const [claimToken, setClaimToken] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [resettingDemo, setResettingDemo] = useState(false);

  // Society Move-Out Gate Pass & No-Dues NOC Modal State
  const [showGatePassModal, setShowGatePassModal] = useState(false);
  const [gatePassTenancy, setGatePassTenancy] = useState<Tenancy | null>(null);

  // Escrow Settlement Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptTenancy, setReceiptTenancy] = useState<Tenancy | null>(null);

  // Real Phone-Scannable Payment & Settlement Modal State
  const [selectedPaymentTenancy, setSelectedPaymentTenancy] = useState<Tenancy | null>(null);
  const [paymentModalStage, setPaymentModalStage] = useState<'DEPOSIT' | 'SETTLEMENT'>('SETTLEMENT');
  const [isRecipientSettingsOnly, setIsRecipientSettingsOnly] = useState(false);
  const [settledMap, setSettledMap] = useState<Record<string, boolean>>({});

  const navigate = useNavigate();
  const user = authApi.getCurrentUser();
  const isInitialLoad = useRef(true);

  // Hydrate settlement states from localStorage and backend status
  useEffect(() => {
    const map: Record<string, boolean> = {};
    tenancies.forEach((t) => {
      if (t.status === 'SETTLED' || localStorage.getItem(`rentshield_settled_${t.id}`) === 'true') {
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
      setTenancies(Array.isArray(data) ? data : []);
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
  const isModalOpen = selectedPaymentTenancy !== null || resettingDemo;
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

  const isLandlord = user?.role === 'LANDLORD';

  // Helper to determine if tenancy is settled
  const isSettledTenancy = (t: Tenancy) => {
    return t.status === 'SETTLED' || settledMap[t.id] || (typeof window !== 'undefined' && localStorage.getItem(`rentshield_settled_${t.id}`) === 'true');
  };

  // Sort Active tenancies strictly newest-first (createdAt descending)
  const safeTenancies = Array.isArray(tenancies) ? tenancies : [];
  const activeTenancies = safeTenancies
    .filter((t) => !isSettledTenancy(t))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Sort Settled History tenancies strictly newest-first (settledAt / createdAt descending)
  const settledTenancies = safeTenancies
    .filter((t) => isSettledTenancy(t))
    .sort((a, b) => {
      const timeA = new Date(a.settledAt || a.createdAt).getTime();
      const timeB = new Date(b.settledAt || b.createdAt).getTime();
      return timeB - timeA;
    });

  const totalActiveDeposit = activeTenancies
    .filter((t) => Boolean(t.depositPaid))
    .reduce((acc, t) => acc + Number(t.depositAmount || 0), 0);
  const totalActiveApproved = activeTenancies.filter((t) => t.status === 'APPROVED').length;
  const pendingApprovals = isLandlord ? activeTenancies.filter((t) => t.status === 'PENDING') : [];

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
                        <span>Review &amp; Cryptographically Seal Tenancy</span>
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
                      <span>Review &amp; Sign Inventory</span>
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
        {/* Card 1: Active Escrow Deposits */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 backdrop-blur-xl shadow-xl relative overflow-hidden group hover:border-emerald-500/30 transition">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>
          <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-medium mb-2">
            <span>{isLandlord ? 'Active Managed Deposits' : 'Active Protected Deposits'}</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <IndianRupee className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono tracking-tight">
            ₹{totalActiveDeposit.toLocaleString('en-IN')}
          </div>
          <div className="mt-2 text-xs text-emerald-400 flex items-center space-x-1.5 font-mono">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="text-[11px]">{activeTenancies.length} Active Escrow Contract{activeTenancies.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        {/* Card 2: Active Properties */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 backdrop-blur-xl shadow-xl relative overflow-hidden group hover:border-emerald-500/30 transition">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent"></div>
          <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-medium mb-2">
            <span>{isLandlord ? 'Active Properties' : 'Active Tenancies'}</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Building className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono tracking-tight">
            {activeTenancies.length}
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center space-x-1.5 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span className="text-[11px]">{isLandlord ? 'Pending or locked tenancies' : 'Current living addresses'}</span>
          </div>
        </div>

        {/* Card 3: Settled History */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800/80 backdrop-blur-xl shadow-xl relative overflow-hidden group hover:border-emerald-500/30 transition">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent"></div>
          <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-medium mb-2">
            <span>{isLandlord ? 'Settled & Free Units' : 'Settled Past Homes'}</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-300 font-mono tracking-tight">
            {settledTenancies.length}
          </div>
          <div className="mt-2 text-xs text-emerald-400 flex items-center space-x-1.5 font-mono">
            <span className="text-[11px]">
              {settledTenancies.length > 0 ? 'Archived in Past History stack' : 'None settled yet'}
            </span>
          </div>
        </div>
      </div>

      {/* ACTIVE TENANCIES SECTION */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <h2 className="text-lg font-bold text-slate-100">
            {isLandlord ? 'Active Properties & Escrow Obligations' : 'Active Tenancies & Current Obligations'}
          </h2>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {activeTenancies.length} Active • Sorted Newest → Oldest
        </span>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm font-mono">
          Loading protected tenancies...
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      ) : activeTenancies.length === 0 ? (
        // When active is 0, check if settled tenancies exist
        settledTenancies.length > 0 ? (
          <div className="text-center py-12 px-6 rounded-2xl bg-gradient-to-br from-slate-900/90 via-emerald-950/20 to-slate-900/90 border border-emerald-500/30 shadow-xl mb-6">
            <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 inline-flex mb-3 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-100">
              {isLandlord ? 'All Managed Properties Settled & Free!' : 'All Escrow Obligations Settled & Cleared!'}
            </h3>
            <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
              {isLandlord
                ? 'All your past units have completed move-out audits, deposits are refunded, and units are ready for your next tenants.'
                : 'Zero active deductions or disputes pending. Your past deposit records are cryptographically archived in the Past History stack below, and you are 100% free for your next home.'}
            </p>
            {!isLandlord && (
              <div className="mt-5">
                <Link
                  to="/tenancy/new"
                  className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Protect New Home Deposit</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
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
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTenancies.map((tenancy) => {
            const escrow = getEscrowState(tenancy);
            const hasMoveIn = (tenancy.items?.length || 0) > 0;
            const isApproved = tenancy.status === 'APPROVED' || escrow.isOwnerSealed;
            const hasAiAudit = tenancy.items?.some((i) => i.aiVerdict);
            const totalDeductions = escrow.totalDeductions;
            const originalDeposit = escrow.originalDeposit;
            const netRefund = escrow.netRefund;
            const isVacated = escrow.allItemsAudited || tenancy.status === 'COMPLETED' || tenancy.status === 'VACATED';

            // 6-step progress calculation
            const isStep1Done = hasMoveIn;
            const isStep2Done = isApproved || tenancy.status === 'LOCKED' || tenancy.status === 'SETTLED' || Boolean(tenancy.signerAudit);
            const isStep3Done = Boolean(tenancy.depositPaid);
            const isStep4Done = isStep3Done && isVacated;
            const isStep5Done = tenancy.status === 'SETTLED';
            const isStep6Done = tenancy.status === 'SETTLED';
            const completedCount = [isStep1Done, isStep2Done, isStep3Done, isStep4Done, isStep5Done, isStep6Done].filter(Boolean).length;

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
                      <span>🏠 PROPERTY VACATED • READY TO SETTLE</span>
                    </div>
                  )}

                  {/* Status, Progress & Deposit Amount */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                      <span
                        className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                          isApproved
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25'
                            : tenancy.status === 'PENDING'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 animate-pulse'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                        }`}
                      >
                        {isApproved ? (
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
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-emerald-400 font-bold">
                        {completedCount}/6 Sealed
                      </span>
                    </div>
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

                  {/* STAGE 1: Move-In Escrow Deposit Pay Button for Unfunded Tenancy */}
                  {!tenancy.depositPaid && (
                    tenancy.pendingPaymentStage === 'DEPOSIT_SENT' ? (
                      isLandlord ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentModalStage('DEPOSIT');
                            setIsRecipientSettingsOnly(false);
                            setSelectedPaymentTenancy(tenancy);
                          }}
                          className="mt-3 w-full inline-flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs font-mono shadow-md shadow-emerald-500/20 transition active:scale-95 animate-pulse"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>✅ Confirm ₹{originalDeposit.toLocaleString('en-IN')} Deposit Received</span>
                        </button>
                      ) : (
                        <div className="mt-3 py-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono text-amber-300 text-center font-bold flex items-center justify-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                          <span>⏳ Deposit Sent • Awaiting Owner Confirmation</span>
                        </div>
                      )
                    ) : (
                      !isLandlord ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentModalStage('DEPOSIT');
                            setIsRecipientSettingsOnly(false);
                            setSelectedPaymentTenancy(tenancy);
                          }}
                          className="mt-3 w-full inline-flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs font-mono shadow-md shadow-emerald-500/20 transition active:scale-95"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>💳 Pay Security Deposit (₹{originalDeposit.toLocaleString('en-IN')})</span>
                        </button>
                      ) : (
                        <div className="mt-3 flex items-center space-x-2">
                          <div className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-amber-400 text-center font-bold">
                            ⏳ Awaiting Deposit: ₹{originalDeposit.toLocaleString('en-IN')}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentModalStage('DEPOSIT');
                              setIsRecipientSettingsOnly(true);
                              setSelectedPaymentTenancy(tenancy);
                            }}
                            title="Set receiving UPI ID / QR"
                            className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-mono transition"
                          >
                            ⚙️ QR
                          </button>
                        </div>
                      )
                    )
                  )}

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

                  {/* STAGE 2: Real Razorpay / Phone-Scannable UPI Settlement CTA */}
                  {(hasAiAudit || isVacated) && (
                    tenancy.pendingPaymentStage === 'REFUND_SENT' ? (
                      !isLandlord ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentModalStage('SETTLEMENT');
                            setIsRecipientSettingsOnly(false);
                            setSelectedPaymentTenancy(tenancy);
                          }}
                          className="mt-3 w-full inline-flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs font-mono shadow-md shadow-emerald-500/20 transition active:scale-95 animate-pulse"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>✅ Confirm ₹{netRefund.toLocaleString('en-IN')} Refund Received</span>
                        </button>
                      ) : (
                        <div className="mt-3 py-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] font-mono text-amber-300 text-center font-bold flex items-center justify-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                          <span>⏳ Refund Sent • Awaiting Guest Confirmation</span>
                        </div>
                      )
                    ) : totalDeductions < originalDeposit ? (
                      isLandlord ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentModalStage('SETTLEMENT');
                            setIsRecipientSettingsOnly(false);
                            setSelectedPaymentTenancy(tenancy);
                          }}
                          className="mt-3 w-full inline-flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs font-mono shadow-md shadow-emerald-500/20 transition active:scale-95"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>💸 Scan Guest QR / Pay Net Refund (₹{netRefund.toLocaleString('en-IN')})</span>
                        </button>
                      ) : (
                        <div className="mt-3 flex items-center space-x-2">
                          <div className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 text-center font-bold">
                            ⏳ Awaiting Refund: ₹{netRefund.toLocaleString('en-IN')}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentModalStage('SETTLEMENT');
                              setIsRecipientSettingsOnly(true);
                              setSelectedPaymentTenancy(tenancy);
                            }}
                            title="Set receiving UPI ID / QR"
                            className="py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition"
                          >
                            ⚙️ QR
                          </button>
                        </div>
                      )
                    ) : totalDeductions > originalDeposit ? (
                      !isLandlord ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentModalStage('SETTLEMENT');
                            setIsRecipientSettingsOnly(false);
                            setSelectedPaymentTenancy(tenancy);
                          }}
                          className="mt-3 w-full inline-flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs font-mono shadow-md shadow-rose-500/20 transition active:scale-95"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>💳 Pay Excess Damage Due (₹{(totalDeductions - originalDeposit).toLocaleString('en-IN')})</span>
                        </button>
                      ) : (
                        <div className="mt-3 py-1.5 px-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-amber-400 text-center font-bold">
                          ⏳ Awaiting Damage Payment: ₹{(totalDeductions - originalDeposit).toLocaleString('en-IN')}
                        </div>
                      )
                    ) : null
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
                      <span>{isVacated ? 'Vacated • Ready to Settle' : 'AI Ready'}</span>
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

      {/* CHRONOLOGICAL SETTLED HISTORY & PAST LOCATIONS STACK (NEWEST -> OLDEST) */}
      {settledTenancies.length > 0 && (
        <div className="mt-12 pt-8 border-t border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2.5">
                  <span>📜 Settled History &amp; Past Locations</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                    {settledTenancies.length} Settled
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isLandlord
                    ? 'Historical tenancies with complete AI damage settlements, return payouts, and archived certificates.'
                    : 'Your past rental homes with verified refund payouts, courtroom certificates, and zero lingering liability.'}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono text-slate-500 self-start sm:self-center">
              Stack Order: Newest → Oldest
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {settledTenancies.map((tenancy) => {
              const originalDeposit = Number(tenancy.depositAmount || 0);
              const totalDeductions = (tenancy.items || []).reduce((acc, it) => acc + Number(it.suggestedCut || 0), 0);
              const netSettledRefund = Math.max(0, originalDeposit - totalDeductions);
              const settledDateStr = tenancy.settledAt
                ? new Date(tenancy.settledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : new Date(tenancy.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
              const otherPartyName = isLandlord
                ? (tenancy.user?.name || (tenancy as any).userName || 'Aarav Sharma (Tenant)')
                : tenancy.landlordName;

              return (
                <div
                  key={tenancy.id}
                  className="rounded-2xl bg-slate-900/80 border border-emerald-500/25 hover:border-emerald-500/40 p-6 backdrop-blur-xl flex flex-col justify-between shadow-xl shadow-black/20 glass-vault-card relative overflow-hidden group transition duration-300"
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500"></div>

                  <div>
                    {/* Settled Badge & Date */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold font-mono uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>🎉 SETTLED &amp; ARCHIVED</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {settledDateStr}
                      </span>
                    </div>

                    {/* Title & Address */}
                    <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-300 transition line-clamp-1">
                      {tenancy.propertyTitle}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                      {tenancy.propertyAddress}
                    </p>

                    {/* Counterparty info */}
                    <div className="mt-3 py-2 px-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs font-mono flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">
                        {isLandlord ? 'Tenant:' : 'Landlord:'}
                      </span>
                      <span className="text-slate-200 font-semibold truncate max-w-[170px]">
                        {otherPartyName}
                      </span>
                    </div>

                    {/* Full Financial Breakdown */}
                    <div className="mt-3.5 p-3 rounded-xl bg-slate-950 border border-slate-800/90 text-[11px] font-mono grid grid-cols-3 gap-1 text-center shadow-inner">
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Original Deposit</span>
                        <span className="text-slate-200 font-semibold">₹{originalDeposit.toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">AI Damage Cut</span>
                        <span className={totalDeductions > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                          -₹{totalDeductions.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[9px] uppercase">Net Refund Paid</span>
                        <span className="text-emerald-400 font-bold">₹{netSettledRefund.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Verified Payment Ref ID & Sealed Hash */}
                    <div className="mt-3 space-y-1.5">
                      {(tenancy.settlementPaymentId || tenancy.depositPaymentId) && (
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-mono text-emerald-300 flex items-center justify-between">
                          <span className="text-slate-400">Payment Ref:</span>
                          <span className="font-bold">{tenancy.settlementPaymentId || tenancy.depositPaymentId}</span>
                        </div>
                      )}
                      {tenancy.moveInHash && (
                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[10px] font-mono text-slate-400 truncate" title={tenancy.moveInHash}>
                          SHA-256: {tenancy.moveInHash.substring(0, 16)}...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setGatePassTenancy(tenancy);
                        setShowGatePassModal(true);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/35 text-xs font-bold font-mono transition text-center flex items-center justify-center space-x-1.5 shadow-sm"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>🛂 View / Print Society Gate Pass &amp; NOC</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptTenancy(tenancy);
                        setShowReceiptModal(true);
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/35 text-xs font-bold font-mono transition text-center flex items-center justify-center space-x-1.5 shadow-sm"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>🧾 Download / Print Settlement Receipt</span>
                    </button>
                    <Link
                      to={`/verify?id=${tenancy.id}`}
                      className="flex-1 py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold font-mono transition text-center flex items-center justify-center space-x-1 shadow-sm"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Court Certificate</span>
                    </Link>
                    <Link
                      to={`/tenancy/${tenancy.id}`}
                      className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition text-center"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Real Razorpay / Phone-Scannable UPI QR Payment & Settlement Modal */}
      {selectedPaymentTenancy && (
        <PaymentModal
          isOpen={true}
          onClose={() => setSelectedPaymentTenancy(null)}
          tenancy={selectedPaymentTenancy}
          stage={paymentModalStage}
          currentUserRole={isLandlord ? 'LANDLORD' : 'TENANT'}
          isRecipientSettingsOnly={isRecipientSettingsOnly}
          onSettled={(updated) => {
            setTenancies((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            setSettledMap((prev) => ({ ...prev, [updated.id]: true }));
            setSelectedPaymentTenancy(null);
          }}
        />
      )}

      {/* Society Move-Out Gate Pass & No-Dues NOC Modal */}
      {showGatePassModal && gatePassTenancy && (
        <SocietyGatePassModal
          isOpen={showGatePassModal}
          onClose={() => {
            setShowGatePassModal(false);
            setGatePassTenancy(null);
          }}
          tenancy={gatePassTenancy}
        />
      )}

      {/* Official Escrow Settlement Receipt Modal */}
      {showReceiptModal && receiptTenancy && (
        <EscrowReceiptModal
          isOpen={showReceiptModal}
          onClose={() => {
            setShowReceiptModal(false);
            setReceiptTenancy(null);
          }}
          tenancy={receiptTenancy}
        />
      )}
    </div>
  );
};
export default Dashboard;
