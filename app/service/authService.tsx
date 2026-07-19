import axios from 'axios';
import { API_BASE_URL } from '../constants/apiBaseUrl';

const BASE_URL = API_BASE_URL;

export type AdminNotification = {
  id: number;
  notificationType: string;
  referenceId?: number;
  title: string;
  message: string;
  isRead?: boolean;
  createdAt?: string;
  userName?: string;
  userPhone?: string;
  userRole?: string;
  category?: string;
  description?: string;
  supportStatus?: string;
  adminReply?: string;
  repliedAt?: string;
};

export type UserSupportRequest = {
  id: number;
  category: string;
  description: string;
  role?: string;
  status?: string;
  adminReply?: string | null;
  repliedAt?: string | null;
  replySeenAt?: string | null;
  createdAt?: string;
};

export async function sendOtpToPhone(phone: string, expoPushToken: string, type: 'signin' | 'signup') {
  try {
    const response = await axios.post(`${BASE_URL}/send-otp`, {
      phone,
      expoPushToken,
      type,
    });
    return response.data;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Create a new user
export async function createUser(name: string, phone: string, mpin: string, role: 'organizer' | 'player' | 'admin') {
  try {
    const response = await axios.post(`${BASE_URL}/users/signup`, {
      name,
      phone,
      mpin,
      role,
    });
    return response.data;
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message };
  }
}

// Authenticate user by phone and mpin
export async function authenticateUser(phone: string, mpin: string) {
  try {
    const response = await axios.post(`${BASE_URL}/users/signin`, {
      phone,
      mpin,
    });
    return response.data;
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message };
  }
}

export async function submitSupportRequest(payload: {
  user_id?: number | string;
  user_name?: string;
  user_phone?: string;
  role?: 'organizer' | 'player' | 'admin';
  category: string;
  description: string;
}) {
  try {
    const response = await axios.post(`${BASE_URL}/users/support`, payload);
    return response.data;
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message };
  }
}

export async function getAdminNotifications() {
  try {
    const response = await axios.get(`${BASE_URL}/users/admin/notifications`);
    return response.data;
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message };
  }
}

export async function deleteAdminNotification(notificationId: number | string) {
  try {
    const response = await axios.delete(`${BASE_URL}/users/admin/notifications/${notificationId}`);
    return response.data;
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message };
  }
}

export async function replyToAdminNotification(notificationId: number | string, replyMessage: string) {
  try {
    const response = await axios.post(`${BASE_URL}/users/admin/notifications/${notificationId}/reply`, {
      replyMessage,
    });
    return response.data;
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message };
  }
}

export async function getSupportRepliesForUser(phone: string | number) {
  try {
    const response = await axios.get(`${BASE_URL}/users/support/replies/${encodeURIComponent(String(phone))}`);
    return response.data;
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message };
  }
}

export default {
  sendOtpToPhone,
  createUser,
  authenticateUser,
  submitSupportRequest,
  getAdminNotifications,
  deleteAdminNotification,
  replyToAdminNotification,
  getSupportRepliesForUser,
};