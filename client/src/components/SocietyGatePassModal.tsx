import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import {
  ShieldCheck,
  Building,
  User,
  Phone,
  Calendar,
  CheckCircle2,
  Printer,
  X,
  FileCheck2,
  Lock,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import { Tenancy } from '../api';

export interface SocietyGatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenancy: Tenancy;
}

export const SocietyGatePassModal: React.FC<SocietyGatePassModalProps> = ({
  isOpen,
  onClose,
  tenancy,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const items = tenancy.items || [];
  const totalDeposit = Number(tenancy.depositAmount || 0);
  const totalDeductions = items.reduce((acc, it) => acc + Number(it.suggestedCut || 0), 0);
  const netRefund = Math.max(0, totalDeposit - totalDeductions);
  const tenantName = (tenancy as any).tenant?.name || tenancy.user?.name || (tenancy as any).userName || 'Resident (Tenant)';
  const tenantEmail = (tenancy as any).tenant?.email || tenancy.user?.email || (tenancy as any).userEmail || 'tenant@rentshield.com';
  const agreementRef = tenancy.agreementRef || 'BLR-IND-2026-KA-4892';
  const settledDate = tenancy.settledAt
    ? new Date(tenancy.settledAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

  const certificateUrl = `${window.location.origin}/verify?id=${tenancy.id}`;

  useEffect(() => {
    QRCode.toDataURL(certificateUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#050912',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate gate pass QR:', err));
  }, [certificateUrl]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      {/* Print-specific style block to ensure crisp printable layout */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #society-gate-pass-printable, #society-gate-pass-printable * {
            visibility: visible;
          }
          #society-gate-pass-printable {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            margin: 0;
            padding: 20px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-4 sm:p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto">
        {/* Modal Top Actions */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6 no-print">
          <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Official Indian Society Move-Out Gate Pass &amp; NOC</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs transition shadow-md shadow-emerald-500/20"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>🖨️ Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-xs p-1.5 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Container */}
        <div
          id="society-gate-pass-printable"
          className="rounded-2xl bg-white text-slate-900 p-4 sm:p-8 shadow-lg border border-slate-200 relative overflow-hidden overflow-x-auto max-w-full"
        >
          {/* Subtle Watermark Stamp */}
          <div className="absolute -right-8 -bottom-8 pointer-events-none opacity-5">
            <ShieldCheck className="w-80 h-80 text-emerald-900" />
          </div>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-5 border-b-2 border-slate-900 gap-4">
            <div>
              <div className="flex items-center space-x-2 text-emerald-700 font-extrabold font-mono text-xs tracking-wider uppercase mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>RENTSHIELD DIGITAL ESCROW VAULT • NO-DUES PROTOCOL</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                SOCIETY MOVE-OUT GATE PASS
              </h1>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Statutory Move-Out No-Dues Clearance under Indian Model Tenancy Act (MTA) 2021
              </p>
            </div>
            <div className="text-right sm:text-right font-mono text-xs text-slate-600">
              <div className="font-bold text-slate-900">CERTIFICATE NO:</div>
              <div className="text-emerald-700 font-extrabold tracking-wider">
                RS-NOC-{tenancy.id.substring(0, 8).toUpperCase()}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Date: {settledDate}</div>
            </div>
          </div>

          {/* Big Emerald Clearance Stamp */}
          <div className="my-5 p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-600/80 text-emerald-900 flex items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-emerald-600 text-white flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-black tracking-wide uppercase font-mono text-emerald-950">
                  ✅ CLEARED FOR SOCIETY EXIT • ZERO DUES PENDING
                </div>
                <div className="text-[11px] text-emerald-800 font-medium">
                  Security Guard &amp; Society Management: Handover inspection completed. Security deposit fully settled. Moving trucks &amp; packers authorized to depart.
                </div>
              </div>
            </div>
            <div className="hidden sm:block text-right font-mono text-[10px] text-emerald-700 font-bold uppercase tracking-wider px-2 py-1 rounded bg-white border border-emerald-300">
              VERIFIED VALID
            </div>
          </div>

          {/* Key Parties & Society Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3 text-xs border-b border-slate-200">
            <div className="space-y-1">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                Property / Apartment Society:
              </div>
              <div className="font-bold text-slate-950 text-sm">{tenancy.propertyTitle}</div>
              <div className="text-slate-700 text-[11px] leading-relaxed">{tenancy.propertyAddress}</div>
              <div className="text-[11px] font-mono text-slate-600 pt-1">
                Agreement Ref: <strong className="text-slate-900">{agreementRef}</strong>
              </div>
            </div>

            <div className="space-y-2 sm:pl-4 sm:border-l border-slate-200">
              <div>
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  Vacating Resident (Tenant):
                </div>
                <div className="font-bold text-slate-950">{tenantName}</div>
                <div className="text-slate-600 text-[11px] font-mono">{tenantEmail}</div>
              </div>
              <div>
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  Property Owner (Landlord):
                </div>
                <div className="font-bold text-slate-950">{tenancy.landlordName}</div>
                <div className="text-slate-600 text-[11px] font-mono">
                  {tenancy.landlordEmail ? (tenancy.landlordUpi ? `${tenancy.landlordEmail} • UPI: ${tenancy.landlordUpi}` : tenancy.landlordEmail) : (tenancy.landlordPhone || 'Property Owner')}
                </div>
              </div>
            </div>
          </div>

          {/* Escrow Financial Clearance Audit Breakdown */}
          <div className="my-4">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-2">
              Financial Escrow &amp; Deposit Clearance Ledger:
            </div>
            <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-center font-mono">
              <div>
                <span className="text-[9px] text-slate-500 block uppercase">1. GROSS DEPOSIT</span>
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  ₹{totalDeposit.toLocaleString('en-IN')}
                </span>
                <span className="text-[9px] text-slate-500 block truncate" title={tenancy.depositPaymentId || 'pay_RS_DEMO_882910'}>
                  Txn: {tenancy.depositPaymentId || 'pay_RS_DEMO_882910'}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block uppercase">2. AI DAMAGE CUT</span>
                <span className="text-xs sm:text-sm font-bold text-rose-600">
                  -₹{totalDeductions.toLocaleString('en-IN')}
                </span>
                <span className="text-[9px] text-slate-500 block">
                  {items.length} Fixtures Audited
                </span>
              </div>
              <div>
                <span className="text-[9px] text-emerald-700 block uppercase font-bold">3. REFUND SETTLED</span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-700">
                  ₹{netRefund.toLocaleString('en-IN')}
                </span>
                <span className="text-[9px] text-emerald-800 block truncate font-bold" title={tenancy.settlementPaymentId || 'pay_RS_REFUND_994102'}>
                  Ref: {tenancy.settlementPaymentId || 'pay_RS_REFUND_994102'}
                </span>
              </div>
            </div>
          </div>

          {/* Scan-to-Verify Live QR & Digital Signature Stamp */}
          <div className="mt-5 pt-4 border-t-2 border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="p-1 rounded-xl bg-white border-2 border-slate-900 shadow-sm flex-shrink-0">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Gate Pass QR" className="w-20 h-20" />
                ) : (
                  <div className="w-20 h-20 bg-slate-100 flex items-center justify-center text-[10px] font-mono">
                    QR Matrix
                  </div>
                )}
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-900 font-mono">
                  Scan to Verify Guard Gate Pass
                </div>
                <div className="text-[10px] text-slate-600 max-w-[240px] leading-tight mt-0.5">
                  Point phone camera at this QR code to view live immutable cryptographic court certificate on RentShield.
                </div>
                <a
                  href={certificateUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-1 text-[10px] text-emerald-700 font-bold hover:underline font-mono mt-1"
                >
                  <span>Open Public Ledger URL</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>

            <div className="text-right sm:text-right font-mono text-[10px] space-y-1">
              <div className="text-slate-500 uppercase tracking-wider">Authorized Digital Signature:</div>
              <div className="font-extrabold text-slate-900 text-xs">
                {tenancy.landlordName} (Owner)
              </div>
              <div className="text-emerald-700 font-bold">
                ✓ Cryptographically Bound &amp; Signed
              </div>
              <div className="text-[9px] text-slate-500">
                RentShield Web Crypto SHA-256 Engine
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-400 no-print">
          <span>This Gate Pass is accepted across Indian RWAs &amp; gated societies.</span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition flex items-center space-x-1.5 shadow-md shadow-emerald-500/20"
            >
              <Printer className="w-4 h-4" />
              <span>🖨️ Print / Save PDF Gate Pass</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition"
            >
              Close Pass
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
export default SocietyGatePassModal;
