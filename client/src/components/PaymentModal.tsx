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
  CreditCard,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { Tenancy, paymentsApi, tenancyApi } from '../api';
import { emitSyncEvent } from '../realtimeSync';

// Helper to load official Razorpay Checkout SDK dynamically
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenancy: Tenancy;
  currentUserRole?: 'TENANT' | 'LANDLORD';
  stage?: 'DEPOSIT' | 'SETTLEMENT';
  mode?: 'REFUND' | 'DEPOSIT' | 'SETTLEMENT';
  defaultAmount?: number;
  landlordToken?: string;
  onSettled?: (updated: Tenancy) => void;
  isRecipientSettingsOnly?: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  tenancy,
  currentUserRole = 'LANDLORD',
  stage,
  mode,
  defaultAmount,
  landlordToken,
  onSettled,
  isRecipientSettingsOnly = false,
}) => {
  const effectiveStage: 'DEPOSIT' | 'SETTLEMENT' =
    stage || (mode === 'DEPOSIT' ? 'DEPOSIT' : 'SETTLEMENT');

  // Compute financial amounts
  const totalDeposit = Number(tenancy.depositAmount || 0);
  const items = tenancy.items || [];
  const totalCuts = items.reduce((acc, it) => acc + Number(it.suggestedCut || 0), 0);
  const netDifference = totalDeposit - totalCuts;

  // Determine stage & payer/payee logic
  let amount = 0;
  let stageTitle = '';
  let stageSubtitle = '';
  let isLandlordPaying = false;
  let payeeName = '';
  let payerName = '';

  const tenantName = tenancy.user?.name || (tenancy as any).userName || 'Aarav Sharma (Tenant)';
  const landlordName = tenancy.landlordName || 'Ramesh Malik (Owner)';

  if (effectiveStage === 'DEPOSIT') {
    amount = defaultAmount !== undefined ? defaultAmount : totalDeposit;
    stageTitle = 'Stage 1: Move-In Security Deposit Escrow';
    stageSubtitle = 'Funds held in tamper-proof escrow until Move-Out condition audit.';
    isLandlordPaying = false; // Tenant pays Landlord
    payerName = tenantName;
    payeeName = landlordName;
  } else {
    // SETTLEMENT STAGE
    if (netDifference >= 0) {
      // Case A: Net Refund to Tenant
      amount = defaultAmount !== undefined ? defaultAmount : netDifference;
      stageTitle = 'Stage 2: Move-Out Final Net Escrow Refund';
      stageSubtitle = 'Owner refunding remaining security deposit balance post-audit.';
      isLandlordPaying = true; // Landlord pays Tenant
      payerName = landlordName;
      payeeName = tenantName;
    } else {
      // Case B: Excess Damage Due from Tenant
      amount = defaultAmount !== undefined ? defaultAmount : Math.abs(netDifference);
      stageTitle = 'Stage 2: Excess Damage Compensation Due';
      stageSubtitle = 'Damage exceeds deposit; tenant paying excess liability to owner.';
      isLandlordPaying = false; // Tenant pays Landlord
      payerName = tenantName;
      payeeName = landlordName;
    }
  }

  // Dynamic Initial UPI IDs
  const defaultTenantUpi =
    tenancy.tenantUpi ||
    (tenancy.user?.email ? tenancy.user.email.split('@')[0] + '@okaxis' : 'tenant.aarav@okhdfcbank');
  const defaultLandlordUpi = tenancy.landlordUpi || 'ramesh.malik@okhdfcbank';
  const initialVpa = isLandlordPaying ? defaultTenantUpi : defaultLandlordUpi;

  const [vpa, setVpa] = useState<string>(initialVpa);
  const [activeTab, setActiveTab] = useState<'AUTO_QR' | 'CUSTOM_QR'>(
    isRecipientSettingsOnly ? 'CUSTOM_QR' : 'AUTO_QR'
  );
  const [generatedQrDataUrl, setGeneratedQrDataUrl] = useState<string>('');
  const [customQrImage, setCustomQrImage] = useState<string | null>(tenancy.customQrUrl || null);
  const [utrInput, setUtrInput] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [loadingRazorpay, setLoadingRazorpay] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const freshVpa = isLandlordPaying
      ? tenancy.tenantUpi || defaultTenantUpi
      : tenancy.landlordUpi || defaultLandlordUpi;
    setVpa(freshVpa);
    if (tenancy.customQrUrl) {
      setCustomQrImage(tenancy.customQrUrl);
    }
  }, [tenancy, isLandlordPaying]);

  // Standard NPCI UPI URI with exact .00 amount
  const note = `RentShield Escrow - ${tenancy.propertyTitle.slice(0, 24)}`;
  const upiUri = `upi://pay?pa=${encodeURIComponent(vpa.trim())}&pn=${encodeURIComponent(
    payeeName
  )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;

  // Real, Phone-Scannable QR Generation via 'qrcode'
  useEffect(() => {
    let isCancelled = false;
    if (!vpa.trim()) {
      setGeneratedQrDataUrl('');
      return;
    }

    QRCode.toDataURL(upiUri, {
      width: 320,
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

  // Save recipient custom UPI / QR settings
  const handleSaveRecipientSettings = async () => {
    setSavingSettings(true);
    setPaymentError(null);
    try {
      const updated = await paymentsApi.updateRecipient({
        tenancyId: tenancy.id,
        landlordToken,
        tenantUpi: isLandlordPaying ? vpa.trim() : undefined,
        landlordUpi: !isLandlordPaying ? vpa.trim() : undefined,
        customQrUrl: customQrImage || undefined,
      });
      emitSyncEvent('TENANCY_UPDATED', tenancy.id);
      if (onSettled) onSettled(updated);
      setPaymentSuccess('Receiving UPI ID & QR settings saved successfully!');
      setTimeout(() => setPaymentSuccess(null), 3000);
    } catch (err: any) {
      setPaymentError(err?.response?.data?.message || err?.message || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Branch 1: Razorpay Official Checkout Flow
  const handlePayViaRazorpay = async () => {
    setLoadingRazorpay(true);
    setPaymentError(null);

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error('Razorpay Checkout SDK failed to load. Please use direct UPI QR below.');
      }

      // Step 1: Create Order on backend
      const orderRes = await paymentsApi.createOrder({
        tenancyId: tenancy.id,
        stage: effectiveStage,
        amount,
        landlordToken,
      });

      if (!orderRes.enabled || !orderRes.orderId) {
        // Fallback message when keys are not in env
        setPaymentError(
          'Live Razorpay gateway keys not set in backend. Please scan the verified NPCI QR code below and enter the 12-digit UPI UTR to complete instant escrow!'
        );
        return;
      }

      // Step 2: Open Official Razorpay Checkout Modal
      const options = {
        key: orderRes.keyId,
        amount: orderRes.amount,
        currency: orderRes.currency || 'INR',
        name: 'RentShield Escrow Protocol',
        description: `${stageTitle} (₹${amount.toLocaleString('en-IN')})`,
        image: '/logo.svg',
        order_id: orderRes.orderId,
        handler: async (response: any) => {
          setVerifyingPayment(true);
          try {
            const verifyRes = await paymentsApi.verify({
              tenancyId: tenancy.id,
              stage: effectiveStage,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              landlordToken,
              customQrUrl: customQrImage || undefined,
              tenantUpi: isLandlordPaying ? vpa.trim() : undefined,
              landlordUpi: !isLandlordPaying ? vpa.trim() : undefined,
            });

            if (typeof window !== 'undefined' && effectiveStage === 'SETTLEMENT') {
              localStorage.setItem(`rentshield_settled_${tenancy.id}`, 'true');
            }

            emitSyncEvent(effectiveStage === 'DEPOSIT' ? 'DEPOSIT_PAID' : 'TENANCY_SETTLED', tenancy.id);
            if (onSettled) onSettled(verifyRes.tenancy);
            onClose();
          } catch (err: any) {
            setPaymentError(err?.response?.data?.message || 'Payment verification failed on backend');
          } finally {
            setVerifyingPayment(false);
          }
        },
        prefill: {
          name: payerName,
        },
        theme: {
          color: '#10b981',
        },
        modal: {
          ondismiss: () => {
            setLoadingRazorpay(false);
          },
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.open();
    } catch (err: any) {
      setPaymentError(err?.message || 'Failed to initiate Razorpay checkout');
    } finally {
      setLoadingRazorpay(false);
    }
  };

  // Branch 2: Direct NPCI UPI UTR Verification Flow
  const handleVerifyUtr = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!utrInput.trim()) {
      setPaymentError('Please enter the 12-digit UPI UTR / Reference No. from your bank app.');
      return;
    }

    setVerifyingPayment(true);
    setPaymentError(null);

    try {
      const verifyRes = await paymentsApi.verify({
        tenancyId: tenancy.id,
        stage: effectiveStage,
        utrNumber: utrInput.trim(),
        landlordToken,
        customQrUrl: customQrImage || undefined,
        tenantUpi: isLandlordPaying ? vpa.trim() : undefined,
        landlordUpi: !isLandlordPaying ? vpa.trim() : undefined,
      });

      if (typeof window !== 'undefined' && effectiveStage === 'SETTLEMENT') {
        localStorage.setItem(`rentshield_settled_${tenancy.id}`, 'true');
      }

      emitSyncEvent(effectiveStage === 'DEPOSIT' ? 'DEPOSIT_PAID' : 'TENANCY_SETTLED', tenancy.id);
      if (onSettled) onSettled(verifyRes.tenancy);
      onClose();
    } catch (err: any) {
      setPaymentError(err?.response?.data?.message || err?.message || 'Failed to verify UPI UTR on server');
    } finally {
      setVerifyingPayment(false);
    }
  };

  // Instant Zero-Balance Closure
  const handleZeroBalanceClosure = async () => {
    setVerifyingPayment(true);
    setPaymentError(null);
    try {
      const res = landlordToken
        ? await tenancyApi.settleByToken(landlordToken)
        : await tenancyApi.settle(tenancy.id);

      if (typeof window !== 'undefined') {
        localStorage.setItem(`rentshield_settled_${tenancy.id}`, 'true');
      }

      emitSyncEvent('TENANCY_SETTLED', tenancy.id);
      if (onSettled) onSettled(res);
      onClose();
    } catch (err: any) {
      setPaymentError(err?.response?.data?.message || 'Failed to close tenancy');
    } finally {
      setVerifyingPayment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-center max-h-[92vh] overflow-y-auto">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-bold uppercase tracking-wider">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>RentShield 2-Stage Escrow Engine</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xs p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stage Header & Amount */}
        <div className="mb-4">
          <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-[11px] font-mono font-semibold mb-2">
            {stageTitle}
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-slate-100 font-mono">
            ₹{amount.toLocaleString('en-IN')}
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {stageSubtitle}
          </p>
          <div className="mt-2 text-[11px] font-mono text-slate-500 flex items-center justify-center space-x-2">
            <span>Payer: <strong className="text-slate-300">{payerName}</strong></span>
            <span>&bull;</span>
            <span>Recipient: <strong className="text-emerald-400">{payeeName}</strong></span>
          </div>
        </div>

        {/* ZERO BALANCE SPECIAL CASE */}
        {amount === 0 && effectiveStage === 'SETTLEMENT' ? (
          <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 my-4 text-center">
            <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-200">Zero Balance Settlement</h4>
            <p className="text-xs text-slate-400 mt-1">
              Deductions exactly match deposit. No net payout is required between Tenant and Owner.
            </p>
            <button
              type="button"
              onClick={handleZeroBalanceClosure}
              disabled={verifyingPayment}
              className="mt-4 w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs transition"
            >
              {verifyingPayment ? 'Closing Tenancy...' : '✅ Close Tenancy (₹0 Balance)'}
            </button>
          </div>
        ) : (
          <>
            {/* Tab Navigation: Razorpay/UPI vs Custom QR Settings */}
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
                <span>⚡ Live QR &amp; Gateway</span>
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
                <span>📷 Upload QR / Edit UPI</span>
              </button>
            </div>

            {/* TAB 1: Real Razorpay Gateway + Real NPCI QR + 12-Digit UTR */}
            {activeTab === 'AUTO_QR' && (
              <div className="space-y-4">
                {/* Official Razorpay Checkout Button */}
                <button
                  type="button"
                  onClick={handlePayViaRazorpay}
                  disabled={loadingRazorpay || verifyingPayment}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 hover:brightness-110 disabled:opacity-50 text-slate-950 font-extrabold font-mono text-xs transition shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-2 active:scale-[0.99]"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>
                    {loadingRazorpay
                      ? 'Opening Razorpay Gateway...'
                      : `Pay ₹${amount.toLocaleString('en-IN')} via Razorpay (Cards / UPI / Netbanking)`}
                  </span>
                </button>

                {/* Divider */}
                <div className="flex items-center my-3 text-slate-600 text-[10px] font-mono">
                  <div className="flex-1 border-t border-slate-800" />
                  <span className="px-2 text-slate-500 uppercase tracking-wider">or scan direct phone upi qr</span>
                  <div className="flex-1 border-t border-slate-800" />
                </div>

                {/* QR Direction Clear Header */}
                <div className="text-center space-y-1 mb-2">
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-950 border border-slate-800 text-[11px] font-mono font-bold text-slate-200">
                    <QrCode className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {effectiveStage === 'DEPOSIT'
                        ? "Owner's Security Deposit Receiving QR"
                        : netDifference >= 0
                        ? "Tenant's Escrow Refund Receiving QR"
                        : "Owner's Excess Damage Receiving QR"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {effectiveStage === 'DEPOSIT'
                      ? `Guest (${payerName}): Scan to pay ₹${amount.toLocaleString('en-IN')} to Owner (${payeeName})`
                      : netDifference >= 0
                      ? `Owner (${payerName}): Scan with UPI to refund ₹${amount.toLocaleString('en-IN')} to Tenant (${payeeName})`
                      : `Guest (${payerName}): Scan to pay ₹${amount.toLocaleString('en-IN')} excess damage to Owner (${payeeName})`}
                  </p>
                </div>

                {/* Real Phone-Scannable QR Image */}
                <div className="p-3 rounded-2xl bg-white mx-auto inline-block shadow-2xl border-4 border-emerald-500/40">
                  {customQrImage ? (
                    <img
                      src={customQrImage}
                      alt="Uploaded Custom Payment QR"
                      className="w-48 h-48 object-contain mx-auto rounded"
                    />
                  ) : generatedQrDataUrl ? (
                    <img
                      src={generatedQrDataUrl}
                      alt={`Real Phone-Scannable UPI QR for ₹${amount}`}
                      className="w-48 h-48 mx-auto rounded"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs font-mono">
                      Generating real QR...
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-emerald-400 font-mono font-semibold flex items-center justify-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>100% Real Phone-Scannable NPCI QR • Payee VPA: {vpa}</span>
                </div>

                {/* Direct UPI URI Action Buttons */}
                <div className="flex items-center space-x-2">
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
                    <span>{copiedUpi ? 'Copied Link!' : 'Copy UPI Link'}</span>
                  </button>
                  <a
                    href={upiUri}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold font-mono transition flex items-center justify-center space-x-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open UPI App</span>
                  </a>
                </div>

                {/* 12-Digit UPI UTR / Reference Verification Form */}
                <form onSubmit={handleVerifyUtr} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-left space-y-2 mt-2">
                  <label className="text-slate-300 block text-xs font-mono font-semibold">
                    Confirm Scanned Payment via 12-Digit Bank UTR:
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value)}
                      placeholder="e.g. 432109876543 (from GPay / PhonePe receipt)"
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 text-xs font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={verifyingPayment || !utrInput.trim()}
                      className="py-2 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold font-mono transition flex items-center space-x-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{verifyingPayment ? 'Verifying...' : 'Verify UTR'}</span>
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    Once verified, the payment is cryptographically stamped on PostgreSQL and the tenancy updates instantly.
                  </span>
                </form>
              </div>
            )}

            {/* TAB 2: Custom QR Upload & Recipient UPI Settings */}
            {activeTab === 'CUSTOM_QR' && (
              <div className="space-y-4 text-left">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <label className="text-slate-300 block text-xs font-mono font-bold mb-1">
                    {isLandlordPaying ? 'Tenant Receiving UPI ID:' : 'Owner Rent-Receiving UPI ID:'}
                  </label>
                  <input
                    type="text"
                    value={vpa}
                    onChange={(e) => setVpa(e.target.value)}
                    placeholder="e.g. name@okaxis or 9876543210@ybl"
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-emerald-400 text-xs font-mono focus:outline-none focus:border-emerald-500 mb-1"
                  />
                  <span className="text-[10px] text-slate-500 block">
                    The payer's QR code regenerates automatically to pay into this account.
                  </span>
                </div>

                {/* Custom QR Image Upload Section */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <label className="text-slate-300 block text-xs font-mono font-bold mb-2">
                    Upload Your Official GPay / PhonePe QR Screenshot:
                  </label>
                  {customQrImage ? (
                    <div className="text-center">
                      <div className="p-2 rounded-xl bg-white inline-block shadow mb-2 border border-slate-700">
                        <img
                          src={customQrImage}
                          alt="Custom Uploaded QR"
                          className="w-36 h-36 object-contain rounded"
                        />
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs text-emerald-400 hover:text-emerald-300 font-mono underline"
                        >
                          Replace QR Screenshot
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="cursor-pointer p-6 rounded-xl border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-900/50 text-center transition group"
                    >
                      <Upload className="w-6 h-6 text-slate-500 group-hover:text-emerald-400 mx-auto mb-1.5 transition" />
                      <p className="text-xs font-bold text-slate-200">Click to upload UPI QR screenshot</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">PNG, JPG or Screenshot of GPay/PhonePe</p>
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

                <button
                  type="button"
                  onClick={handleSaveRecipientSettings}
                  disabled={savingSettings}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-extrabold font-mono transition flex items-center justify-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingSettings ? 'Saving Settings...' : 'Save Recipient UPI & QR Preferences'}</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* Error Alert */}
        {paymentError && (
          <div className="mt-4 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{paymentError}</span>
          </div>
        )}

        {/* Success Alert */}
        {paymentSuccess && (
          <div className="mt-4 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2 text-left">
            <Check className="w-4 h-4 flex-shrink-0 text-emerald-400" />
            <span>{paymentSuccess}</span>
          </div>
        )}
      </div>
    </div>
  );
};
export default PaymentModal;
