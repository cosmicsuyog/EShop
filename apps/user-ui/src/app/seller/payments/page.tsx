'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { StoreHeader } from '../../components/StoreHeader';
import {
  createStripeConnectLink,
  createStripeDashboardLink,
  getCurrentSeller,
  getSellerApiErrorMessage,
  getStripeAccountStatus,
  SafeSeller,
  StripeAccountStatus,
} from '../../lib/sellerApi';

type PageState =
  | 'checking'
  | 'unauthenticated'
  | 'shop-required'
  | 'ready'
  | 'error';

const isUnauthorized = (error: unknown) =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'response' in error &&
      error.response &&
      typeof error.response === 'object' &&
      'status' in error.response &&
      error.response.status === 401
  );

function SellerPaymentsContent() {
  const searchParams = useSearchParams();
  const returnStatus = searchParams?.get('status');

  const [state, setState] = useState<PageState>('checking');
  const [seller, setSeller] = useState<SafeSeller | null>(null);
  const [status, setStatus] = useState<StripeAccountStatus | null>(null);
  const [error, setError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isOpeningDashboard, setIsOpeningDashboard] = useState(false);

  const loadData = useCallback(async () => {
    setState('checking');
    setError('');
    try {
      const sellerProfile = await getCurrentSeller();
      setSeller(sellerProfile);
      if (!sellerProfile.shop) {
        setState('shop-required');
        return;
      }

      const stripeStatus = await getStripeAccountStatus();
      setStatus(stripeStatus);
      setState('ready');
    } catch (requestError) {
      if (isUnauthorized(requestError)) {
        setState('unauthenticated');
      } else {
        setError(getSellerApiErrorMessage(requestError));
        setState('error');
      }
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleConnectStripe = async () => {
    setIsConnecting(true);
    setError('');
    try {
      const { url } = await createStripeConnectLink();
      window.location.href = url;
    } catch (requestError) {
      setError(getSellerApiErrorMessage(requestError));
      setIsConnecting(false);
    }
  };

  const handleOpenDashboard = async () => {
    setIsOpeningDashboard(true);
    setError('');
    try {
      const url = await createStripeDashboardLink();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (requestError) {
      setError(getSellerApiErrorMessage(requestError));
    } finally {
      setIsOpeningDashboard(false);
    }
  };

  return (
    <main className="store-shell">
      <StoreHeader />
      <section className="seller-products-page">
        <div className="seller-products-heading">
          <div>
            <p className="catalog-eyebrow">SELL WITH ESHOP</p>
            <h1>Payouts & Bank Account</h1>
          </div>
          <div className="seller-header-nav-actions">
            <Link className="auth-secondary" href="/seller/products">
              Manage products
            </Link>
          </div>
        </div>

        {returnStatus === 'success' && (
          <div className="auth-notice seller-banner-success" role="status">
            Stripe onboarding returned successfully. Your payout account status is shown below.
          </div>
        )}

        {returnStatus === 'refresh' && (
          <div className="auth-notice seller-banner-info" role="status">
            Your Stripe onboarding link expired or was refreshed. You can continue below at any time.
          </div>
        )}

        {state === 'checking' && (
          <p className="auth-notice" role="status">
            Checking seller session and payment account…
          </p>
        )}

        {state === 'unauthenticated' && (
          <div className="seller-products-notice">
            <p>Sign in as a seller to manage your payment account.</p>
            <Link href="/seller/login">Seller sign in</Link>
          </div>
        )}

        {state === 'shop-required' && (
          <div className="seller-products-notice">
            <p>Create your shop before connecting a payout account.</p>
            <Link href="/seller/register">Set up your shop</Link>
          </div>
        )}

        {error && (
          <p className="auth-error seller-form-error" role="alert">
            {error}
          </p>
        )}

        {state === 'error' && (
          <button
            className="auth-secondary"
            onClick={() => void loadData()}
            type="button"
          >
            Try again
          </button>
        )}

        {state === 'ready' && seller && (
          <div className="seller-payment-panel">
            {!status?.connected ? (
              <div className="seller-payment-card">
                <div className="seller-payment-info">
                  <span className="seller-status-badge badge-neutral">Not connected</span>
                  <h2>Connect with Stripe Express</h2>
                  <p>
                    Set up your payout destination to receive proceeds directly to your bank account or debit card. Stripe handles identity verification, multi-currency payouts, and tax compliance.
                  </p>
                </div>
                <div className="seller-payment-action">
                  <button
                    className="auth-submit"
                    disabled={isConnecting}
                    onClick={handleConnectStripe}
                    type="button"
                  >
                    {isConnecting ? 'Connecting…' : 'Connect Stripe'}
                  </button>
                </div>
              </div>
            ) : !status.payoutsEnabled || !status.detailsSubmitted ? (
              <div className="seller-payment-card">
                <div className="seller-payment-info">
                  <span className="seller-status-badge badge-warning">Onboarding Incomplete</span>
                  <h2>Verification required for payouts</h2>
                  <p>
                    Your Stripe account ({status.stripeId}) requires additional verification documents before bank payouts can be enabled.
                  </p>
                  <div className="seller-payment-meta">
                    <span>Account: {status.stripeId}</span>
                    <span>Charges: {status.chargesEnabled ? 'Enabled' : 'Restricted'}</span>
                    <span>Payouts: Pending verification</span>
                  </div>
                </div>
                <div className="seller-payment-action">
                  <button
                    className="auth-submit"
                    disabled={isConnecting}
                    onClick={handleConnectStripe}
                    type="button"
                  >
                    {isConnecting ? 'Resuming…' : 'Complete onboarding'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="seller-payment-card seller-payment-active">
                <div className="seller-payment-info">
                  <span className="seller-status-badge badge-success">Active & Verified</span>
                  <h2>Stripe Payouts Enabled</h2>
                  <p>
                    Your payout account is verified. Earnings from customer purchases are deposited directly to your connected bank account.
                  </p>
                  <div className="seller-payment-meta">
                    <span>Account: {status.stripeId}</span>
                    <span>Currency: {status.currency?.toUpperCase() || 'USD'}</span>
                    <span>Charges: Enabled</span>
                    <span>Payouts: Enabled</span>
                  </div>
                </div>
                <div className="seller-payment-action">
                  <button
                    className="auth-secondary"
                    disabled={isOpeningDashboard}
                    onClick={handleOpenDashboard}
                    type="button"
                  >
                    {isOpeningDashboard ? 'Opening…' : 'Open Stripe Dashboard'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default function SellerPaymentsPage() {
  return (
    <Suspense
      fallback={
        <main className="store-shell">
          <StoreHeader />
          <p className="auth-notice" role="status">
            Loading payments…
          </p>
        </main>
      }
    >
      <SellerPaymentsContent />
    </Suspense>
  );
}
