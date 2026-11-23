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
  aiVerdict?: 'NORMAL_WEAR_TEAR' | 'DAMAGE_DETECTED' | null;
  aiExplanation?: string | null;
  suggestedCut?: number | string | null;
  tenancyId: string;
  createdAt: string;
}

export interface Tenancy {
  id: string;
  propertyTitle: string;
  propertyAddress: string;
  depositAmount: number | string;
  depositAmountDecimal?: number | string;
  landlordName: string;
  landlordPhone: string;
  landlordEmail?: string | null;
  landlordToken: string;
  status: 'ACTIVE' | 'APPROVED' | 'COMPLETED';
  moveInHash?: string | null;
  estimatedRefund?: number | string | null;
  userId: string;
  createdAt: string;
  items?: Item[];
}

export interface PublicCertificate {
  id: string;
  propertyTitle: string;
  propertyAddress: string;
  depositAmount: number | string;
  landlordName: string;
  status: string;
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
};

export const tenancyApi = {
  create: async (data: {
    propertyTitle: string;
    propertyAddress: string;
    depositAmount: number;
    landlordName: string;
    landlordPhone: string;
    landlordEmail?: string;
  }) => {
    const res = await api.post<Tenancy>('/tenancy', data);
    return res.data;
  },
  getAll: async () => {
    const res = await api.get<Tenancy[]>('/tenancy');
    return res.data;
  },
  getOne: async (id: string) => {
    const res = await api.get<Tenancy>(`/tenancy/${id}`);
    return res.data;
  },
  getLandlordReview: async (token: string) => {
    // Unauthenticated call targeting normalized API_BASE
    const res = await axios.get<Tenancy>(`${API_BASE}/tenancy/verify/${token}`, {
      params: { _ts: Date.now() },
    });
    return res.data;
  },
  approveLandlordReview: async (token: string) => {
    // Unauthenticated call targeting normalized API_BASE
    const res = await axios.post<Tenancy>(`${API_BASE}/tenancy/verify/${token}/approve`);
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
};

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
