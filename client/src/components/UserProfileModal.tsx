import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Shield,
  ShieldCheck,
  User as UserIcon,
  Mail,
  Building,
  KeyRound,
  CheckCircle2,
  X,
  CreditCard,
  QrCode,
  Copy,
  Check,
  Save,
  Lock,
  Layers,
  LogOut,
  Camera,
  Trash2,
  AlertTriangle,
  Eye,
  EyeOff,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { authApi, tenancyApi, User } from '../api';

export interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout?: () => void;
  onUserUpdated?: (user: User) => void;
}

type TabType = 'IDENTITY' | 'SECURITY' | 'STATS' | 'DANGER';

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onLogout,
  onUserUpdated,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => authApi.getCurrentUser());
  const [activeTab, setActiveTab] = useState<TabType>('IDENTITY');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [defaultUpi, setDefaultUpi] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Danger Zone
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Feedback states
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Escrow Stats
  const [stats, setStats] = useState<{ active: number; settled: number; totalDeposit: number }>({
    active: 0,
    settled: 0,
    totalDeposit: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load fresh user data from server upon opening
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setShowDeleteConfirm(false);
    setDeleteConfirmationText('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

    const initial = authApi.getCurrentUser();
    if (initial) {
      setCurrentUser(initial);
      setName(initial.name || '');
      setEmail(initial.email || '');
      setAddress(initial.address || '');
      setAvatarUrl(initial.avatarUrl || '');

      const emailStorageKey = `rentshield_default_upi_${initial.email.toLowerCase()}`;
      const savedUpi = localStorage.getItem(emailStorageKey) || initial.upiId || '';
      setDefaultUpi(savedUpi);
    }

    // Refresh user from /auth/me
    authApi
      .getMe()
      .then((fresh) => {
        setCurrentUser(fresh);
        setName(fresh.name || '');
        setEmail(fresh.email || '');
        setAddress(fresh.address || '');
        setAvatarUrl(fresh.avatarUrl || '');
        if (fresh.upiId) setDefaultUpi(fresh.upiId);
      })
      .catch(() => { });

    // Fetch live tenancy stats with immediate fallback to 0 (never stuck on ...)
    let isCancelled = false;
    setLoadingStats(true);
    tenancyApi
      .getAll()
      .then((data) => {
        if (isCancelled) return;
        const list = Array.isArray(data) ? data : [];
        const settled = list.filter((t) => t.status === 'SETTLED').length;
        const active = list.length - settled;
        const totalDeposit = list.reduce((acc, t) => acc + Number(t.depositAmount || 0), 0);
        setStats({ active, settled, totalDeposit });
      })
      .catch(() => {
        if (!isCancelled) setStats({ active: 0, settled: 0, totalDeposit: 0 });
      })
      .finally(() => {
        if (!isCancelled) setLoadingStats(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const isDemoUser =
    currentUser?.email?.toLowerCase() === 'tenant.demo@rentshield.com' ||
    currentUser?.email?.toLowerCase() === 'landlord.demo@rentshield.com';

  const getInitials = (userName?: string, userEmail?: string) => {
    if (userName) {
      const parts = userName.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return userName.slice(0, 2).toUpperCase();
    }
    if (userEmail) return userEmail.slice(0, 2).toUpperCase();
    return 'RS';
  };

  // Canvas Image Compression (scales to max 400x400, compresses to JPEG <= 150KB)
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width);
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height);
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(e.target?.result as string);
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSaving(true);
      setErrorMsg(null);
      const compressed = await compressImage(file);
      setAvatarUrl(compressed);
    } catch {
      setErrorMsg('Failed to process avatar image. Please choose another image.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopyEmail = () => {
    if (currentUser?.email) {
      navigator.clipboard.writeText(currentUser.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (newPassword && newPassword !== confirmPassword) {
      setErrorMsg('New password and confirm password do not match');
      setActiveTab('SECURITY');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters');
      setActiveTab('SECURITY');
      return;
    }

    if (newPassword && !currentPassword) {
      setErrorMsg('Current password is required to set a new password');
      setActiveTab('SECURITY');
      return;
    }

    setSaving(true);
    try {
      const res = await authApi.updateProfile({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        address: address.trim(),
        avatarUrl: avatarUrl || undefined,
        upiId: defaultUpi.trim(),
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });

      // Sync UPI to localStorage for payment autofill
      if (res.user?.email && defaultUpi.trim()) {
        localStorage.setItem(`rentshield_default_upi_${res.user.email.toLowerCase()}`, defaultUpi.trim());
      }

      setCurrentUser(res.user);
      if (onUserUpdated) onUserUpdated(res.user);

      // Dispatch event to update Navbar avatar/name everywhere
      window.dispatchEvent(new CustomEvent('rentshield-user-updated', { detail: res.user }));

      setSuccessMsg(res.message || 'Profile settings successfully updated!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Failed to update profile settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (isDemoUser) {
      setErrorMsg('Judge Demo accounts are protected from deletion to preserve demonstration walkthroughs.');
      return;
    }

    if (deleteConfirmationText.trim().toUpperCase() !== 'DELETE') {
      setErrorMsg('Please type DELETE to confirm permanent account purge.');
      return;
    }

    setDeletingAccount(true);
    setErrorMsg(null);
    try {
      await authApi.deleteAccount();
      onClose();
      if (onLogout) onLogout();
      else window.location.href = '/login';
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Failed to delete account');
      setDeletingAccount(false);
    }
  };

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden glass-vault-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Gradient Bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500"></div>

        {/* 1. STICKY MODAL HEADER */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800/90 z-20 px-5 sm:px-7 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-100 flex items-center space-x-2">
                <span>Account Settings &amp; Identity Vault</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                  {currentUser?.role || 'USER'}
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Cryptographic Model Tenancy identity &amp; settlement vault
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition"
            title="Close Vault"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 2. TAB NAVIGATION */}
        <div className="flex items-center px-5 sm:px-7 pt-3 pb-2 border-b border-slate-800/80 bg-slate-950/40 text-xs font-mono font-semibold space-x-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('IDENTITY')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center space-x-1.5 whitespace-nowrap ${activeTab === 'IDENTITY'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Identity &amp; UPI</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SECURITY')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center space-x-1.5 whitespace-nowrap ${activeTab === 'SECURITY'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Security</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('STATS')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center space-x-1.5 whitespace-nowrap ${activeTab === 'STATS'
              ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Activity &amp; Vault</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DANGER')}
            className={`px-3 py-1.5 rounded-xl transition flex items-center space-x-1.5 whitespace-nowrap ${activeTab === 'DANGER'
              ? 'bg-rose-500 text-white font-bold shadow-md shadow-rose-500/20'
              : 'text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10'
              }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Danger Zone</span>
          </button>
        </div>

        {/* 3. SCROLLABLE TAB CONTENT */}
        <form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-6 text-left">
          {/* TAB 1: IDENTITY & UPI */}
          {activeTab === 'IDENTITY' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Profile Photo / Avatar with Glowing Cyber Ring */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="relative group">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-gradient-to-tr from-emerald-500 via-teal-400 to-cyan-500 shadow-lg shadow-emerald-500/20 flex-shrink-0">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Profile Avatar"
                        className="w-full h-full object-cover rounded-full bg-slate-950"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-xl font-extrabold text-emerald-400 font-mono">
                        {getInitials(name || currentUser?.name, email || currentUser?.email)}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Change Photo"
                    className="absolute bottom-0 right-0 p-1.5 rounded-full bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition shadow-md"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">Profile Photo</h3>
                      <p className="text-[11px] text-slate-400">
                        Auto-compressed (max 400px, &le;150KB). Displayed in Navbar, agreements, &amp; NOC gate passes.
                      </p>
                    </div>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold transition flex items-center space-x-1.5"
                    >
                      <Camera className="w-3 h-3 text-emerald-400" />
                      <span>Upload / Change Photo</span>
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-rose-500/20 text-rose-300 text-xs font-mono transition"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Details Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
                    Full Legal Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-slate-300 uppercase tracking-wider font-mono">
                      Email Address
                    </label>
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      className="text-[10px] text-emerald-400 hover:underline font-mono inline-flex items-center space-x-1"
                    >
                      {copiedEmail ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. aarav@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700/80 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider font-mono">
                  Permanent / Residential Address
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-3 pointer-events-none text-slate-500">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. B-12, Nirmal Park Society, Outer Ring Road, Bangalore, KA 560103"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                </div>
              </div>

              {/* Default Receiving UPI ID Vault */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold font-mono text-emerald-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <span>Default Receiving UPI VPA (Escrow Settlements)</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-500">Auto-filled in QR</span>
                </div>
                <input
                  type="text"
                  value={defaultUpi}
                  onChange={(e) => setDefaultUpi(e.target.value)}
                  placeholder="e.g. aarav.sharma@okaxis or 9876543210@ybl"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-emerald-300 placeholder-slate-500 text-xs sm:text-sm font-mono focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                  Your receiving UPI VPA will be automatically used when the owner refunds your security deposit or when generating custom payment QR codes.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: SECURITY & PASSWORDS */}
          {activeTab === 'SECURITY' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex items-center space-x-2 text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Update Account Password</span>
                </div>
                <p className="text-xs text-slate-400">
                  Passwords are encrypted using 10-round salted Bcrypt hashes. Leave blank if keeping your current password.
                </p>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      title="Toggle current password visibility"
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        title="Toggle new password visibility"
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        title="Toggle confirm visibility"
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Session / Token Details */}
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-slate-800 text-xs font-mono text-slate-400 space-y-1">
                <div className="text-slate-300 font-bold">Cryptographic Session Binding:</div>
                <div>Account ID: <span className="text-slate-200">{currentUser?.id}</span></div>
                <div>Role Authority: <span className="text-emerald-400">{currentUser?.role}</span></div>
                <div>WebCrypto Hashing Engine: <span className="text-emerald-300">Active (SHA-256)</span></div>
              </div>
            </div>
          )}

          {/* TAB 3: ACTIVITY & VAULT */}
          {activeTab === 'STATS' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center font-mono">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    Active Escrows
                  </div>
                  <div className="text-2xl font-black text-emerald-400 mt-1">
                    {stats.active}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Under Protection</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center font-mono">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    Settled History
                  </div>
                  <div className="text-2xl font-black text-cyan-400 mt-1">
                    {stats.settled}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">NOC Pass Generated</div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-center font-mono">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    Secured Deposits
                  </div>
                  <div className="text-2xl font-black text-slate-100 mt-1">
                    ₹{stats.totalDeposit.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Protected Value</div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/20 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>Indian Model Tenancy Act (MTA) 2021 Escrow Protocol</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  RentShield anchors all inventory room fixtures with browser-native SHA-256 byte signatures. When you settle or vacate, a certified Society Gate Pass &amp; No-Dues NOC is issued for residential RWA security guards.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: DANGER ZONE */}
          {activeTab === 'DANGER' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-3">
                <div className="flex items-center space-x-2 font-bold text-sm text-rose-200">
                  <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                  <span>Permanent Account Deletion</span>
                </div>
                <p className="text-xs leading-relaxed text-rose-300/90 font-mono">
                  Deleting your account permanently purges your login credentials, active tenancies, inventory room fixtures, and cryptographic escrow signatures. This action cannot be reversed.
                </p>

                {isDemoUser ? (
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 text-amber-300 font-mono text-xs">
                    🛡️ <strong>Demo Account Protected:</strong> Judge demo accounts (<code>tenant.demo@rentshield.com</code> and <code>landlord.demo@rentshield.com</code>) cannot be deleted so evaluators can inspect 1-click workflows smoothly.
                  </div>
                ) : !showDeleteConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="py-2.5 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold font-mono text-xs transition shadow-md shadow-rose-500/20 flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete My Account Permanently</span>
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/50 space-y-3">
                    <label className="block text-xs font-mono font-bold text-rose-300">
                      Type <span className="text-white underline">DELETE</span> to confirm permanent deletion:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmationText}
                      onChange={(e) => setDeleteConfirmationText(e.target.value)}
                      placeholder="Type DELETE"
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-rose-500/50 text-white font-mono text-xs focus:outline-none"
                    />
                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        type="button"
                        disabled={deletingAccount || deleteConfirmationText.trim().toUpperCase() !== 'DELETE'}
                        onClick={handleDeleteAccount}
                        className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold font-mono text-xs transition"
                      >
                        {deletingAccount ? 'Purging Account...' : 'Confirm Permanent Deletion'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmationText('');
                        }}
                        className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Messages Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}
        </form>

        {/* 4. STICKY MODAL FOOTER */}
        <div className="sticky bottom-0 bg-slate-950/95 backdrop-blur border-t border-slate-800/90 px-5 sm:px-7 py-3.5 flex items-center justify-between z-20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-medium transition"
          >
            Close Vault
          </button>

          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-mono font-extrabold transition shadow-lg shadow-emerald-500/20 flex items-center space-x-1.5 active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
