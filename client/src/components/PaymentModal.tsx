import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Upload,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Building,
  User,
  IndianRupee,
  Sparkles,
  AlertCircle,
  X,
} from 'lucide-react';
import { Tenancy, tenancyApi } from '../api';
import { emitSyncEvent } from '../realtimeSync';

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenancy: Tenancy;
  currentUserRole?: 'TENANT' | 'LANDLORD';
  mode?: 'REFUND' | 'DEPOSIT' | 'SETTLEMENT';
  defaultAmount?: number;
  landlordToken?: string;
  onSettled?: (updated: Tenancy) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  tenancy,
  currentUserRole = 'LANDLORD',
  mode,
  defaultAmount,
  landlordToken,
  onSettled,
}) => {
  // Determine payment direction
  const isLandlordPaying = currentUserRole === 'LANDLORD' || mode === 'REFUND';

  // Amount computation
  const totalDeposit = Number(tenancy.depositAmount || 0);
  const items = tenancy.items || [];
  const totalCuts = items.reduce((acc, it) => acc + Number(it.suggestedCut || 0), 0);
  const calculatedRefund = Math.max(0, totalDeposit - totalCuts);
  const amount = defaultAmount !== undefined ? defaultAmount : (isLandlordPaying ? calculatedRefund : totalDeposit);

  // Dynamic Payee and Payor information
  const tenantName = tenancy.user?.name || (tenancy as any).userName || 'Aarav Sharma (Tenant)';
  const landlordName = tenancy.landlordName || 'Property Owner';
  const payeeName = isLandlordPaying ? tenantName : landlordName;

  // Initial UPI ID
  const defaultTenantUpi = tenancy.tenantUpi || (tenancy.user?.email ? tenancy.user.email.split('@')[0] + '@okaxis' : 'tenant.aarav@okhdfcbank');
  const defaultLandlordUpi = tenancy.landlordUpi || 'ramesh.malik@okhdfcbank';
  const initialVpa = isLandlordPaying ? defaultTenantUpi : defaultLandlordUpi;

  const [vpa, setVpa] = useState<string>(initialVpa);
  const [activeTab, setActiveTab] = useState<'AUTO_QR' | 'CUSTOM_QR'>('AUTO_QR');
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState<string>('');
  const [customQrImage, setCustomQrImage] = useState<string | null>(tenancy.customQrUrl || null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync VPA when tenancy changes
  useEffect(() => {
    const freshVpa = isLandlordPaying ? (tenancy.tenantUpi || defaultTenantUpi) : (tenancy.landlordUpi || defaultLandlordUpi);
    setVpa(freshVpa);
    if (tenancy.customQrUrl) {
      setCustomQrImage(tenancy.customQrUrl);
    }
  }, [tenancy, isLandlordPaying]);

  // Standard NPCI UPI URI
  const note = `RentShield Escrow - ${tenancy.propertyTitle}`;
  const upiUri = `upi://pay?pa=${encodeURIComponent(vpa.trim())}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

  // Real, Phone-Scannable QR Generation via 'qrcode'
  useEffect(() => {
    let isCancelled = false;
    if (!vpa.trim()) {
      setGeneratedQrDataUrl('');
      return;
    }

    QRCode.toDataURL(upiUri, {
      width: 280,
      margin: 2,
      color: {
        dark: '#050811',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!isCancelled) {
          setGeneratedQrDataUrl(url);
        }
      })
      .catch((err) => {
        console.error('Failed to generate phone-scannable QR code:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, [upiUri, vpa]);

  if (!isOpen) return null;

  // Custom QR image file handler with compression
  const handleCustomQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCustomQrImage(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  // Backend Settlement Execution
  const handleConfirmSettlement = async () => {
    setSettling(true);
    setSettleError(null);
    try {
      const settlePayload: any = {
        customQrUrl: customQrImage || undefined,
        tenantUpi: isLandlordPaying ? vpa.trim() : (tenancy.tenantUpi || undefined),
        landlordUpi: !isLandlordPaying ? vpa.trim() : (tenancy.landlordUpi || undefined),
      };

      let updated: Tenancy;
      if (landlordToken) {
        updated = await tenancyApi.settleByToken(landlordToken, settlePayload);
      } else {
        updated = await tenancyApi.settle(tenancy.id, settlePayload);
      }

      // Persist client settlement flag in local storage as well for seamless instant cache
      if (typeof window !== 'undefined') {
        localStorage.setItem(`rentshield_settled_${tenancy.id}`, 'true');
      }

      // Emit live sync broadcast across all tabs
      emitSyncEvent('TENANCY_SETTLED', tenancy.id);

      if (onSettled) {
        onSettled(updated);
      }
      onClose();
    } catch (err: any) {
      setSettleError(err?.response?.data?.message || err?.message || 'Failed to settle tenancy on server');
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative text-center max-h-[92vh] overflow-y-auto">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
            <QrCode className="w-4 h-4" />
            <span>{isLandlordPaying ? 'Owner Refund Payout Engine' : 'Guest Deposit Payment Engine'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xs p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Amount & Settlement Purpose */}
        <div className="mb-4">
          <div className="text-3xl font-extrabold text-slate-100 font-mono">
            ₹{amount.toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-emerald-400 font-mono font-semibold mt-0.5">
            {isLandlordPaying ? 'Net Escrow Refund Payable to Tenant' : 'Security Deposit Payable to Owner'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {tenancy.propertyTitle} • {tenancy.propertyAddress}
          </p>
        </div>

        {/* Tab Switcher: Live QR vs Custom QR Upload */}
        <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl mb-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('AUTO_QR')}
            className={`flex-1 py-1.5 rounded-lg font-mono transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'AUTO_QR'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>⚡ Live Phone-Scannable QR</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CUSTOM_QR')}
            className={`flex-1 py-1.5 rounded-lg font-mono transition flex items-center justify-center space-x-1.5 ${
              activeTab === 'CUSTOM_QR'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>📷 Upload Custom QR</span>
          </button>
        </div>

        {/* TAB 1: Live Phone-Scannable QR */}
        {activeTab === 'AUTO_QR' && (
          <div>
            <div className="p-3 rounded-2xl bg-white mx-auto inline-block shadow-2xl border-4 border-emerald-500/40 mb-3">
              {generatedQrDataUrl ? (
                <img
                  src={generatedQrDataUrl}
                  alt={`Real Phone-Scannable UPI QR for ${payeeName}`}
                  className="w-48 h-48 mx-auto rounded"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs font-mono">
                  Enter valid UPI ID below...
                </div>
              )}
            </div>
            <div className="text-[10px] text-emerald-400 font-mono font-semibold flex items-center justify-center space-x-1 mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% Real Phone-Scannable (GPay, PhonePe, Paytm, BHIM)</span>
            </div>
          </div>
        )}

        {/* TAB 2: Uploaded Custom QR Image */}
        {activeTab === 'CUSTOM_QR' && (
          <div className="mb-4">
            {customQrImage ? (
              <div>
                <div className="p-3 rounded-2xl bg-white mx-auto inline-block shadow-2xl border-4 border-emerald-500/40 mb-2">
                  <img
                    src={customQrImage}
                    alt="Custom Uploaded Payment QR"
                    className="w-48 h-48 object-contain mx-auto rounded"
                  />
                </div>
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-mono underline"
                  >
                    Replace Custom QR Image
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer p-8 rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-950/60 transition group mb-2"
              >
                <Upload className="w-8 h-8 text-slate-500 group-hover:text-emerald-400 mx-auto mb-2 transition" />
                <p className="text-xs font-bold text-slate-200">Click to upload your UPI QR image</p>
                <p className="text-[11px] text-slate-400 mt-1">PNG, JPG or Screenshot of GPay/PhonePe QR</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleCustomQrUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Live Editable UPI ID Input & Recipient Metadata */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono text-left space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Recipient Payee:</span>
            <span className="text-slate-200 font-bold">{payeeName}</span>
          </div>

          <div>
            <label className="text-slate-400 block mb-1 text-[11px]">
              {isLandlordPaying ? 'Tenant Receiving UPI ID (Editable):' : 'Owner Rent UPI ID (Editable):'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={vpa}
                onChange={(e) => setVpa(e.target.value)}
                placeholder="e.g. name@okaxis or 9876543210@ybl"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 text-xs font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              ⚡ QR code regenerates instantly on every keystroke.
            </span>
          </div>

          <div className="flex justify-between items-center pt-1 border-t border-slate-800/80 text-[11px]">
            <span className="text-slate-400">Payment Note:</span>
            <span className="text-slate-300 truncate max-w-[210px]">{note}</span>
          </div>
        </div>

        {/* Quick UPI Link Actions */}
        <div className="flex items-center space-x-2 mb-4">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(upiUri);
              setCopiedUpi(true);
              setTimeout(() => setCopiedUpi(false), 2000);
            }}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold font-mono transition flex items-center justify-center space-x-1.5"
          >
            {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedUpi ? 'Copied URI!' : 'Copy UPI Link'}</span>
          </button>
          <a
            href={upiUri}
            className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold font-mono transition flex items-center justify-center space-x-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in App</span>
          </a>
        </div>

        {/* Error Alert if any */}
        {settleError && (
          <div className="mb-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{settleError}</span>
          </div>
        )}

        {/* Main Settlement Action Button */}
        <button
          type="button"
          onClick={handleConfirmSettlement}
          disabled={settling}
          className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold font-mono transition shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-2 active:scale-[0.99]"
        >
          <Check className="w-4 h-4" />
          <span>
            {settling
              ? 'Recording Settlement on Ledger...'
              : '✅ Confirm Payment & Clear Tenancy'}
          </span>
        </button>
        <p className="text-[10px] text-slate-500 mt-2 font-mono">
          Moves this property from Active to Past History stack on both Tenant &amp; Owner dashboards.
        </p>
      </div>
    </div>
  );
};
export default PaymentModal;
