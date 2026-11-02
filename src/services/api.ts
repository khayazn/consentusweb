import axios, { type AxiosRequestConfig } from "axios";

// Matches the mobile app: /api is part of the base URL
export const API_BASE_URL = "https://api-v1.consentus.online/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Auto-attach JWT from localStorage (browser equivalent of AsyncStorage)
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Suppress known-benign errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url || "";
    const status = error.response?.status;
    
    // ✅ Silently ignore ANY error from the /nearby endpoint (dormant users, etc.)
    if (url.includes("/nearby")) {
      return Promise.reject(error);
    }
    
    // Silently ignore 403s from pinch/date-request limits
    if (status === 403 && (url.includes("/pinches") || url.includes("/date-requests"))) {
      return Promise.reject(error);
    }
    
    // Suppress login 401s (wrong password is handled by the UI)
    if (!(status === 401 && url.includes("/auth/login"))) {
      console.error("API Error:", error.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

// ---------- Generic request helpers ----------

export const makeAuthenticatedRequest = async (
  method: string,
  url: string,
  data: unknown = null
) => {
  const cleanUrl = url.startsWith("/") ? url.substring(1) : url;
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const config: AxiosRequestConfig = {
    method,
    url: `${API_BASE_URL}/${cleanUrl}`,
    headers,
  };
  if (data) config.data = data;
  return axios(config);
};

export const makeUnauthenticatedRequest = async (
  method: string,
  endpoint: string,
  data: unknown = null
) => {
  const config: AxiosRequestConfig = {
    method,
    url: `${API_BASE_URL}${endpoint}`,
    headers: { "Content-Type": "application/json" },
  };
  if (data && (method === "POST" || method === "PUT")) config.data = data;
  return axios(config);
};

// ---------- Endpoint modules (1:1 with mobile) ----------

export const authAPI = {
  register: (userData: FormData | Record<string, unknown>) => {
    const isFormData = userData instanceof FormData;
    return api.post("/auth/register", userData, {
      headers: {
        "Content-Type": isFormData ? "multipart/form-data" : "application/json",
      },
    });
  },
  login: (credentials: { email: string; password: string }) =>
    api.post("/auth/login", credentials),
};

export const userAPI = {
  updateProfile: (profileData: Record<string, unknown>) =>
    api.put("/profile", profileData),
  getNearbyUsers: (userId: number, gender: string, page = 1, limit = 100) =>
    api.get(`/users/${userId}/nearby`, { params: { gender, page, limit } }),
  getAllUsers: () => api.get("/users"),
  searchByHandle: (handle: string) => api.get(`/users/search/${handle}`),
  getProfile: (userId: number) => api.get(`/profile?user_id=${userId}`),
  getUserById: (userId: number) => api.get(`/users/${userId}`),
  updateLocation: (userId: number, location: Record<string, unknown>) =>
    api.patch(`/users/${userId}/location`, location),
  checkGPSStatus: (userId: number) => api.get(`/users/${userId}/gps-status`),
  getUserRatings: (userId: number) => api.get(`/ratings/user/${userId}`),
};

export const dateAPI = {
  createRequest: (requestData: Record<string, unknown>) =>
    api.post("/date-requests", requestData),
  respondToRequest: (requestId: number, responseData: Record<string, unknown>) =>
    api.post(`/date-requests/${requestId}/respond`, responseData),
  getPendingRequests: (userId: number) => api.get(`/date-requests/${userId}`),
  getSentRequests: (userId: number) =>
    api.get(`/date-requests/sent/${userId}`),
  getActiveDates: (userId: number) =>
    api.get(`/date-requests/${userId}/active`),
  getPendingCount: (userId: number) =>
    api.get(`/date-requests/${userId}/count`),
  startDate: (requestId: number, userId: number) =>
    api.post(`/date-requests/${requestId}/start`, { user_id: userId }),
  confirmDate: (requestId: number, userId: number) =>
    api.post(`/date-requests/${requestId}/confirm`, { user_id: userId }),
  endDate: (requestId: number, userId: number) =>
    api.post(`/date-requests/${requestId}/end`, { user_id: userId }),
  requestEndDate: (requestId: number, userId: number) =>
    api.post(`/date-requests/${requestId}/request-end`, { requested_by: userId }),
  confirmEndDate: (requestId: number, userId: number) =>
    api.post(`/date-requests/${requestId}/confirm-end`, { user_id: userId }),
  getInvoiceDetails: (requestId: number, userId: number | null = null) => {
    const params = userId ? { user_id: userId } : {};
    return api.get(`/date-requests/${requestId}/invoice`, { params });
  },
  getDateTimeline: (requestId: number) =>
    api.get(`/date-requests/${requestId}/timeline`),
  submitPaymentProof: (requestId: number, formData: FormData) =>
    api.post(`/date-requests/${requestId}/submit-payment`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000,
    }),
  getPaymentProof: (requestId: number, userId: number | null = null) => {
    const params = userId ? { user_id: userId } : {};
    return api.get(`/date-requests/${requestId}/payment-proof`, { params });
  },
  confirmPayment: (requestId: number, data: Record<string, unknown>) =>
    api.post(`/date-requests/${requestId}/confirm-payment`, data),
  rejectPayment: (requestId: number, data: Record<string, unknown>) =>
    api.post(`/date-requests/${requestId}/reject-payment`, data),
  rejectPaymentProof: (requestId: number, data: Record<string, unknown>) =>
    api.post(`/date-requests/${requestId}/reject-payment-proof`, data),
  getPaymentTimeline: (requestId: number) =>
    api.get(`/date-requests/${requestId}/payment-timeline`),
};

export const pinchAPI = {
  sendPinch: (pinchedId: number, caption: string | null = null) => {
    const payload: { pinched_id: number; caption?: string } = {
      pinched_id: pinchedId,
    };
    if (caption) payload.caption = caption;
    return api.post("/pinches", payload);
  },
  getReceivedPinches: (userId: number) =>
    api.get(`/pinches/received/${userId}`),
  getSentPinches: (userId: number) => api.get(`/pinches/sent/${userId}`),
  markPinchAsRead: (pinchId: number) => api.put(`/pinches/${pinchId}/read`),
  pinchBack: (pinchId: number) => api.post(`/pinches/${pinchId}/pinch-back`),
  rejectPinch: (pinchId: number) => api.post(`/pinches/${pinchId}/reject`),
  restorePinch: (pinchId: number) => api.post(`/pinches/${pinchId}/restore`),
  getPinchHistory: (userId: number) => api.get(`/pinches/history/${userId}`),
  getUnreadPinchCount: (userId: number) =>
    api.get(`/users/${userId}/unread-pinch-count`),
  checkPinchStatus: (userId: number, otherUserId: number) =>
    api.get(`/pinches/check/${userId}/${otherUserId}`),
};

export const ratingAPI = {
  getUserRatings: (userId: number) => api.get(`/ratings/user/${userId}`),
  getAverageRating: (userId: number) => api.get(`/average_rating/${userId}`),
  getRequestRating: (requestId: number, userId: number) =>
    api.get(`/request_rating/${requestId}`, { params: { user_id: userId } }),
  submitRating: (ratingData: Record<string, unknown>) =>
    api.post("/ratings/submit", ratingData),
  checkRequestRating: (requestId: number) =>
    api.get(`/ratings/date-request/${requestId}`),
  deleteRating: (ratingId: number) => api.delete(`/ratings/${ratingId}`),
  updateRating: (ratingId: number, ratingData: Record<string, unknown>) =>
    api.put(`/ratings/${ratingId}`, ratingData),
};

export const reportAPI = {
  reportUser: (targetId: number, reason: string | null = null) =>
    api.post(`/users/${targetId}/report`, reason ? { reason } : {}),
};

export const blockAPI = {
  blockUser: (targetId: number) => api.post(`/users/${targetId}/block`),
  unblockUser: (targetId: number) => api.delete(`/users/${targetId}/block`),
  getBlockStatus: (targetId: number) =>
    api.get(`/users/${targetId}/block-status`),
};

export const subscriptionAPI = {
  getStatus: (userId: number) => api.get(`/subscription/status/${userId}`),
  getUsageLimits: (userId: number) => api.get(`/subscription/limits/${userId}`),
  initializePayment: () => api.post("/subscription/initialize-payment"),
  verifyPayment: (reference: string) =>
    api.get(`/subscription/verify-payment?reference=${encodeURIComponent(reference)}`),
};

export const chatAPI = {
  getConversations: (userId: number) => api.get(`/conversations/${userId}`),
  getMessages: (conversationId: string) =>
    api.get(`/messages/${conversationId}`),
  sendMessage: (messageData: Record<string, unknown>) =>
    api.post("/messages", messageData),
  getUnreadCount: (userId: number) =>
    api.get(`/messages/unread-count/${userId}`),
};

// ---------- TypeScript shapes (best-effort — extend when you see real responses) ----------

export interface User {
  id: number;
  username: string;
  email?: string;
  age?: number;
  bio?: string;
  interests?: string;
  description?: string;
  country?: string;
  gender?: string;
  photos?: string[];
  photo?: string;
  user_type?: string; // 'dating' | 'professional' | 'product' | 'general'
  is_available?: boolean;
  is_verified?: boolean;
  average_rating?: number;
  total_ratings?: number;
  rating?: number;
  distance_km?: number;
  latitude?: number;
  longitude?: number;
  created_at?: string;
}

export interface NearbyResponse {
  users: User[];
  pagination: {
    total_users: number;
    page: number;
    page_size: number;
    has_more: boolean;
    within_20km_count?: number;
    beyond_20km_count?: number;
  };
}