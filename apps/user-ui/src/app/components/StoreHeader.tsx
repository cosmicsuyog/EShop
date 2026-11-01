'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authApi } from '../lib/authApi';
import { useAuth } from './AuthProvider';

export function StoreHeader() {
  const router = useRouter();
  const { user, status, clearSession } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = async () => {
    setIsSigningOut(true);
    try {
      await authApi.post('/api/auth/logout-user');
      clearSession();
      router.replace('/login?logout=success');
    } catch {
      clearSession();
      router.replace('/login?logout=failed');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="store-header">
      <Link className="store-brand" href="/" aria-label="EShop home">
        <span className="store-brand-mark">E</span>
        <span>eshop</span>
      </Link>
      <span className="store-header-note">Thoughtful finds, everyday.</span>
      <nav className="auth-header-actions" aria-label="Account">
        {status === 'loading' ? (
          <span className="auth-header-status" role="status">
            Checking account…
          </span>
        ) : user ? (
          <>
            <Link className="auth-header-link" href="/account">
              {user.name}
            </Link>
            <button
              className="auth-header-link auth-sign-out"
              disabled={isSigningOut}
              onClick={signOut}
              type="button"
            >
              {isSigningOut ? 'Signing out…' : 'Sign out'}
            </button>
          </>
        ) : (
          <>
            <Link className="auth-header-link" href="/login">
              Sign in
            </Link>
            <Link className="auth-header-link" href="/register">
              Create account
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
