/**
 * Axios API client configured to talk to the FastAPI backend.
 * Automatically attaches JWT token and handles 401 redirects.
 */

import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Attach token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('aicte_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 clear auth and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('aicte_token');
      localStorage.removeItem('aicte_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
