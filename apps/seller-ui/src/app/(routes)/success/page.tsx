import Link from 'next/link';

export default function SellerSuccessPage() {
  return (
    <main className="store-shell">
      <section className="auth-panel">
        <p className="catalog-eyebrow">SELLER PAYOUTS</p>
        <h1>Stripe returned to EShop</h1>
        <p className="auth-notice">Your current payout account status is available in the seller dashboard.</p>
        <Link className="auth-submit" href="/dashboard/payments">Review payout status</Link>
      </section>
    </main>
  );
}
