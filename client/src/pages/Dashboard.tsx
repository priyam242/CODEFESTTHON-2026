import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Plus, Building, IndianRupee, ArrowRight, CheckCircle2, Clock, FileCheck, KeyRound, Zap } from 'lucide-react';
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

  const navigate = useNavigate();
  const user = authApi.getCurrentUser();

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
      setError(err?.response?.data?.message || err?.message || 'Failed to fetch tenancies');
    } finally {
      setLoading(false);
    }
  }, []);

  // Multi-tab real-time sync (updates automatically without page refresh when Tab 1 mutates)
  const { isLiveSynced } = useLiveSync(loadTenancies, 4000);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadTenancies();
  }, [user, navigate, loadTenancies]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimToken.trim()) return;
    setClaiming(true);
    setClaimMsg(null);
    try {
      await api.post(`/tenancy/claim/${claimToken.trim()}`);
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner / Hero */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {isLandlord ? 'Property Owner & Landlord Dashboard' : 'Tenant Deposit Protection Portal'}
            </span>
            {isLiveSynced && (
              <span className="inline-flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                <Zap className="w-3 h-3 text-emerald-400" />
                <span>Live Synced Just Now</span>
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            {isLandlord ? `Welcome back, ${user?.name || user?.email}` : 'Protected Tenancy Deposits'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
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
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 text-xs font-semibold transition shadow-sm"
              title="Restore fresh 2BHK Bangalore demo tenancy"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{resettingDemo ? 'Resetting...' : '⚡ Reset Demo State'}</span>
            </button>
            <Link
              to="/tenancy/new"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/20"
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-medium mb-2">
            <span>{isLandlord ? 'Total Managed Deposits' : 'Total Protected Deposits'}</span>
            <IndianRupee className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono">
            ₹{totalDeposit.toLocaleString('en-IN')}
          </div>
          <div className="mt-1 text-xs text-emerald-400 flex items-center space-x-1">
            <Shield className="w-3.5 h-3.5" />
            <span>Cryptographically sealed</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-medium mb-2">
            <span>{isLandlord ? 'Linked Properties' : 'Active Tenancies'}</span>
            <Building className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {tenancies.length}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {isLandlord ? 'Properties matching your owner account' : 'Secure lease agreements'}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-xl">
          <div className="flex items-center justify-between text-slate-400 text-xs uppercase tracking-wider font-medium mb-2">
            <span>{isLandlord ? 'Sealed by You' : 'Landlord Approved'}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-100">
            {totalApproved} / {tenancies.length}
          </div>
          <div className="mt-1 text-xs text-emerald-400">
            {totalApproved === tenancies.length && tenancies.length > 0
              ? 'All inventories locked'
              : 'Pending sign-offs'}
          </div>
        </div>
      </div>

      {/* Tenancies List Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-100">
          {isLandlord ? 'Properties Linked to Your Owner Account' : 'Your Tenancy Agreements'}
        </h2>
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
          {tenancies.map((tenancy) => (
            <div
              key={tenancy.id}
              className="group rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 transition duration-200 overflow-hidden backdrop-blur-md flex flex-col justify-between shadow-lg shadow-black/20"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <span
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                      tenancy.status === 'APPROVED'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {tenancy.status === 'APPROVED' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Sealed & Approved</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        <span>Pending Approval</span>
                      </>
                    )}
                  </span>
                  <div className="text-right font-mono text-sm font-bold text-slate-100">
                    ₹{Number(tenancy.depositAmount).toLocaleString('en-IN')}
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-100 group-hover:text-emerald-300 transition line-clamp-1">
                  {tenancy.propertyTitle}
                </h3>
                <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                  {tenancy.propertyAddress}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-400 space-y-1.5">
                  <div className="flex justify-between">
                    <span>{isLandlord ? 'Tenant ID:' : 'Landlord:'}</span>
                    <span className="font-medium text-slate-300">
                      {isLandlord ? `${tenancy.userId.substring(0, 8)}...` : tenancy.landlordName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Logged Items:</span>
                    <span className="font-medium text-slate-300">
                      {tenancy.items?.length || 0} room items
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-950/40 border-t border-slate-800">
                <Link
                  to={`/tenancy/${tenancy.id}`}
                  className="w-full inline-flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-slate-900 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/30 text-emerald-400 text-xs font-semibold transition"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>{isLandlord ? 'Inspect Hashes & Review Audits' : 'Inspect Inventory & AI Audits'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
