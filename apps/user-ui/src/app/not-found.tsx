import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="not-found-shell">
      <p className="catalog-eyebrow">PRODUCT NOT FOUND</p>
      <h1>This item is no longer in the catalog.</h1>
      <p>It may have been removed or the address may be incorrect.</p>
      <Link href="/">Back to the catalog</Link>
    </main>
  );
}
