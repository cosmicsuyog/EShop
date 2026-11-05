'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import {
  getApiErrorMessage,
  getPostLoginPath,
  loginCustomer,
} from '../lib/authApi';
import { StoreHeader } from '../components/StoreHeader';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const logoutState = new URLSearchParams(window.location.search).get(
      'logout'
    );
    if (logoutState === 'success') {
      setNotice('You have signed out on this browser.');
    } else if (logoutState === 'failed') {
      setError(
        'We could not confirm sign out. Your server session may still be active.'
      );
    }
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await loginCustomer(normalizedEmail, password);

      window.dispatchEvent(new Event('auth:session-changed'));
      router.replace(getPostLoginPath(window.location.search));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      setIsSubmitting(false);
    }
  };

  return (
    <main className="store-shell">
      <StoreHeader />

      <section className="auth-panel" aria-labelledby="login-title">
        <p className="catalog-eyebrow">WELCOME BACK</p>
        <h1 id="login-title">Sign in to your account</h1>
        <p className="auth-intro">
          Sign in to continue to your EShop account.
        </p>

        {notice && (
          <p className="auth-notice" role="status">
            {notice}
          </p>
        )}

        <form className="auth-form" onSubmit={submit} noValidate>
          <label htmlFor="login-email">Email address</label>
          <input
            autoComplete="email"
            id="login-email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />

          <label htmlFor="login-password">Password</label>
          <input
            autoComplete="current-password"
            id="login-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button className="auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          <Link href="/forgot-password">Forgot your password?</Link>
        </p>
        <p className="auth-switch">
          New to EShop? <Link href="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
