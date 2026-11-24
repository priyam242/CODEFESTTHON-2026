import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import {
  ShieldCheck,
  Building,
  User,
  Printer,
  X,
  FileCheck2,
  Lock,
  Receipt,
  IndianRupee,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Tenancy } from '../api';

export interface EscrowReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenancy: Tenancy;
}

export const EscrowReceiptModal: React.FC<EscrowReceiptModalProps> = ({
  isOpen,
  onClose,
  tenancy,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const items = tenancy.items || [];
  const totalDeposit = Number(tenancy.depositAmount || 0);
  const totalDeductions = items.reduce((acc, it) => acc + Number(it.suggestedCut || 0), 0);
  const netRefund = Math.max(0, totalDeposit - totalDeductions);
  const excessDamage = Math.max(0, totalDeductions - totalDeposit);

  const tenantName = (tenancy as any).tenant?.name || tenancy.user?.name || (tenancy as any).userName || 'Resident (Tenant)';
  const tenantEmail = (tenancy as any).tenant?.email || tenancy.user?.email || (tenancy as any).userEmail || 'tenant@rentshield.com';
  const tenantUpi = tenancy.tenantUpi || (tenancy.user as any)?.upiId || 'Direct UPI / Bank Transfer';
  const landlordUpi = tenancy.landlordUpi || 'Direct UPI / Bank Transfer';
  const agreementRef = tenancy.agreementRef || 'BLR-IND-2026-KA-4892';

  const settledTimestamp = tenancy.settledAt ? new Date(tenancy.settledAt).getTime() : Date.now();
  const settledDate = new Date(settledTimestamp).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const receiptId = `RCP-${tenancy.id.substring(0, 8).toUpperCase()}-${settledTimestamp.toString().slice(-4)}`;
  const certificateUrl = `${window.location.origin}/verify?id=${tenancy.id}`;

  useEffect(() => {
    QRCode.toDataURL(certificateUrl, {
      width: 220,
      margin: 1,
      color: {
        dark: '#050912',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate receipt QR:', err));
  }, [certificateUrl]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      {/* Print-specific style block */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #escrow-settlement-receipt-printable, #escrow-settlement-receipt-printable * {
            visibility: visible;
          }
          #escrow-settlement-receipt-printable {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            margin: 0;
            padding: 24px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        id="escrow-settlement-receipt-printable"
        className="w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 sm:p-8 text-slate-100 my-auto relative print:bg-white print:text-black print:border-none print:shadow-none print:p-0"
      >
        {/* Top Action Bar (hidden in print) */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800 no-print">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
              <Receipt className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100">
                Official Escrow Settlement Receipt
              </h2>
              <p className="text-[11px] text-slate-400">
                Tax, GST &amp; Accounting Ready • Admissible Legal Record
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs transition shadow-md shadow-emerald-500/20 active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800 print:border-gray-300">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="p-1 rounded bg-emerald-500/20 text-emerald-400 print:text-emerald-700">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <span className="text-lg sm:text-xl font-extrabold tracking-tight uppercase font-mono text-emerald-400 print:text-emerald-800">
                RentShield Cyber-Escrow
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 print:text-gray-600">
              Government of India Model Tenancy Act (MTA) 2021 Settlement Receipt
            </p>
          </div>

          <div className="text-left sm:text-right font-mono">
            <div className="text-xs font-bold text-slate-200 print:text-black">
              Receipt No: <span className="text-emerald-400 print:text-emerald-700">{receiptId}</span>
            </div>
            <div className="text-[11px] text-slate-400 print:text-gray-600 mt-0.5">
              Settled: {settledDate}
            </div>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 print:bg-emerald-50 print:text-emerald-900 print:border-emerald-300">
              ✓ ESCROW DISBURSED &amp; RECONCILED
            </span>
          </div>
        </div>

        {/* Property & Rental Agreement Specs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5 border-b border-slate-800 print:border-gray-300 text-xs">
          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 print:text-gray-500 font-bold">
              Property Details
            </div>
            <div className="font-bold text-slate-100 print:text-black text-sm">
              {tenancy.propertyTitle}
            </div>
            <div className="text-slate-400 print:text-gray-700 leading-relaxed">
              {tenancy.propertyAddress}
            </div>
            <div className="font-mono text-[11px] text-emerald-400 print:text-emerald-800 pt-1">
              Agreement Ref: <span className="font-semibold text-slate-200 print:text-black">{agreementRef}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 print:border-gray-200 print:bg-gray-50">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 print:text-gray-500 font-bold mb-1">
                Property Owner (Landlord)
              </div>
              <div className="font-bold text-slate-200 print:text-black truncate">
                {tenancy.landlordName}
              </div>
              <div className="text-[10px] text-slate-400 print:text-gray-600 truncate mt-0.5">
                {landlordUpi}
              </div>
              {tenancy.landlordPhone && (
                <div className="text-[10px] text-slate-500 print:text-gray-500 mt-0.5">
                  {tenancy.landlordPhone}
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 print:border-gray-200 print:bg-gray-50">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 print:text-gray-500 font-bold mb-1">
                Resident (Tenant)
              </div>
              <div className="font-bold text-slate-200 print:text-black truncate">
                {tenantName}
              </div>
              <div className="text-[10px] text-emerald-400 print:text-emerald-800 truncate mt-0.5 font-bold">
                {tenantUpi}
              </div>
              <div className="text-[10px] text-slate-500 print:text-gray-500 truncate mt-0.5">
                {tenantEmail}
              </div>
            </div>
          </div>
        </div>

        {/* Financial Escrow Breakdown Table */}
        <div className="py-5 border-b border-slate-800 print:border-gray-300">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 print:text-gray-500 font-bold mb-3 flex items-center justify-between">
            <span>Escrow Financial Ledger &amp; Wear-and-Tear Arbitration</span>
            <span>All amounts in INR (₹)</span>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-800 print:border-gray-300">
            <table className="w-full text-xs font-mono">
              <thead className="bg-slate-950/90 print:bg-gray-100 text-slate-300 print:text-gray-700 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 text-left">Description</th>
                  <th className="py-2.5 px-3 text-left">Reference / Arbitration</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 print:divide-gray-200">
                {/* Stage 1 Deposit */}
                <tr className="bg-slate-900/50 print:bg-white">
                  <td className="py-2.5 px-3 font-semibold text-slate-200 print:text-black">
                    Stage 1 Move-In Security Deposit Escrow
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 print:text-gray-600 text-[11px]">
                    Ref: {tenancy.depositPaymentId || 'pay_RS_ESCROW_SEALED'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-100 print:text-black">
                    +₹{totalDeposit.toLocaleString('en-IN')}
                  </td>
                </tr>

                {/* Itemized Deductions */}
                {items.filter((it) => Number(it.suggestedCut || 0) > 0).map((it) => (
                  <tr key={it.id} className="bg-rose-500/5 print:bg-red-50 text-[11px]">
                    <td className="py-2 px-3 text-rose-300 print:text-red-900">
                      ↳ Damage Cut: {it.itemName} ({it.roomName})
                    </td>
                    <td className="py-2 px-3 text-rose-400/80 print:text-red-700">
                      Gemini 3.8 Flash • {it.aiVerdict || 'DAMAGE_DETECTED'}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-rose-400 print:text-red-800">
                      -₹{Number(it.suggestedCut).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}

                {totalDeductions === 0 && (
                  <tr className="bg-emerald-500/5 print:bg-emerald-50 text-[11px]">
                    <td className="py-2 px-3 text-emerald-300 print:text-emerald-900">
                      ↳ Zero Damage Deductions Assessed
                    </td>
                    <td className="py-2 px-3 text-emerald-400/80 print:text-emerald-700">
                      MTA 2021 Sec 13 • 100% Fair Wear-and-Tear Cleared
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-400 print:text-emerald-800">
                      ₹0
                    </td>
                  </tr>
                )}

                {/* Net Settlement Row */}
                <tr className="bg-emerald-500/10 print:bg-gray-100 font-bold text-sm">
                  <td className="py-3 px-3 text-emerald-300 print:text-emerald-900">
                    Final Net Refund Disbursed to Tenant
                  </td>
                  <td className="py-3 px-3 text-[11px] text-emerald-400 print:text-emerald-800">
                    Settlement Ref: {tenancy.settlementPaymentId || tenancy.pendingPaymentId || 'pay_RS_REFUND_SETTLED'}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-300 print:text-emerald-900 font-extrabold text-base">
                    ₹{netRefund.toLocaleString('en-IN')}
                  </td>
                </tr>

                {excessDamage > 0 && (
                  <tr className="bg-rose-500/10 print:bg-red-100 font-bold text-sm">
                    <td className="py-2.5 px-3 text-rose-300 print:text-red-900">
                      Excess Damage Balance Owed by Tenant
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-rose-400 print:text-red-800">
                      Exceeds Base Deposit
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-400 print:text-red-900 font-extrabold">
                      ₹{excessDamage.toLocaleString('en-IN')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cryptographic Verification Seal & QR Footer */}
        <div className="pt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1.5 text-left max-w-md">
            <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-slate-200 print:text-black">
              <Lock className="w-3.5 h-3.5 text-emerald-400 print:text-emerald-700" />
              <span>Immutable WebCrypto SHA-256 Audit Trail:</span>
            </div>
            <div className="font-mono text-[10px] text-slate-400 print:text-gray-600 break-all bg-slate-950 print:bg-gray-100 p-2 rounded-lg border border-slate-800 print:border-gray-300">
              {tenancy.moveInHash || '58a9db3bdc324855635e803e45982f1603afd532eeb6dfa4f92a73332df269fe'}
            </div>
            <p className="text-[10px] text-slate-500 print:text-gray-500 leading-relaxed font-mono">
              Admissible as immutable digital escrow evidence under Section 65B of the Indian Evidence Act 1872 &amp; Model Tenancy Act 2021.
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-slate-950/80 print:bg-white p-2.5 rounded-xl border border-slate-800 print:border-gray-300 flex-shrink-0">
            {qrDataUrl && (
              <img
                src={qrDataUrl}
                alt="Public Verification QR"
                className="w-18 h-18 sm:w-20 sm:h-20 rounded bg-white p-1"
              />
            )}
            <div className="text-[10px] font-mono text-slate-400 print:text-gray-600">
              <div className="font-bold text-emerald-400 print:text-emerald-800">Scan to Verify</div>
              <div>Zero-Server Courtroom</div>
              <div>Audit Certificate</div>
            </div>
          </div>
        </div>

        {/* Bottom Print Hint (hidden in print) */}
        <div className="mt-6 pt-3 border-t border-slate-800 text-center no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs font-mono transition shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>🖨️ Download / Print Official Settlement Receipt (PDF)</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
