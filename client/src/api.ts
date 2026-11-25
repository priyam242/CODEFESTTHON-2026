import axios from 'axios';

// Support Vercel / Cloud deployment pointing to external API or fallback to relative /api
export function normalizeApiUrl(raw?: string): string {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    // If running in browser and on a static host, check window / global overrides
    const win = typeof window !== 'undefined' ? (window as any) : undefined;
    const winOverride = win?.__ENV__?.VITE_API_URL || win?.VITE_API_URL || win?.ENV?.VITE_API_URL;
    if (winOverride && typeof winOverride === 'string' && winOverride.trim()) {
      raw = winOverride.trim();
    } else {
      return '/api';
    }
  }

  let trimmed = raw.trim();
  // Ensure protocol if user entered hostname like rentshield.onrender.com or onrender.com
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
    trimmed = `https://${trimmed}`;
  }

  trimmed = trimmed.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

export function getAssetBaseUrl(raw?: string): string {
  if (!raw || typeof raw !== 'string' || !raw.trim()) return '';
  let trimmed = raw.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('/')) {
    trimmed = `https://${trimmed}`;
  }
  trimmed = trimmed.replace(/\/+$/, '');
  return trimmed.replace(/\/api$/, '');
}

export const API_BASE = normalizeApiUrl((import.meta as any).env?.VITE_API_URL);

export const fallbackFixtureSvg =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="%230f172a"/><rect x="16" y="16" width="568" height="368" rx="16" fill="%23020617" stroke="%23334155" stroke-width="2"/><circle cx="300" cy="170" r="42" fill="%2310b981" fill-opacity="0.15" stroke="%2310b981" stroke-width="2.5"/><path d="M285 170l10 10 20-20" stroke="%2310b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><text x="300" y="245" fill="%23f1f5f9" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">CRYPTOGRAPHIC BASELINE EVIDENCE</text><text x="300" y="270" fill="%2310b981" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">SHA-256 VERIFIED RECORD</text></svg>';

export const getAssetUrl = (url: string | null | undefined): string => {
  if (!url) return fallbackFixtureSvg;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const base = getAssetBaseUrl((import.meta as any).env?.VITE_API_URL);
  if (base && url.startsWith('/')) {
    return `${base}${url}`;
  }
  return url;
};

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  },
});

api.interceptors.request.use((config) => {
  // Session storage enables multi-tab isolation (Tenant in Tab 1, Owner in Tab 2 simultaneously)
  const token = sessionStorage.getItem('rentshield_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Guarantee browser cache bypass on GET queries
  if (config.method === 'get') {
    config.params = { ...config.params, _ts: Date.now() };
  }
  return config;
});

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  address?: string | null;
  upiId?: string | null;
}

export interface Item {
  id: string;
  roomName: string;
  itemName: string;
  moveInNotes?: string | null;
  moveInPhotoUrl: string;
  moveInPhotoHash?: string | null;
  moveOutPhotoUrl?: string | null;
  moveOutPhotoHash?: string | null;
  aiVerdict?: 'CLEAN' | 'NORMAL_WEAR_TEAR' | 'DAMAGE_DETECTED' | 'SCENE_MISMATCH' | null;
  aiExplanation?: string | null;
  suggestedCut?: number | string | null;
  tenancyId: string;
  createdAt: string;
}

/**
 * Clean HTML5 Canvas Image Compressor (max dimension 1280px, 0.82 JPEG quality)
 * Prevents huge mobile camera photos from failing payload limits or timing out Gemini.
 */
export const compressImageOnCanvas = async (
  file: File,
  maxDim = 1280,
  quality = 0.82
): Promise<File> => {
  if (!file) return file;
  const isImageMime = file.type && file.type.startsWith('image/');
  const isImageExt = /\.(jpg|jpeg|png|webp|avif|heic|heif)$/i.test(file.name);
  if (!isImageMime && !isImageExt) return file;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width <= maxDim && height <= maxDim && file.size < 400 * 1024) {
          return resolve(file);
        }
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^/.]+$/, '.jpg'),
              {
                type: 'image/jpeg',
                lastModified: Date.now(),
              }
            );
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

export interface Tenancy {
  id: string;
  propertyTitle: string;
  propertyAddress: string;
  depositAmount: number | string;
  depositAmountDecimal?: number | string;
  landlordName: string;
  landlordPhone: string;
  landlordEmail?: string | null;
  landlordUpi?: string | null;
  agreementRef?: string | null;
  signerAudit?: string | any;
  revisionNotes?: string | null;
  landlordToken: string;
  status: 'ACTIVE' | 'APPROVED' | 'COMPLETED' | 'PENDING' | 'REVISION_REQUESTED' | 'VACATED' | 'LOCKED' | 'SETTLED' | string;
  moveInHash?: string | null;
  estimatedRefund?: number | string | null;
  settledAt?: string | null;
  customQrUrl?: string | null;
  landlordQrUrl?: string | null;
  tenantQrUrl?: string | null;
  tenantUpi?: string | null;
  depositPaid?: boolean | null;
  depositPaymentId?: string | null;
  settlementPaymentId?: string | null;
  pendingPaymentStage?: 'DEPOSIT_SENT' | 'REFUND_SENT' | string | null;
  pendingPaymentId?: string | null;
  pendingPaymentAmount?: number | string | null;
  userId: string;
  createdAt: string;
  items?: Item[];
  user?: User;
  tenant?: User;
}

export interface PublicCertificate {
  id: string;
  propertyTitle: string;
  propertyAddress: string;
  depositAmount: number | string;
  landlordName: string;
  landlordUpi?: string | null;
  agreementRef?: string | null;
  signerAudit?: string | any;
  revisionNotes?: string | null;
  status: string;
  depositPaid?: boolean | null;
  depositPaymentId?: string | null;
  settlementPaymentId?: string | null;
  moveInHash: string;
  estimatedRefund?: number | string | null;
  createdAt: string;
  totalItems: number;
  items: Array<{
    roomName: string;
    itemName: string;
    moveInPhotoHash?: string;
    moveOutPhotoHash?: string;
    aiVerdict?: string;
  }>;
}

export const authApi = {
  login: async (email: string, password: string) => {
    const res = await api.post<{ access_token: string; user: User }>('/auth/login', { email, password });
    sessionStorage.setItem('rentshield_token', res.data.access_token);
    sessionStorage.setItem('rentshield_user', JSON.stringify(res.data.user));
    return res.data;
  },
  register: async (email: string, password: string, role = 'TENANT', name = '') => {
    const res = await api.post<{ access_token: string; user: User }>('/auth/register', { email, password, role, name });
    sessionStorage.setItem('rentshield_token', res.data.access_token);
    sessionStorage.setItem('rentshield_user', JSON.stringify(res.data.user));
    return res.data;
  },
  logout: () => {
    sessionStorage.removeItem('rentshield_token');
    sessionStorage.removeItem('rentshield_user');
  },
  getCurrentUser: (): User | null => {
    const raw = sessionStorage.getItem('rentshield_user');
    return raw ? JSON.parse(raw) : null;
  },
  getMe: async (): Promise<User> => {
    const res = await api.get<User>('/auth/me');
    sessionStorage.setItem('rentshield_user', JSON.stringify(res.data));
    return res.data;
  },
  updateProfile: async (data: {
    name?: string;
    email?: string;
    address?: string;
    avatarUrl?: string;
    upiId?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<{ user: User; access_token: string; message: string }> => {
    const res = await api.patch<{ user: User; access_token: string; message: string }>('/auth/profile', data);
    if (res.data.access_token) {
      sessionStorage.setItem('rentshield_token', res.data.access_token);
    }
    if (res.data.user) {
      sessionStorage.setItem('rentshield_user', JSON.stringify(res.data.user));
    }
    return res.data;
  },
  deleteAccount: async (): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete<{ success: boolean; message: string }>('/auth/account');
    authApi.logout();
    return res.data;
  },
};

export const tenancyApi = {
  create: async (data: {
    propertyTitle: string;
    propertyAddress: string;
    depositAmount: number;
    landlordName: string;
    landlordPhone: string;
    landlordEmail?: string;
    landlordUpi?: string;
    agreementRef?: string;
  }) => {
    const res = await api.post<Tenancy>('/tenancy', data);
    return res.data;
  },
  getAll: async () => {
    const res = await api.get<Tenancy[]>('/tenancy');
    if (Array.isArray(res.data)) {
      try {
        sessionStorage.setItem('rentshield_cached_tenancies', JSON.stringify(res.data));
      } catch {}
    }
    return res.data;
  },
  getCachedTenancies: (): Tenancy[] | null => {
    try {
      const raw = sessionStorage.getItem('rentshield_cached_tenancies');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  getOne: async (id: string) => {
    const res = await api.get<Tenancy>(`/tenancy/${id}`);
    return res.data;
  },
  notifyOwner: async (id: string) => {
    const res = await api.post<{ success: boolean; message: string; tenancy: Tenancy }>(`/tenancy/${id}/notify-owner`);
    return res.data;
  },
  getLandlordReview: async (token: string) => {
    // Unauthenticated call targeting normalized API_BASE
    const res = await axios.get<Tenancy>(`${API_BASE}/tenancy/verify/${token}`, {
      params: { _ts: Date.now() },
    });
    return res.data;
  },
  approveLandlordReview: async (token: string, signerData?: any) => {
    // Unauthenticated call targeting normalized API_BASE
    const res = await axios.post<Tenancy>(`${API_BASE}/tenancy/verify/${token}/approve`, { signerData });
    return res.data;
  },
  requestRevision: async (token: string, notes: string) => {
    const res = await axios.post<Tenancy>(`${API_BASE}/tenancy/verify/${token}/revision`, { notes });
    return res.data;
  },
  settle: async (id: string, data?: { customQrUrl?: string; tenantUpi?: string; landlordUpi?: string }) => {
    const res = await api.patch<Tenancy>(`/tenancy/${id}/settle`, data);
    return res.data;
  },
  settleByToken: async (token: string, data?: { customQrUrl?: string; tenantUpi?: string; landlordUpi?: string }) => {
    const res = await axios.post<Tenancy>(`${API_BASE}/tenancy/verify/${token}/settle`, data);
    return res.data;
  },
  getCertificate: async (idOrToken: string) => {
    // Public unauthenticated certificate inspection targeting normalized API_BASE
    const res = await axios.get<PublicCertificate>(`${API_BASE}/tenancy/certificate/${idOrToken}`, {
      params: { _ts: Date.now() },
    });
    return res.data;
  },
  getLatestDemoCertificate: async () => {
    // Public 1-click demo certificate for judges targeting normalized API_BASE
    const res = await axios.get<PublicCertificate>(`${API_BASE}/tenancy/certificate/demo/latest`, {
      params: { _ts: Date.now() },
    });
    return res.data;
  },
  auditLease: async (clauseText: string): Promise<LeaseAuditResult> => {
    const res = await axios.post<LeaseAuditResult>(`${API_BASE}/tenancy/audit-lease`, { clauseText });
    return res.data;
  },
};

export interface LeaseAuditResult {
  riskScore: number;
  verdict: 'HIGH_RISK' | 'MODERATE_RISK' | 'COMPLIANT';
  summary: string;
  modelUsed: string;
  flaggedClauses: Array<{
    section: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    issue: string;
    clauseExcerpt: string;
    fairReplacement: string;
  }>;
}

export const itemsApi = {
  uploadMoveIn: async (formData: FormData) => {
    const res = await api.post<Item>('/items/move-in', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  uploadMoveOut: async (itemId: string, formData: FormData) => {
    const res = await api.post<Item>(`/items/${itemId}/move-out`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};

export const paymentsApi = {
  createOrder: async (data: {
    tenancyId: string;
    stage: 'DEPOSIT' | 'SETTLEMENT';
    amount?: number;
    landlordToken?: string;
  }) => {
    const res = await api.post('/payments/create-order', data);
    return res.data;
  },
  verify: async (data: {
    tenancyId: string;
    stage: 'DEPOSIT' | 'SETTLEMENT';
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    method?: string;
    action?: 'MARK_SENT' | 'CONFIRM_RECEIVED';
    utrNumber?: string;
    landlordToken?: string;
    customQrUrl?: string;
    tenantUpi?: string;
    landlordUpi?: string;
  }) => {
    const res = await api.post<{
      success: boolean;
      stage: string;
      paymentId: string;
      tenancy: Tenancy;
    }>('/payments/verify', data);
    return res.data;
  },
  confirmDirectPayment: async (data: {
    tenancyId: string;
    stage: 'DEPOSIT' | 'SETTLEMENT';
    landlordToken?: string;
    action?: 'CONFIRM_RECEIVED';
  }) => {
    const res = await api.post<{
      success: boolean;
      stage: string;
      paymentId: string;
      tenancy: Tenancy;
    }>('/payments/verify', {
      ...data,
      method: 'DIRECT_UPI_SCAN',
      action: 'CONFIRM_RECEIVED',
    });
    return res.data;
  },
  updateRecipient: async (data: {
    tenancyId?: string;
    landlordToken?: string;
    tenantUpi?: string;
    landlordUpi?: string;
    customQrUrl?: string;
    landlordQrUrl?: string;
    tenantQrUrl?: string;
  }) => {
    const res = await api.post<Tenancy>('/payments/update-recipient', data);
    return res.data;
  },
};
