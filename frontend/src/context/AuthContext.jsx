import { createContext, useContext, useState } from 'react';
import { login as apiLogin } from '../api/endpoints';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('aicte_user');
      if (!raw || raw === 'undefined' || raw === 'null') return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  const login = async (username, password) => {
    const res = await apiLogin(username, password);

    // Validate response payload to prevent silent failures when Vercel returns HTML
    if (!res.data || typeof res.data !== 'object' || !res.data.access_token || !res.data.user) {
      const isHtml = typeof res.data === 'string' && (res.data.includes('<!DOCTYPE') || res.data.includes('<html'));
      if (isHtml) {
        throw new Error(
          'Backend API not reachable. In Vercel, please set the VITE_API_URL environment variable to your deployed backend URL.'
        );
      }
      throw new Error('Invalid response received from authentication server.');
    }

    const { access_token, user: userData } = res.data;
    localStorage.setItem('aicte_token', access_token);
    localStorage.setItem('aicte_user', JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('aicte_token');
    localStorage.removeItem('aicte_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

