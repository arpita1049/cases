import axios from 'axios';

/**
 * Normalizes the API base URL:
 * - If VITE_API_URL is set (e.g. "https://your-backend.onrender.com"), strips trailing slashes
 *   and ensures /api is cleanly appended without duplicates.
 * - In local dev without VITE_API_URL, defaults to '/api' so Vite proxy forwards to :8000.
 */
export function getBaseUrl() {
  const raw = import.meta.env.VITE_API_URL;
  if (!raw || !raw.trim()) {
    return '/api';
  }
  const clean = raw.trim().replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
}

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 45000, // 45s timeout to handle free-tier cold starts (e.g. Render)
});

// Attach token from localStorage safely
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('aicte_token');
  if (token && token !== 'undefined' && token !== 'null') {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 clear auth and redirect to login EXCEPT if the request was the login attempt itself
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginEndpoint =
      err.config?.url?.includes('/auth/login') ||
      err.config?.url?.includes('/auth/token');

    if (err.response?.status === 401 && !isLoginEndpoint) {
      localStorage.removeItem('aicte_token');
      localStorage.removeItem('aicte_user');
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

