'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import {
  authApi,
  getApiErrorMessage,
  getPostLoginPath,
  isSafeUser,
} from '../lib/authApi';

type LoginResponse = {
  user?: unknown;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const { data } = await authApi.post<LoginResponse>('/api/login-user', {
        email: normalizedEmail,
        password,
      });

      if (!isSafeUser(data.user)) {
        throw new Error('The authentication service returned an invalid user.');
      }

      window.dispatchEvent(new Event('auth:session-changed'));
      router.replace(getPostLoginPath(window.location.search));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
      setIsSubmitting(false);
    }
  };

  return (
    <main className="store-shell">
      <header className="store-header">
        <Link className="store-brand" href="/" aria-label="EShop home">
          <span className="store-brand-mark">E</span>
          <span>eshop</span>
        </Link>
        <Link className="auth-header-link" href="/">
          Continue shopping
        </Link>
      </header>

      <section className="auth-panel" aria-labelledby="login-title">
        <p className="catalog-eyebrow">WELCOME BACK</p>
        <h1 id="login-title">Sign in to your account</h1>
        <p className="auth-intro">
          Sign in to continue to your EShop account.
        </p>

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
          New to EShop? <Link href="/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
