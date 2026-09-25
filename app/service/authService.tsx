import axios from 'axios';
import { API_BASE_URL } from '../../constants/apiBaseUrl';
import { getApiErrorMessage } from '../../utils/apiError';

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

export async function createUser(
  name: string,
  phone: string,
  mpin: string,
  role: 'organizer' | 'player',
) {
  try {
    const response = await axios.post(`${BASE_URL}/users/signup`, {
      name,
      phone,
      mpin,
      role,
    });
    return response.data;
  } catch (error: any) {
    return { success: false, error: getApiErrorMessage(error, 'Signup failed. Please try again.') };
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
    return { success: false, error: getApiErrorMessage(error, 'Sign in failed. Please try again.') };
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
    return { success: false, error: getApiErrorMessage(error, 'Failed to submit your support request.') };
  }
}

export async function getAdminNotifications() {
  try {
    const response = await axios.get(`${BASE_URL}/users/admin/notifications`);
    return response.data;
  } catch (error: any) {
    return { success: false, error: getApiErrorMessage(error, 'Failed to load notifications.') };
  }
}

export async function deleteAdminNotification(notificationId: number | string) {
  try {
    const response = await axios.delete(`${BASE_URL}/users/admin/notifications/${notificationId}`);
    return response.data;
  } catch (error: any) {
    return { success: false, error: getApiErrorMessage(error, 'Failed to delete the notification.') };
  }
}

export async function replyToAdminNotification(notificationId: number | string, replyMessage: string) {
  try {
    const response = await axios.post(`${BASE_URL}/users/admin/notifications/${notificationId}/reply`, {
      replyMessage,
    });
    return response.data;
  } catch (error: any) {
    return { success: false, error: getApiErrorMessage(error, 'Failed to send the reply.') };
  }
}

export async function getSupportRepliesForUser(phone: string | number) {
  try {
    const response = await axios.get(`${BASE_URL}/users/support/replies/${encodeURIComponent(String(phone))}`);
    return response.data;
  } catch (error: any) {
    return { success: false, error: getApiErrorMessage(error, 'Failed to load support replies.') };
  }
}

export default {
  createUser,
  authenticateUser,
  submitSupportRequest,
  getAdminNotifications,
  deleteAdminNotification,
  replyToAdminNotification,
  getSupportRepliesForUser,
};