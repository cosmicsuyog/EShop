'use client';

import Link from 'next/link';

const storefrontUrl =
  process.env.NEXT_PUBLIC_USER_UI_URL ?? 'http://localhost:3000';

export function SellerHeader() {
  return (
    <header className="store-header seller-app-header">
      <Link className="store-brand" href="/dashboard" aria-label="EShop seller home">
        <span className="store-brand-mark">E</span>
        <span>eshop seller</span>
      </Link>
      <span className="store-header-note">Manage your shop and payouts.</span>
      <nav className="auth-header-actions" aria-label="Seller navigation">
        <Link className="auth-header-link" href="/dashboard">Dashboard</Link>
        <Link className="auth-header-link" href="/login">Seller sign in</Link>
        <a className="auth-header-link" href={storefrontUrl}>View storefront</a>
      </nav>
    </header>
  );
}
