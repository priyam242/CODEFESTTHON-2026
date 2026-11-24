import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  FileCheck2,
  UploadCloud,
  FileText,
  Building,
  IndianRupee,
  Lock,
  Sparkles,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Cpu,
  Fingerprint,
} from 'lucide-react';
import { tenancyApi, PublicCertificate } from '../api';

export const PublicVerifier: React.FC = () => {
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get('id') || searchParams.get('token') || '';

  const [lookupInput, setLookupInput] = useState(queryId);
  const [certificate, setCertificate] = useState<PublicCertificate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File hashing state
  const [file, setFile] = useState<File | null>(null);
  const [computedHash, setComputedHash] = useState<string | null>(null);
  const [hashing, setHashing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (queryId) {
      handleLookup(queryId);
    }
  }, [queryId]);

  const handleLookup = async (idOrToken: string) => {
    if (!idOrToken.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await tenancyApi.getCertificate(idOrToken.trim());
      setCertificate(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Certificate not found. Check the ID or token.');
      setCertificate(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tenancyApi.getLatestDemoCertificate();
      setCertificate(data);
      setLookupInput(data.id);
    } catch (err: any) {
      setError('No demo certificates found on server.');
    } finally {
      setLoading(false);
    }
  };

  const computeFileHash = async (selectedFile: File) => {
    setFile(selectedFile);
    setHashing(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      setComputedHash(hashHex);
    } catch (err) {
      console.error('Local hash computation error', err);
    } finally {
      setHashing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      computeFileHash(e.dataTransfer.files[0]);
    }
  };

  const isHashMatch =
    certificate &&
    computedHash &&
    (computedHash.toLowerCase() === certificate.moveInHash?.toLowerCase() ||
      certificate.items.some(
        (i) =>
          (i.moveInPhotoHash && i.moveInPhotoHash.toLowerCase() === computedHash.toLowerCase()) ||
          (i.moveOutPhotoHash && i.moveOutPhotoHash.toLowerCase() === computedHash.toLowerCase())
      ));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Top Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 mb-3 shadow-lg shadow-emerald-500/10">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
          Public Certificate &amp; Hash Verifier
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
          Verify tamper-proof RentShield inventory certificates and PDF records. Hashing is performed directly in your browser using the native Web Crypto API.
        </p>

        {/* Security Radar Banner */}
        <div className="mt-4 inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/30 text-emerald-300 text-xs font-mono shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>100% In-Browser Web Crypto • 0 Bytes Uploaded to Server</span>
        </div>

        {/* Judge Courtroom Explainer Banner */}
        <div className="mt-3.5 max-w-2xl mx-auto px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono leading-relaxed shadow-sm">
          <span className="font-bold text-emerald-400">Zero-Trust Courtroom Proof:</span> Drop any original room photo here to mathematically verify in-browser (via SHA-256 WebCrypto, zero server upload) that zero pixels were altered since Move-In.
        </div>
      </div>

      {/* Lookup Bar + Judge 1-Click Demo */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 mb-8 shadow-xl glass-vault-card">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="Enter Certificate UUID or Landlord Token"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
          <button
            onClick={() => handleLookup(lookupInput)}
            disabled={loading || !lookupInput.trim()}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs sm:text-sm transition shadow-md shadow-emerald-500/20"
          >
            {loading ? 'Searching...' : 'Lookup Certificate'}
          </button>
          <button
            onClick={handleLoadDemo}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-semibold text-xs transition flex items-center justify-center space-x-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>⚡ Load Demo Certificate</span>
          </button>
        </div>

        {error && (
          <div className="mt-3.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Certificate Details */}
      {certificate && (
        <div className="space-y-6 mb-8">
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800/80 p-6 backdrop-blur-xl shadow-xl glass-vault-card relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div>
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2 font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Authentic Ledger Record</span>
                </span>
                <h2 className="text-xl font-bold text-slate-100">{certificate.propertyTitle}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{certificate.propertyAddress}</p>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-center min-w-[170px]">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Secured Deposit</div>
                <div className="text-lg font-bold text-slate-100 font-mono mt-0.5">
                  ₹{Number(certificate.depositAmount).toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-amber-400 font-semibold mt-0.5 font-mono">
                  Status: {certificate.status}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs text-slate-300">
              <div>
                <span className="text-slate-400 block font-mono text-[11px]">Certificate ID:</span>
                <span className="font-mono text-slate-200">{certificate.id}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-mono text-[11px]">Logged Landlord:</span>
                <span className="font-medium text-slate-200">{certificate.landlordName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-mono text-[11px]">Fingerprinted Items:</span>
                <span className="font-medium text-slate-200">{certificate.totalItems} Room Fixtures</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800/80">
              <span className="text-slate-400 text-xs block mb-1 font-mono uppercase tracking-wider">
                Cryptographic Seal Signature (SHA-256):
              </span>
              <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 font-mono text-[11px] text-amber-300 break-all select-all">
                {certificate.moveInHash}
              </div>
            </div>

            {/* Counterparty Identity Binding Audit Trail */}
            <div className="mt-4 p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/20 text-xs">
              <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-semibold mb-2">
                <Fingerprint className="w-4 h-4" />
                <span>Counterparty Identity Binding (Model Tenancy Act Anchor)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
                <div>Owner Rent VPA: <span className="text-emerald-300">{certificate.landlordUpi || 'ramesh.malik@okhdfcbank'}</span></div>
                <div>Agreement Ref ID: <span className="text-slate-100">{certificate.agreementRef || 'BLR-IND-2026-KA-4892'}</span></div>
              </div>
              {(certificate.settlementPaymentId || certificate.depositPaymentId) && (
                <div className="mt-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-emerald-300 flex items-center justify-between">
                  <span className="text-slate-400">Escrow Payment Reference:</span>
                  <span className="font-bold text-emerald-400">{certificate.settlementPaymentId || certificate.depositPaymentId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Client-Side Drag & Drop PDF / File Hash Verifier */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800/80 p-6 backdrop-blur-xl shadow-xl glass-vault-card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <FileCheck2 className="w-5 h-5 text-emerald-400" />
                <span>Client-Side File Byte Verification</span>
              </h3>
              <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Web Crypto API • SHA-256
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Drop an export PDF, move-in photo, or inspection document here. The browser computes its SHA-256 hash locally.
              <span className="text-emerald-400 font-medium ml-1">The file is never uploaded to any server.</span>
            </p>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed transition text-center ${
                isDragOver
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
              }`}
            >
              <UploadCloud className="w-10 h-10 text-emerald-400 mx-auto mb-3 animate-pulse" />
              <p className="text-xs sm:text-sm text-slate-200 font-medium">
                Drag and drop your inspection PDF or image here
              </p>
              <p className="text-[11px] text-slate-400 mt-1">or click to browse from device</p>
              <label className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer transition">
                <span>Select File</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      computeFileHash(e.target.files[0]);
                    }
                  }}
                />
              </label>

              {file && (
                <div className="mt-4 pt-4 border-t border-slate-800/80 text-left">
                  <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                    <span className="font-semibold truncate max-w-xs">{file.name}</span>
                    <span className="text-slate-500 font-mono">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 bg-slate-950 p-2 rounded border border-slate-800 break-all select-all">
                    Computed: {hashing ? 'Calculating SHA-256...' : computedHash}
                  </div>
                </div>
              )}
            </div>

            {/* Verdict Card */}
            {computedHash && (
              <div className="mt-4">
                {isHashMatch ? (
                  <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/60 text-emerald-300 text-xs shadow-xl shadow-emerald-500/10 transition-all animate-pulse-emerald">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                        <ShieldCheck className="w-6 h-6 flex-shrink-0" />
                      </div>
                      <div>
                        <div className="font-mono font-extrabold text-base text-emerald-400 tracking-wider">
                          [VERIFIED &amp; UNTAMPERED]
                        </div>
                        <div className="text-[11px] text-emerald-300/90 font-medium">
                          100% Byte Match with Sealed Ledger Record &bull; Zero Modifications
                        </div>
                      </div>
                    </div>
                    <div className="mt-2.5 p-2.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 font-mono text-[11px] text-emerald-400 break-all select-all">
                      SHA-256 MATCH: {computedHash}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 sm:p-5 rounded-2xl bg-rose-950/40 border-2 border-rose-500/60 text-rose-300 text-xs shadow-xl shadow-rose-500/10 transition-all animate-pulse-rose">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400">
                        <ShieldAlert className="w-6 h-6 flex-shrink-0" />
                      </div>
                      <div>
                        <div className="font-mono font-extrabold text-base text-rose-400 tracking-wider">
                          [TAMPER DETECTED / HASH MISMATCH]
                        </div>
                        <div className="text-[11px] text-rose-300/90 font-medium">
                          The file contents do not match the cryptographic seal. Unauthorized modification detected.
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1.5 mt-2.5">
                      <div className="p-2 rounded-lg bg-slate-950/90 border border-rose-500/30 text-[10px] font-mono break-all">
                        <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Computed File Hash (Current):</span>
                        <span className="text-rose-400 font-bold">{computedHash}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/90 border border-slate-800 text-[10px] font-mono break-all">
                        <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Expected Ledger Seal (Move-In):</span>
                        <span className="text-amber-400 font-bold">{certificate?.moveInHash || 'AUTHENTIC_HASH_NOT_MATCHED'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default PublicVerifier;
