'use client';

import Link from 'next/link';

export default function ProductError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="not-found-shell" role="alert">
      <p className="catalog-eyebrow">PRODUCT DETAILS UNAVAILABLE</p>
      <h1>We could not load this product.</h1>
      <p>Please try again. If the problem continues, return to the catalog.</p>
      <div className="detail-error-actions">
        <button type="button" onClick={reset}>
          Try again
        </button>
        <Link href="/">Back to the catalog</Link>
      </div>
    </main>
  );
}
