'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../components/AuthProvider';
import { StoreHeader } from '../components/StoreHeader';
import { getAccountRouteRedirect } from '../lib/routeAccess';

export default function AccountPage() {
  const router = useRouter();
  const { user, status, error, restoreSession } = useAuth();

  useEffect(() => {
    const redirectPath = getAccountRouteRedirect(status);
    if (redirectPath) {
      router.replace(redirectPath);
    }
  }, [router, status]);

  return (
    <main className="store-shell">
      <StoreHeader />

      {status === 'loading' ? (
        <section className="auth-panel" role="status">
          Checking your session…
        </section>
      ) : user ? (
        <section className="auth-panel account-panel" aria-labelledby="account-title">
          <p className="catalog-eyebrow">YOUR ACCOUNT</p>
          <h1 id="account-title">Welcome, {user.name}</h1>
          <dl className="account-profile">
            <div>
              <dt>Name</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
          </dl>
          <Link className="account-shopping-link" href="/">
            Continue shopping
          </Link>
        </section>
      ) : (
        <section className="auth-panel" aria-labelledby="account-title">
          <h1 id="account-title">Sign-in required</h1>
          {error ? (
            <>
              <p className="auth-error" role="alert">
                {error}
              </p>
              <button
                className="auth-submit"
                onClick={() => void restoreSession()}
                type="button"
              >
                Try again
              </button>
            </>
          ) : (
            <p className="auth-intro">
              Redirecting to sign in.{' '}
              <Link href="/login?next=%2Faccount">Continue</Link>
            </p>
          )}
        </section>
      )}
    </main>
  );
}
