'use client';

import Link from 'next/link';
import { useAuth } from './AuthProvider';

export function StoreHeader() {
  const { user, status } = useAuth();

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
          <Link className="auth-header-link" href="/account">
            {user.name}
          </Link>
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
