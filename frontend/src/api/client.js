/**
 * Axios HTTP client with JWT token management and interceptors.
 */

import axios from 'axios';

const API_BASE_URL = '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT token
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: handle 401 and token refresh
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token, refresh_token } = response.data;
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);

          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return client(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default client;

// Auth API
export const authAPI = {
  register: (data) => client.post('/auth/register', data),
  login: (data) => client.post('/auth/login', data),
  refresh: (refreshToken) => client.post('/auth/refresh', { refresh_token: refreshToken }),
  getProfile: () => client.get('/auth/me'),
};

// Connections API
export const connectionsAPI = {
  list: () => client.get('/connections'),
  create: (data) => client.post('/connections', data),
  get: (id) => client.get(`/connections/${id}`),
  update: (id, data) => client.put(`/connections/${id}`, data),
  delete: (id) => client.delete(`/connections/${id}`),
  test: (id) => client.post(`/connections/${id}/test`),
};

// Discovery API
export const discoveryAPI = {
  getSchemas: (connId) => client.get(`/discovery/${connId}/schemas`),
  getTables: (connId, schema) => client.get(`/discovery/${connId}/tables`, { params: { schema } }),
  getColumns: (connId, table, schema) =>
    client.get(`/discovery/${connId}/tables/${table}/columns`, { params: { schema } }),
  previewData: (connId, table, params) =>
    client.get(`/discovery/${connId}/tables/${table}/preview`, { params }),
  getRowCount: (connId, table, schema) =>
    client.get(`/discovery/${connId}/tables/${table}/count`, { params: { schema } }),
};

// Transfers API
export const transfersAPI = {
  create: (data) => client.post('/transfers', data),
  list: (params) => client.get('/transfers', { params }),
  get: (id) => client.get(`/transfers/${id}`),
  getLogs: (id) => client.get(`/transfers/${id}/logs`),
  cancel: (id) => client.post(`/transfers/${id}/cancel`),
};

// Monitoring API
export const monitoringAPI = {
  getDashboard: () => client.get('/monitoring/dashboard'),
  getConnectionStatuses: () => client.get('/monitoring/connections/status'),
  getActivity: (limit) => client.get('/monitoring/activity', { params: { limit } }),
  getMetrics: () => client.get('/monitoring/metrics'),
};
