'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import axios from 'axios';
import { authApi, SafeUser } from '../lib/authApi';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  user: SafeUser | null;
  status: AuthStatus;
  error: string | null;
  restoreSession: () => Promise<void>;
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const getSafeProfile = (value: unknown): SafeUser | null => {
  if (
    !value ||
    typeof value !== 'object' ||
    !('id' in value) ||
    typeof value.id !== 'string' ||
    !('email' in value) ||
    typeof value.email !== 'string' ||
    !('name' in value) ||
    typeof value.name !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    email: value.email,
    name: value.name,
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const restoreGeneration = useRef(0);

  const clearSession = useCallback(() => {
    restoreGeneration.current += 1;
    setUser(null);
    setStatus('unauthenticated');
    setError(null);
  }, []);

  const restoreSession = useCallback(async () => {
    const generation = ++restoreGeneration.current;
    setStatus('loading');
    setError(null);

    try {
      const { data } = await authApi.get<{ user?: unknown }>(
        '/api/auth/logged-in-user'
      );
      if (generation !== restoreGeneration.current) {
        return;
      }

      const profile = getSafeProfile(data.user);
      if (!profile) {
        throw new Error('The authentication service returned an invalid user.');
      }

      setUser(profile);
      setStatus('authenticated');
    } catch (requestError) {
      if (generation !== restoreGeneration.current) {
        return;
      }

      setUser(null);
      setStatus('unauthenticated');
      setError(
        axios.isAxiosError(requestError) && requestError.response?.status === 401
          ? null
          : 'Your session could not be checked. Please try again.'
      );
    }
  }, []);

  useEffect(() => {
    void restoreSession();

    const handleSessionChanged = () => {
      void restoreSession();
    };
    const handleSessionCleared = () => clearSession();

    window.addEventListener('auth:session-changed', handleSessionChanged);
    window.addEventListener('auth:session-cleared', handleSessionCleared);
    return () => {
      window.removeEventListener('auth:session-changed', handleSessionChanged);
      window.removeEventListener('auth:session-cleared', handleSessionCleared);
    };
  }, [clearSession, restoreSession]);

  const value = useMemo(
    () => ({ user, status, error, restoreSession, clearSession }),
    [user, status, error, restoreSession, clearSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
