'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { StoreHeader } from '../../components/StoreHeader';
import { getSellerApiErrorMessage, loginSeller } from '../../lib/sellerApi';

export default function SellerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (
      !normalizedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      setError('Enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await loginSeller(normalizedEmail, password);
      router.replace('/seller/register');
    } catch (requestError) {
      setError(getSellerApiErrorMessage(requestError));
      setIsSubmitting(false);
    }
  };

  return (
    <main className="store-shell">
      <StoreHeader />

      <section className="auth-panel" aria-labelledby="seller-login-title">
        <p className="catalog-eyebrow">SELL WITH ESHOP</p>
        <h1 id="seller-login-title">Seller sign in</h1>
        <p className="auth-intro">Sign in to continue setting up your shop.</p>

        <form className="auth-form" onSubmit={submit} noValidate>
          <label htmlFor="seller-login-email">Email address</label>
          <input
            autoComplete="email"
            id="seller-login-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />

          <label htmlFor="seller-login-password">Password</label>
          <input
            autoComplete="current-password"
            id="seller-login-password"
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
            {isSubmitting ? 'Signing in…' : 'Sign in as seller'}
          </button>
        </form>

        <p className="auth-switch">
          New seller? <Link href="/seller/register">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
