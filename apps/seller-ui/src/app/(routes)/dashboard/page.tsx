'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCurrentSeller, getSellerApiErrorMessage, SafeSeller } from '../../lib/sellerApi';
import { SellerHeader } from '../../components/SellerHeader';

export default function SellerDashboardPage() {
  const [seller, setSeller] = useState<SafeSeller | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unauthenticated' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    void getCurrentSeller().then((profile) => {
      setSeller(profile);
      setState('ready');
    }).catch((requestError: unknown) => {
      const unauthorized = Boolean(requestError && typeof requestError === 'object' && 'response' in requestError && requestError.response && typeof requestError.response === 'object' && 'status' in requestError.response && requestError.response.status === 401);
      setError(getSellerApiErrorMessage(requestError));
      setState(unauthorized ? 'unauthenticated' : 'error');
    });
  }, []);

  if (state === 'loading') {
    return <p className="auth-notice" role="status">Checking seller session…</p>;
  }
  if (state === 'unauthenticated') {
    return <section className="seller-products-notice"><p>Sign in to open your seller workspace.</p><Link href="/login">Seller sign in</Link></section>;
  }
  if (state === 'error') {
    return <p className="auth-error" role="alert">{error}</p>;
  }

  return (
    <>
    <SellerHeader />
    <section className="seller-dashboard-overview">
      <p className="catalog-eyebrow">SELLER WORKSPACE</p>
      <h1>Welcome{seller?.name ? `, ${seller.name}` : ''}</h1>
      <p>Manage your shop, products, discounts and payout account.</p>
      {!seller?.shop && <p className="auth-notice">Finish setting up your shop before adding products or connecting payouts.</p>}
      <div className="seller-dashboard-links">
        {!seller?.shop && <Link className="auth-submit" href="/signup">Set up your shop</Link>}
        <Link className="auth-secondary" href="/dashboard/all-products">Manage products</Link>
        <Link className="auth-secondary" href="/dashboard/discount-codes">Discount codes</Link>
        <Link className="auth-secondary" href="/dashboard/payments">Stripe Connect</Link>
      </div>
    </section>
    </>
  );
}
