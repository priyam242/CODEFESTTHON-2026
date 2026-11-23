import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, CheckCircle2, Lock, Building, IndianRupee, Clock, AlertCircle, FileCheck2, Zap, ShieldCheck } from 'lucide-react';
import { tenancyApi, Tenancy } from '../api';
import { useLiveSync, emitSyncEvent } from '../realtimeSync';

export const LandlordVerify: React.FC = () => {
  const { landlordToken } = useParams<{ landlordToken: string }>();
  const [tenancy, setTenancy] = useState<Tenancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadReview = useCallback(async () => {
    if (!landlordToken) return;
    try {
      const data = await tenancyApi.getLandlordReview(landlordToken);
      setTenancy(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Invalid or expired landlord review link');
    } finally {
      setLoading(false);
    }
  }, [landlordToken]);

  // Real-time synchronization: when Tenant uploads evidence in Tab 1, Tab 2 updates without refresh!
  const { isLiveSynced } = useLiveSync(loadReview, 4000);

  useEffect(() => {
    if (landlordToken) {
      loadReview();
    }
  }, [landlordToken, loadReview]);

  const handleApprove = async () => {
    if (!landlordToken) return;
    setApproving(true);
    setError(null);

    try {
      const updated = await tenancyApi.approveLandlordReview(landlordToken);
      setTenancy(updated);
      setSuccessMessage('Inventory cryptographically sealed and approved successfully!');
      emitSyncEvent('LANDLORD_APPROVED', updated.id);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to approve inventory');
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center text-slate-400 font-mono text-xs">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 mb-2 animate-pulse">
            <Shield className="w-6 h-6" />
          </div>
          <p>Loading landlord cryptographic sign-off session...</p>
        </div>
      </div>
    );
  }

  if (error || !tenancy) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center backdrop-blur-xl shadow-2xl glass-vault-card">
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 inline-flex mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-100">Verification Link Unavailable</h2>
          <p className="mt-2 text-xs text-slate-400">{error || 'Could not locate tenancy record.'}</p>
        </div>
      </div>
    );
  }

  const items = tenancy.items || [];
  const isApproved = tenancy.status === 'APPROVED';

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="text-center mb-8">
        <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 mb-3 shadow-lg shadow-emerald-500/10">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
          RentShield Landlord Portal
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
          Review the tenant&apos;s baseline room inventory and lock the deposit baseline with cryptographic SHA-256 verification.
        </p>

        {isLiveSynced && (
          <div className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
            <Zap className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Dual-Tab Realtime Broadcast Channel Active</span>
          </div>
        )}
      </div>

      {successMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center space-x-3 shadow-lg shadow-emerald-500/10">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tenancy Overview Card */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800/80 p-6 sm:p-8 backdrop-blur-xl mb-8 shadow-xl glass-vault-card relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <span
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2 font-mono ${
                isApproved
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {isApproved ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Inventory Sealed &amp; Approved</span>
                </>
              ) : (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  <span>Awaiting Landlord Approval</span>
                </>
              )}
            </span>
            <h2 className="text-xl font-bold text-slate-100">{tenancy.propertyTitle}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{tenancy.propertyAddress}</p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl text-center min-w-[180px]">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Secured Deposit</div>
            <div className="text-xl font-bold text-slate-100 font-mono mt-0.5">
              ₹{Number(tenancy.depositAmount).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-amber-400 mt-1 font-semibold font-mono">Tenant Protected</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 text-xs text-slate-300">
          <div>
            <span className="text-slate-400 block font-mono text-[11px]">Landlord Name:</span>
            <span className="font-semibold">{tenancy.landlordName}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-mono text-[11px]">Landlord Phone:</span>
            <span className="font-semibold">{tenancy.landlordPhone}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-mono text-[11px]">Logged Items:</span>
            <span className="font-semibold">{items.length} Room Fixtures</span>
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-slate-100 mb-2">Move-In Items Baseline</h3>
        <p className="text-xs text-slate-400 mb-6">
          Each item was photographed by the tenant upon key handover. Review condition and SHA-256 signatures before approving.
        </p>

        {items.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-400 text-xs">
            Tenant has not yet added any room inventory items to this tenancy.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-xl bg-slate-900/90 border border-slate-800/80 p-4 backdrop-blur-md flex flex-col justify-between glass-vault-card"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-semibold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                      {item.roomName}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-100 mb-2">{item.itemName}</h4>

                  <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-800 mb-2">
                    <img
                      src={item.moveInPhotoUrl}
                      alt={item.itemName}
                      className="w-full h-full object-cover"
                      onError={(e: any) => {
                        e.target.src =
                          'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="%23334155"><rect width="100" height="100"/><text x="50%" y="50%" fill="%2394a3b8" text-anchor="middle" dy=".3em">Item</text></svg>';
                      }}
                    />
                  </div>

                  {item.moveInNotes && (
                    <p className="text-xs text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 mb-2">
                      <strong className="text-slate-300 font-mono text-[11px]">Tenant Notes:</strong> {item.moveInNotes}
                    </p>
                  )}
                </div>

                {item.moveInPhotoHash && (
                  <div className="pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400 truncate" title={item.moveInPhotoHash}>
                    SHA-256: {item.moveInPhotoHash.substring(0, 16)}...
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Approval Card */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/80 p-6 sm:p-8 text-center shadow-xl glass-vault-card">
        {isApproved ? (
          <div className="space-y-3">
            <div className="inline-flex p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-100">
              Inventory Baseline Approved &amp; Sealed
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              This inventory has been cryptographically sealed. Both landlord and tenant have agreed on baseline wear-and-tear standards.
            </p>
            {tenancy.moveInHash && (
              <div className="inline-block mt-2 px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-amber-300">
                Seal Hash: {tenancy.moveInHash}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="inline-flex p-3 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-100">
                Confirm &amp; Lock Baseline Inventory
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                By clicking &quot;Lock &amp; Approve&quot;, you verify that the photos accurately represent the move-in condition of the ₹{Number(tenancy.depositAmount).toLocaleString('en-IN')} tenancy.
              </p>
            </div>

            <div>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/25 inline-flex items-center space-x-2"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>{approving ? 'Locking & Sealing...' : 'Lock & Approve Baseline'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default LandlordVerify;
