import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ScrollText,
  X,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ShieldAlert,
  Copy,
  Check,
  Scale,
} from 'lucide-react';
import { tenancyApi, LeaseAuditResult } from '../api';

export interface LeaseScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_PREDATORY_CLAUSE = `CLAUSE 4 — SECURITY DEPOSIT & PAINTING FORFEITURE:
The Tenant shall pay an interest-free security deposit equivalent to 10 (ten) months of monthly rent prior to handover. Upon vacating, the Landlord at their sole discretion shall deduct 1 full month of rent towards mandatory repainting, deep-cleaning, and whitewash regardless of normal wear-and-tear. Landlord reserves the right to evict the Tenant immediately with 24 hours notice for any unapproved guest or minor maintenance dispute.`;

const SAMPLE_COMPLIANT_CLAUSE = `CLAUSE 4 — STATUTORY DEPOSIT & FAIR WEAR PROTECTION (MTA 2021):
The Tenant shall maintain an interest-free refundable security deposit strictly capped at 2 (two) months of monthly rent under Section 11 of the Indian Model Tenancy Act (MTA) 2021. Normal wear-and-tear, ageing paint, and standard residential scuffs shall incur ₹0 deduction under Section 13. Structural repairs remain the Landlord's responsibility. Either party must provide a minimum 30-day written notice under Section 21.`;

export const LeaseScannerModal: React.FC<LeaseScannerModalProps> = ({ isOpen, onClose }) => {
  const [clauseText, setClauseText] = useState<string>(SAMPLE_PREDATORY_CLAUSE);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<LeaseAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleScan = async (textOverride?: string) => {
    const target = (textOverride !== undefined ? textOverride : clauseText).trim();
    if (!target) return;
    setScanning(true);
    setError(null);
    try {
      const data = await tenancyApi.auditLease(target);
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to audit rental clause');
    } finally {
      setScanning(false);
    }
  };

  const score = result?.riskScore ?? 0;
  const isHighRisk = result?.verdict === 'HIGH_RISK' || score >= 60;
  const isModerate = result?.verdict === 'MODERATE_RISK' || (score >= 25 && score < 60);

  const modalNode = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
    >
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl glass-vault-card relative">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-500" />

        <button
          type="button"
          onClick={onClose}
          title="Close Lease Scanner"
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4 pr-8">
          <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-400">
            <ScrollText className="w-6 h-6" />
          </div>
          <div>
            <div className="inline-flex items-center space-x-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
              <Sparkles className="w-3 h-3" />
              <span>Gemini 3.8 Flash • Indian Model Tenancy Act 2021</span>
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-100">
              MTA 2021 Smart Lease &amp; Deposit Clause Scanner
            </h3>
          </div>
        </div>

        {/* 1-Click Sample Presets */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[11px] font-mono text-slate-400">Quick Samples:</span>
          <button
            type="button"
            onClick={() => {
              setClauseText(SAMPLE_PREDATORY_CLAUSE);
              handleScan(SAMPLE_PREDATORY_CLAUSE);
            }}
            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/35 text-rose-300 text-[11px] font-mono font-semibold transition"
          >
            ⚠️ Predatory 10-Month Deposit &amp; Arbitrary Painting Clause
          </button>
          <button
            type="button"
            onClick={() => {
              setClauseText(SAMPLE_COMPLIANT_CLAUSE);
              handleScan(SAMPLE_COMPLIANT_CLAUSE);
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 text-[11px] font-mono font-semibold transition"
          >
            ✅ MTA 2021 Compliant Lease
          </button>
        </div>

        {/* Clause Input */}
        <textarea
          rows={5}
          value={clauseText}
          onChange={(e) => setClauseText(e.target.value)}
          placeholder="Paste any rental agreement clause, security deposit term, or painting deduction notice..."
          className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500 transition"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 font-mono flex items-center space-x-1.5">
            <Scale className="w-3.5 h-3.5 text-cyan-400" />
            <span>Checks Sec 11 (2-Mo Deposit Cap), Sec 13/15 (Wear &amp; Tear), Sec 21 (Eviction)</span>
          </div>
          <button
            type="button"
            onClick={() => handleScan()}
            disabled={scanning || !clauseText.trim()}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-400 hover:brightness-110 disabled:opacity-50 text-slate-950 font-extrabold text-xs font-mono transition shadow-lg shadow-emerald-500/20 whitespace-nowrap"
          >
            {scanning ? 'Scanning with Gemini 3.8...' : '🔍 Scan Clause for Legal Risk'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Result Panel */}
        {result && !scanning && (
          <div id="lease-audit-result" className="mt-5 space-y-4 border-t border-slate-800 pt-5">
            {/* Risk Score Header */}
            <div
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isHighRisk
                  ? 'bg-rose-500/10 border-rose-500/40'
                  : isModerate
                  ? 'bg-amber-500/10 border-amber-500/40'
                  : 'bg-emerald-500/10 border-emerald-500/40'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  {isHighRisk ? (
                    <ShieldAlert className="w-5 h-5 text-rose-400" />
                  ) : isModerate ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  )}
                  <span
                    className={`text-sm font-extrabold font-mono uppercase ${
                      isHighRisk ? 'text-rose-300' : isModerate ? 'text-amber-300' : 'text-emerald-300'
                    }`}
                  >
                    Legal Verdict: {result.verdict.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-300">{result.summary}</p>
                <span className="inline-block text-[10px] font-mono text-slate-400">
                  Audited by: {result.modelUsed}
                </span>
              </div>

              <div className="text-center px-5 py-3 rounded-2xl bg-slate-950/90 border border-slate-800 shrink-0">
                <div className="text-[10px] font-mono uppercase text-slate-400">Legal Risk Score</div>
                <div
                  className={`text-3xl font-black font-mono ${
                    isHighRisk ? 'text-rose-400' : isModerate ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {score}
                  <span className="text-sm text-slate-500">/100</span>
                </div>
              </div>
            </div>

            {/* Flagged Clauses */}
            {result.flaggedClauses.length > 0 ? (
              <div className="space-y-3">
                {result.flaggedClauses.map((fc, idx) => (
                  <div key={idx} className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
                    <div className="p-3.5 bg-rose-500/10 border-b border-rose-500/25">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold font-mono text-rose-300">
                          🚨 ILLEGAL / PREDATORY CLAUSE • {fc.section}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-mono font-bold">
                          {fc.severity} RISK
                        </span>
                      </div>
                      <p className="text-xs font-bold text-rose-200 mt-1">{fc.issue}</p>
                      {fc.clauseExcerpt && (
                        <p className="text-[11px] font-mono text-rose-300/80 mt-1 italic">
                          &ldquo;{fc.clauseExcerpt}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="p-3.5 bg-emerald-500/5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-extrabold font-mono text-emerald-400">
                          ✅ Suggested Fair MTA 2021 Replacement Wording
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(fc.fairReplacement);
                            setCopiedIdx(idx);
                            setTimeout(() => setCopiedIdx(null), 1800);
                          }}
                          className="inline-flex items-center space-x-1 text-[10px] font-mono text-emerald-300 hover:text-emerald-200"
                        >
                          {copiedIdx === idx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedIdx === idx ? 'Copied' : 'Copy Fair Clause'}</span>
                        </button>
                      </div>
                      <p className="text-xs text-emerald-200 font-mono leading-relaxed">
                        {fc.fairReplacement}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero statutory violations detected! Ready for cryptographic escrow lock.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
};

export default LeaseScannerModal;
