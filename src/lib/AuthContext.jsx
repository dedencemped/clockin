import React, { createContext, useState, useContext, useEffect } from 'react';
import { getApiBase } from '@/lib/utils';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem('auth_user');
    const rawFilter = localStorage.getItem('selected_company_id');
    if (raw) {
      try {
        const u = JSON.parse(raw);
        setUser(u);
        setIsAuthenticated(true);
        // hydrate selected company for superadmin or default to user's company
        if (rawFilter) {
          try {
            const v = JSON.parse(rawFilter);
            setSelectedCompanyId(typeof v === 'number' || v === null ? v : null);
          } catch {
            setSelectedCompanyId(null);
          }
        } else {
          setSelectedCompanyId(u?.role === 'superadmin' ? null : (u?.company_id || null));
        }
      } catch (_) {
        localStorage.removeItem('auth_user');
      }
    } else {
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: 'Authentication required' });
    }
  }, []);

  const updateSelectedCompanyId = (id) => {
    const norm = (id === null || id === undefined) ? null : Number(id);
    setSelectedCompanyId(Number.isFinite(norm) ? norm : null);
    try { localStorage.setItem('selected_company_id', JSON.stringify(Number.isFinite(norm) ? norm : null)); } catch {}
  };

  const checkAppState = async () => {};

  const login = async (email, password) => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Login gagal');
      }
      const data = await res.json();
      setUser(data.user);
      setIsAuthenticated(true);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      // set default selected company
      updateSelectedCompanyId(data.user?.role === 'superadmin' ? null : (data.user?.company_id || null));
      setIsLoadingAuth(false);
      return data.user;
    } catch (e) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_failed', message: e.message });
      throw e;
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('selected_company_id');
    setSelectedCompanyId(null);
    if (shouldRedirect) {
      try {
        const isPreview = typeof window !== 'undefined' && window.location && window.location.port === '4173';
        const target = isPreview ? '/#/Login' : '/Login';
        const current = typeof window !== 'undefined'
          ? ((window.location.hash && window.location.hash.startsWith('#/')) ? window.location.hash.slice(1) : window.location.pathname)
          : '';
        const normalized = (current || '').toLowerCase();
        if (normalized === '/login' || normalized.endsWith('/login')) return;
        window.location.href = target;
      } catch (_) {}
    }
  };

  const navigateToLogin = () => {
    const isPreview = typeof window !== 'undefined' && window.location && window.location.port === '4173';
    const target = isPreview ? '/#/Login' : '/Login';
    try {
      const current = typeof window !== 'undefined'
        ? ((window.location.hash && window.location.hash.startsWith('#/')) ? window.location.hash.slice(1) : window.location.pathname)
        : '';
      const normalized = (current || '').toLowerCase();
      if (normalized === '/login' || normalized.endsWith('/login')) return;
      if (typeof window !== 'undefined') window.location.href = target;
    } catch (_) {}
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      selectedCompanyId,
      updateSelectedCompanyId,
      setSelectedCompanyId: updateSelectedCompanyId,
      login,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
