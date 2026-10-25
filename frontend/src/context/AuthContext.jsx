import { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin } from '../api/endpoints';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('aicte_user')); }
    catch { return null; }
  });

  const login = async (username, password) => {
    const res = await apiLogin(username, password);
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
