import Link from 'next/link';

export default function LoadingProduct() {
  return (
    <main className="store-shell">
      <header className="store-header">
        <Link className="store-brand" href="/" aria-label="EShop home">
          <span className="store-brand-mark">E</span>
          <span>eshop</span>
        </Link>
        <span className="store-header-note">Thoughtful finds, everyday.</span>
      </header>

      <div className="detail-loading" role="status" aria-live="polite">
        <span className="catalog-eyebrow">PRODUCT DETAILS</span>
        <p>Loading product details…</p>
      </div>
    </main>
  );
}
