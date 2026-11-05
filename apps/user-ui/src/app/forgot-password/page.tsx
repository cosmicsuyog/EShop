'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { StoreHeader } from '../components/StoreHeader';
import {
  getApiErrorMessage,
  requestCustomerPasswordReset,
  resetCustomerPassword,
  verifyCustomerPasswordResetOtp,
} from '../lib/authApi';
import {
  getNewPasswordError,
  isValidResetEmail,
  isValidResetOtp,
} from '../lib/passwordResetValidation';

type ResetStep = 'request' | 'verify' | 'reset' | 'complete';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<ResetStep>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (step === 'request') {
      const normalizedEmail = email.trim();
      if (!isValidResetEmail(normalizedEmail)) {
        setError('Enter a valid email address.');
        return;
      }

      setIsSubmitting(true);
      try {
        await requestCustomerPasswordReset(normalizedEmail);
        setEmail(normalizedEmail);
        setStep('verify');
        setNotice(
          'If an account exists for that address, check your inbox for a six-digit reset code.'
        );
      } catch (requestError) {
        setError(getApiErrorMessage(requestError));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (step === 'verify') {
      if (!isValidResetOtp(otp)) {
        setError('Enter the six-digit code from your email.');
        return;
      }

      setIsSubmitting(true);
      try {
        await verifyCustomerPasswordResetOtp(email, otp);
        setOtp('');
        setStep('reset');
        setNotice('Code verified. Choose a new password to finish.');
      } catch (requestError) {
        setError(getApiErrorMessage(requestError));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (step === 'reset') {
      const passwordError = getNewPasswordError(
        password,
        passwordConfirmation
      );
      if (passwordError) {
        setError(passwordError);
        return;
      }

      setIsSubmitting(true);
      try {
        await resetCustomerPassword(password);
        setPassword('');
        setPasswordConfirmation('');
        setStep('complete');
      } catch (requestError) {
        setError(getApiErrorMessage(requestError));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const stepContent = {
    request: {
      eyebrow: 'ACCOUNT RECOVERY',
      title: 'Forgot your password?',
      intro: 'Enter the email address associated with your account.',
    },
    verify: {
      eyebrow: 'VERIFY YOUR EMAIL',
      title: 'Enter your reset code',
      intro: `If an account exists for ${email}, check your inbox for a six-digit reset code.`,
    },
    reset: {
      eyebrow: 'CHOOSE A PASSWORD',
      title: 'Set a new password',
      intro: 'Choose a password you have not used for this account before.',
    },
    complete: {
      eyebrow: 'PASSWORD UPDATED',
      title: 'You can sign in again',
      intro: 'Your password was updated successfully.',
    },
  }[step];

  return (
    <main className="store-shell">
      <StoreHeader />

      <section className="auth-panel" aria-labelledby="reset-title">
        <p className="catalog-eyebrow">{stepContent.eyebrow}</p>
        <h1 id="reset-title">{stepContent.title}</h1>
        <p className="auth-intro">{stepContent.intro}</p>

        {notice && (
          <p className="auth-notice" role="status">
            {notice}
          </p>
        )}

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        {step === 'request' && (
          <form className="auth-form" onSubmit={submit} noValidate>
            <label htmlFor="reset-email">Email address</label>
            <input
              autoComplete="email"
              id="reset-email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
            <button className="auth-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Sending code…' : 'Send reset code'}
            </button>
          </form>
        )}

        {step === 'verify' && (
          <form className="auth-form" onSubmit={submit} noValidate>
            <label htmlFor="reset-otp">Six-digit code</label>
            <input
              autoComplete="one-time-code"
              id="reset-otp"
              inputMode="numeric"
              maxLength={6}
              name="otp"
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              pattern="\d{6}"
              required
              value={otp}
            />
            <button className="auth-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Checking code…' : 'Verify code'}
            </button>
            <button
              className="auth-secondary"
              disabled={isSubmitting}
              onClick={() => {
                setStep('request');
                setEmail('');
                setOtp('');
                setNotice('');
                setError('');
              }}
              type="button"
            >
              Use another email address
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form className="auth-form" onSubmit={submit} noValidate>
            <label htmlFor="reset-new-password">New password</label>
            <input
              autoComplete="new-password"
              id="reset-new-password"
              maxLength={72}
              name="newPassword"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <label htmlFor="reset-confirm-password">Confirm new password</label>
            <input
              autoComplete="new-password"
              id="reset-confirm-password"
              maxLength={72}
              name="confirmPassword"
              onChange={(event) => setPasswordConfirmation(event.target.value)}
              required
              type="password"
              value={passwordConfirmation}
            />
            <button className="auth-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Updating password…' : 'Update password'}
            </button>
          </form>
        )}

        {step === 'complete' && (
          <div className="auth-success" role="status">
            <p>Your password was updated successfully.</p>
            <Link href="/login">Sign in with your new password</Link>
          </div>
        )}

        {step !== 'complete' && (
          <p className="auth-switch">
            Remembered your password? <Link href="/login">Sign in</Link>
          </p>
        )}
      </section>
    </main>
  );
}
