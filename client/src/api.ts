import axios from 'axios';

// Support Vercel / Cloud deployment pointing to external API or fallback to relative /api
const API_BASE = (import.meta as any).env?.VITE_API_URL
  ? `${(import.meta as any).env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

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
    // Unauthenticated call
    const res = await axios.get<Tenancy>(`/api/tenancy/verify/${token}`, {
      params: { _ts: Date.now() },
    });
    return res.data;
  },
  approveLandlordReview: async (token: string) => {
    // Unauthenticated call
    const res = await axios.post<Tenancy>(`/api/tenancy/verify/${token}/approve`);
    return res.data;
  },
  getCertificate: async (idOrToken: string) => {
    // Public unauthenticated certificate inspection
    const res = await axios.get<PublicCertificate>(`/api/tenancy/certificate/${idOrToken}`, {
      params: { _ts: Date.now() },
    });
    return res.data;
  },
  getLatestDemoCertificate: async () => {
    // Public 1-click demo certificate for judges
    const res = await axios.get<PublicCertificate>('/api/tenancy/certificate/demo/latest', {
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
