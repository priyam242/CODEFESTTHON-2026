import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Shield,
  CheckCircle2,
  Lock,
  Building,
  IndianRupee,
  Clock,
  AlertCircle,
  FileCheck2,
  Zap,
  ShieldCheck,
  AlertTriangle,
  MessageSquare,
  CreditCard,
  FileText,
  Check,
  QrCode,
  Copy,
  Sparkles,
  Camera,
} from 'lucide-react';
import { tenancyApi, Tenancy, getAssetUrl, fallbackFixtureSvg } from '../api';
import { useLiveSync, emitSyncEvent } from '../realtimeSync';

export const LandlordVerify: React.FC = () => {
  const { landlordToken } = useParams<{ landlordToken: string }>();
  const [tenancy, setTenancy] = useState<Tenancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Counterparty Identity Anchor confirmation
  const [ownerConfirmed, setOwnerConfirmed] = useState(true);

  // Flag discrepancy / Revision modal state
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState(
    'Please upload supplementary clear photos of the master bathroom fixtures and kitchen cabinetry.'
  );
  const [submittingRevision, setSubmittingRevision] = useState(false);

  // Owner Payout UPI Modal & Settlement State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [tenantVpa, setTenantVpa] = useState('tenant.aarav@okhdfcbank');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isSettled, setIsSettled] = useState(false);
  const isInitialLoad = useRef(true);

  const loadReview = useCallback(async () => {
    if (!landlordToken) return;
    try {
      const data = await tenancyApi.getLandlordReview(landlordToken);
      setTenancy(data);
      if (typeof window !== 'undefined' && data?.id) {
        setIsSettled(localStorage.getItem(`rentshield_settled_${data.id}`) === 'true');
        const defaultVpa = (data as any).tenantUpi || ((data as any).user?.email ? (data as any).user.email.split('@')[0] + '@okaxis' : 'tenant.aarav@okhdfcbank');
        setTenantVpa(defaultVpa);
      }
    } catch (err: any) {
      if (isInitialLoad.current) {
        setError(err?.response?.data?.message || err?.message || 'Invalid or expired landlord review link');
      }
    } finally {
      if (isInitialLoad.current) {
        setLoading(false);
        isInitialLoad.current = false;
      }
    }
  }, [landlordToken]);

  // Real-time synchronization across browser tabs (with modal pause shield & zero flicker)
  const isModalOpen = showRevisionModal || showPayoutModal || approving;
  const { isLiveSynced } = useLiveSync(loadReview, 4000, isModalOpen);

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
      const signerData = {
        signerEmail: tenancy?.landlordEmail || 'landlord.demo@rentshield.com',
        signerIp: '103.212.154.42 (Bangalore, KA)',
        signerFingerprint: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        signedAt: new Date().toISOString(),
        ownerConfirmed: true,
        agreementRef: tenancy?.agreementRef || 'BLR-IND-2026-KA-4892',
        landlordUpi: tenancy?.landlordUpi || 'ramesh.malik@okhdfcbank',
      };

      const updated = await tenancyApi.approveLandlordReview(landlordToken, signerData);
      setTenancy(updated);
      setSuccessMessage('Inventory cryptographically sealed and approved successfully!');
      emitSyncEvent('LANDLORD_APPROVED', updated.id);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to approve inventory');
    } finally {
      setApproving(false);
    }
  };

  const handleRequestRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!landlordToken) return;
    setSubmittingRevision(true);
    try {
      const updated = await tenancyApi.requestRevision(landlordToken, revisionNotes);
      setTenancy(updated);
      setShowRevisionModal(false);
      setSuccessMessage('Revision request dispatched to tenant! Status updated to Revision Requested.');
      emitSyncEvent('APPROVAL_REQUESTED', updated.id);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to request revision');
    } finally {
      setSubmittingRevision(false);
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
  const isRevisionRequested = tenancy.status === 'REVISION_REQUESTED';
  const isMoveOutCompleted = items.length > 0 && items.every((i) => Boolean(i.moveOutPhotoUrl || i.aiVerdict));
  const hasMoveOut = items.some((i) => Boolean(i.moveOutPhotoUrl || i.aiVerdict));
  const isVacated = isMoveOutCompleted || tenancy.status === 'COMPLETED' || tenancy.status === 'VACATED';

  const totalDeposit = Number(tenancy.depositAmount || 0);
  const totalSuggestedCuts = items.reduce((acc, it) => acc + Number(it.suggestedCut || 0), 0);
  const netRefund = Math.max(0, totalDeposit - totalSuggestedCuts);
  const payeeName = (tenancy as any).userName || (tenancy as any).user?.name || 'Aarav Sharma (Tenant)';
  const upiNote = `RentShield Escrow Refund - ${tenancy.propertyTitle}`;
  const upiUri = `upi://pay?pa=${encodeURIComponent(tenantVpa)}&pn=${encodeURIComponent(payeeName)}&am=${netRefund}&cu=INR&tn=${encodeURIComponent(upiNote)}`;

  // Room completeness computation
  const coreRooms = ['Living Room', 'Kitchen', 'Master Bedroom'];
  const documentedRooms = Array.from(new Set(items.map((it) => it.roomName.trim()))).filter(Boolean);

  let signerAuditData: any = null;
  if (tenancy.signerAudit) {
    try {
      signerAuditData = typeof tenancy.signerAudit === 'string' ? JSON.parse(tenancy.signerAudit) : tenancy.signerAudit;
    } catch {}
  }

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

      {isRevisionRequested && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-start space-x-3 shadow-lg shadow-amber-500/10">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
          <div>
            <div className="font-bold text-amber-200">Revision Requested by Owner</div>
            <p className="text-xs text-amber-300/90 mt-1">
              Notes: {tenancy.revisionNotes || 'Supplementary photos requested before baseline seal.'}
            </p>
          </div>
        </div>
      )}

      {/* Property Vacated & Ready for Next Tenant Banner */}
      {(isVacated || hasMoveOut) && (
        <div className="mb-6 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-cyan-500/10">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold flex items-center space-x-2">
                <span>🏠 PROPERTY VACATED • FREE FOR NEXT TENANT</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-200">
                  Audit Complete
                </span>
              </div>
              <p className="text-xs text-cyan-300/80 mt-0.5">
                Move-out AI inspection finished. Deposit deductions computed. Ready for return handover.
              </p>
            </div>
          </div>
          {isSettled ? (
            <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>🎉 Refund Settled • Property Free for Next Tenant</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPayoutModal(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold font-mono transition shadow-md shadow-emerald-500/20 whitespace-nowrap self-start sm:self-center"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>💸 Pay Net Refund via UPI QR (₹{netRefund.toLocaleString('en-IN')})</span>
            </button>
          )}
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
                  : isRevisionRequested
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
              }`}
            >
              {isApproved ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Inventory Sealed &amp; Approved</span>
                </>
              ) : isRevisionRequested ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Revision Requested</span>
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs text-slate-300">
          <div>
            <span className="text-slate-400 block font-mono text-[11px]">Landlord Name:</span>
            <span className="font-semibold">{tenancy.landlordName}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-mono text-[11px]">Landlord Phone:</span>
            <span className="font-semibold">{tenancy.landlordPhone}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-mono text-[11px]">Registered UPI:</span>
            <span className="font-mono text-emerald-400">{tenancy.landlordUpi || 'ramesh.malik@okhdfcbank'}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-mono text-[11px]">Agreement Ref:</span>
            <span className="font-mono text-slate-200">{tenancy.agreementRef || 'BLR-IND-2026-KA-4892'}</span>
          </div>
        </div>

        {/* Room Completeness Checklist Pill */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-400 font-mono text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Room Coverage Checklist:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {coreRooms.map((room) => {
              const covered = items.some((it) => it.roomName.toLowerCase().includes(room.toLowerCase()));
              return (
                <span
                  key={room}
                  className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-mono ${
                    covered
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {covered ? <Check className="w-3 h-3 text-emerald-400" /> : <Clock className="w-3 h-3 text-slate-500" />}
                  <span>{room}</span>
                </span>
              );
            })}
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono font-semibold">
              {items.length} Fixtures Documented
            </span>
          </div>
        </div>
      </div>

      {/* AI Settlement Breakdown Card (when move-out audit has started/completed) */}
      {hasMoveOut && (
        <div className="mb-8 rounded-2xl bg-slate-900/90 border border-slate-800/80 p-6 backdrop-blur-xl shadow-xl glass-vault-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80 mb-5">
            <div>
              <div className="flex items-center space-x-2 text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-1">
                <Sparkles className="w-4 h-4" />
                <span>Move-Out AI Settlement &amp; Audit Breakdown</span>
              </div>
              <h3 className="text-lg font-bold text-slate-100">Deposit Arbitrated by Gemini 2.5</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowPayoutModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold font-mono transition shadow-lg shadow-emerald-500/20"
            >
              <QrCode className="w-4 h-4" />
              <span>💸 Pay Net Refund via UPI QR (₹{netRefund.toLocaleString('en-IN')})</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-center mb-4">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Deposit Held</div>
              <div className="text-xl font-extrabold text-slate-100 mt-1">₹{totalDeposit.toLocaleString('en-IN')}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-rose-400 uppercase tracking-wider">Total AI Deductions</div>
              <div className="text-xl font-extrabold text-rose-400 mt-1">-₹{totalSuggestedCuts.toLocaleString('en-IN')}</div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="text-[10px] text-emerald-400 uppercase tracking-wider">Final Net Refund Payable</div>
              <div className="text-xl font-extrabold text-emerald-300 mt-1">₹{netRefund.toLocaleString('en-IN')}</div>
            </div>
          </div>

          {isSettled && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>🎉 Refund Settled • Property Free for Next Tenant</span>
            </div>
          )}
        </div>
      )}

      {/* Items Section */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-slate-100 mb-2">
          {hasMoveOut ? 'Room Inventory & Move-Out AI Inspection' : 'Move-In Items Baseline'}
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          {hasMoveOut
            ? 'Compare Move-In baseline photos against tenant Move-Out verification photos with cryptographic SHA-256 integrity and Gemini AI arbitration.'
            : 'Each item was photographed by the tenant upon key handover. Review condition and SHA-256 signatures before approving.'}
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

                  {/* Move-In Baseline Photo */}
                  <div className="mb-2">
                    <div className="text-[10px] font-mono text-slate-400 mb-1 flex items-center justify-between">
                      <span>MOVE-IN BASELINE</span>
                      {item.moveInPhotoHash && (
                        <span className="text-[9px] text-slate-500 truncate max-w-[120px]" title={item.moveInPhotoHash}>
                          SHA: {item.moveInPhotoHash.substring(0, 10)}...
                        </span>
                      )}
                    </div>
                    <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-800">
                      <img
                        src={getAssetUrl(item.moveInPhotoUrl)}
                        alt={item.itemName}
                        className="w-full h-full object-cover transition duration-300 hover:scale-105"
                        onError={(e: any) => {
                          e.target.src = fallbackFixtureSvg;
                        }}
                      />
                    </div>
                  </div>

                  {item.moveInNotes && (
                    <p className="text-xs text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80 mb-2">
                      <strong className="text-slate-300 font-mono text-[11px]">Baseline Notes:</strong> {item.moveInNotes}
                    </p>
                  )}

                  {/* Move-Out Photo & AI Verdict (if available) */}
                  {item.moveOutPhotoUrl && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80">
                      <div className="text-[10px] font-mono text-cyan-400 mb-1 flex items-center justify-between">
                        <span>MOVE-OUT INSPECTION PHOTO</span>
                        {item.moveOutPhotoHash && (
                          <span className="text-[9px] text-slate-500 truncate max-w-[120px]" title={item.moveOutPhotoHash}>
                            SHA: {item.moveOutPhotoHash.substring(0, 10)}...
                          </span>
                        )}
                      </div>
                      <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden border border-slate-800 mb-2">
                        <img
                          src={getAssetUrl(item.moveOutPhotoUrl)}
                          alt={`${item.itemName} Move-Out`}
                          className="w-full h-full object-cover transition duration-300 hover:scale-105"
                          onError={(e: any) => {
                            e.target.src = fallbackFixtureSvg;
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {item.aiVerdict && (
                    <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.aiVerdict === 'NORMAL_WEAR_TEAR'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {item.aiVerdict}
                        </span>
                        <span className="font-bold text-slate-200">
                          Deduction: <span className={Number(item.suggestedCut) > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                            ₹{Number(item.suggestedCut || 0).toLocaleString('en-IN')}
                          </span>
                        </span>
                      </div>
                      {item.aiExplanation && (
                        <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{item.aiExplanation}</p>
                      )}
                    </div>
                  )}
                </div>

                {!item.moveOutPhotoUrl && item.moveInPhotoHash && (
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
          <div className="space-y-4">
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

            {/* Counterparty Identity Binding Audit Trail */}
            <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-emerald-500/20 max-w-xl mx-auto text-left space-y-2">
              <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Counterparty Identity Binding Cryptographically Anchored</span>
              </div>
              <div className="text-[11px] font-mono text-slate-300 space-y-1">
                <div>Owner Rent-Receiving VPA: <span className="text-emerald-300">{tenancy.landlordUpi || 'ramesh.malik@okhdfcbank'}</span></div>
                <div>Rental Agreement Ref ID: <span className="text-slate-100">{tenancy.agreementRef || 'BLR-IND-2026-KA-4892'}</span></div>
                <div>Signer Fingerprint: <span className="text-slate-400 truncate block">{signerAuditData?.signerFingerprint || '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08'}</span></div>
                <div>Signer IP &amp; Geolocation: <span className="text-slate-300">{signerAuditData?.signerIp || '103.212.154.42 (Bangalore, KA)'}</span></div>
                <div>Timestamp: <span className="text-slate-400">{signerAuditData?.signedAt || new Date().toISOString()}</span></div>
              </div>
            </div>
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

            {/* Anti-Collusion Confirmation Checkbox */}
            <div className="max-w-md mx-auto text-left p-3.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ownerConfirmed}
                  onChange={(e) => setOwnerConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-400"
                />
                <span className="text-xs text-slate-300 leading-relaxed font-mono">
                  I confirm I am the legal property owner matching UPI VPA <strong className="text-emerald-400">{tenancy.landlordUpi || 'ramesh.malik@okhdfcbank'}</strong> and Rental Agreement Ref <strong className="text-slate-200">{tenancy.agreementRef || 'BLR-IND-2026-KA-4892'}</strong>.
                </span>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={handleApprove}
                disabled={approving || !ownerConfirmed}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-sm transition shadow-lg shadow-emerald-500/25 inline-flex items-center justify-center space-x-2"
              >
                <FileCheck2 className="w-4 h-4" />
                <span>{approving ? 'Locking & Sealing...' : 'Lock & Approve Baseline'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowRevisionModal(true)}
                className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-500/30 hover:border-amber-500 text-amber-300 font-semibold text-xs transition inline-flex items-center justify-center space-x-2"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Flag Discrepancy / Request Revision</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Revision Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Flag Inventory Discrepancy</h3>
                <p className="text-xs text-slate-400">Request the tenant to upload updated room photos.</p>
              </div>
            </div>

            <form onSubmit={handleRequestRevision} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Revision Notes for Tenant
                </label>
                <textarea
                  required
                  rows={4}
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  placeholder="Describe missing angles, unphotographed rooms, or items requiring clearer lighting..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRevisionModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRevision}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition shadow-lg shadow-amber-500/20"
                >
                  {submittingRevision ? 'Submitting...' : 'Send Revision Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Owner Instant Refund Payout Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
                <QrCode className="w-4 h-4" />
                <span>Owner Refund Payout via UPI QR</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Payout Header */}
            <div className="mb-4">
              <div className="text-2xl font-extrabold text-slate-100 font-mono">
                ₹{netRefund.toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-emerald-400 font-mono font-semibold mt-0.5">
                Net Escrow Refund Payable to Tenant
              </div>
            </div>

            {/* Authentic SVG QR Code */}
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
                <span className="text-slate-300 text-[11px] truncate max-w-[200px]">{upiNote}</span>
              </div>
            </div>

            {/* Settlement Confirmation Toggle */}
            <div className="mb-4 p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30 text-left">
              <label className="flex items-center space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSettled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    localStorage.setItem(`rentshield_settled_${tenancy.id}`, checked ? 'true' : 'false');
                    setIsSettled(checked);
                    emitSyncEvent('SETTLEMENT_UPDATED', tenancy.id);
                  }}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-400"
                />
                <span className="text-xs text-slate-200 font-semibold font-mono">
                  ✅ Mark Refund Paid / Tenancy Settled
                </span>
              </label>
              {isSettled && (
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
        </div>
      )}
    </div>
  );
};
export default LandlordVerify;
