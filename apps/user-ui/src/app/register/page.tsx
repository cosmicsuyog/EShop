'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import {
  authApi,
  getApiErrorMessage,
  getPostLoginPath,
} from '../lib/authApi';

type RegistrationValues = {
  name: string;
  email: string;
  password: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [values, setValues] = useState<RegistrationValues>({
    name: '',
    email: '',
    password: '',
  });
  const [otp, setOtp] = useState('');
  const [isVerificationStep, setIsVerificationStep] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateValue = (field: keyof RegistrationValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!isVerificationStep) {
      const email = values.email.trim();
      if (!values.name.trim()) {
        setError('Enter your name.');
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Enter a valid email address.');
        return;
      }
      if (!values.password) {
        setError('Enter a password.');
        return;
      }
      setValues((current) => ({ ...current, email }));
    } else if (!/^\d{4}$/.test(otp)) {
      setError('Enter the four-digit verification code sent to your email.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!isVerificationStep) {
        await authApi.post('/api/user-registration', {
          ...values,
          email: values.email.trim(),
        });
        setIsVerificationStep(true);
        return;
      }

      await authApi.post('/api/verify-registration', {
        ...values,
        email: values.email.trim(),
        otp,
      });
      setIsRegistered(true);

      try {
        await authApi.post('/api/login-user', {
          email: values.email.trim(),
          password: values.password,
        });
        window.dispatchEvent(new Event('auth:session-changed'));
        router.replace(getPostLoginPath(window.location.search));
      } catch {
        setError(
          'Your account was created, but automatic sign-in failed. Please sign in.'
        );
      }
    } catch (requestError) {
      setError(getApiErrorMessage(requestError));
    } finally {
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

      <section className="auth-panel" aria-labelledby="register-title">
        <p className="catalog-eyebrow">
          {isVerificationStep ? 'EMAIL VERIFICATION' : 'JOIN THE COMMUNITY'}
        </p>
        <h1 id="register-title">
          {isVerificationStep ? 'Verify your email' : 'Create your account'}
        </h1>
        <p className="auth-intro">
          {isVerificationStep
            ? `Enter the four-digit code sent to ${values.email}.`
            : 'Create an EShop account to get started.'}
        </p>

        {isRegistered ? (
          <div className="auth-success" role="status">
            <p>Your account has been created successfully.</p>
            <Link href="/login">Sign in to continue</Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit} noValidate>
            {!isVerificationStep ? (
              <>
                <label htmlFor="register-name">Full name</label>
                <input
                  autoComplete="name"
                  id="register-name"
                  name="name"
                  onChange={(event) => updateValue('name', event.target.value)}
                  required
                  value={values.name}
                />

                <label htmlFor="register-email">Email address</label>
                <input
                  autoComplete="email"
                  id="register-email"
                  name="email"
                  onChange={(event) => updateValue('email', event.target.value)}
                  required
                  type="email"
                  value={values.email}
                />

                <label htmlFor="register-password">Password</label>
                <input
                  autoComplete="new-password"
                  id="register-password"
                  name="password"
                  onChange={(event) =>
                    updateValue('password', event.target.value)
                  }
                  required
                  type="password"
                  value={values.password}
                />
              </>
            ) : (
              <>
                <label htmlFor="register-otp">Verification code</label>
                <input
                  autoComplete="one-time-code"
                  id="register-otp"
                  inputMode="numeric"
                  maxLength={4}
                  name="otp"
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  pattern="\d{4}"
                  required
                  value={otp}
                />
              </>
            )}

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button
              className="auth-submit"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? 'Please wait…'
                : isVerificationStep
                ? 'Verify and create account'
                : 'Send verification code'}
            </button>
            {isVerificationStep && (
              <button
                className="auth-secondary"
                disabled={isSubmitting}
                onClick={() => {
                  setIsVerificationStep(false);
                  setError('');
                }}
                type="button"
              >
                Back to account details
              </button>
            )}
          </form>
        )}

        <p className="auth-switch">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
