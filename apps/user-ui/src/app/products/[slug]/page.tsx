import Link from 'next/link';
import { notFound } from 'next/navigation';

type Product = {
  slug: string;
  title: string;
  category: string;
  subcategory: string;
  short_description: string;
  detailed_description: string;
  video_url: string | null;
  tags: string[];
  brand: string | null;
  colors: string[];
  sizes: string[];
  stock: number;
  sale_price: number;
  regular_price: number;
  rattings: number;
  warranty: string | null;
};

type ProductResponse = {
  success: true;
  product: Product;
};

export const dynamic = 'force-dynamic';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isProduct = (value: unknown): value is Product => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const product = value as Record<string, unknown>;

  return (
    typeof product.slug === 'string' &&
    typeof product.title === 'string' &&
    typeof product.category === 'string' &&
    typeof product.subcategory === 'string' &&
    typeof product.short_description === 'string' &&
    typeof product.detailed_description === 'string' &&
    (typeof product.video_url === 'string' || product.video_url === null) &&
    isStringArray(product.tags) &&
    (typeof product.brand === 'string' || product.brand === null) &&
    isStringArray(product.colors) &&
    isStringArray(product.sizes) &&
    typeof product.stock === 'number' &&
    typeof product.sale_price === 'number' &&
    typeof product.regular_price === 'number' &&
    typeof product.rattings === 'number' &&
    (typeof product.warranty === 'string' || product.warranty === null)
  );
};

const isProductResponse = (value: unknown): value is ProductResponse =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'success' in value &&
      value.success === true &&
      'product' in value &&
      isProduct(value.product)
  );

const formatPrice = (price: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);

async function loadProduct(slug: string): Promise<Product | null> {
  const gatewayUrl = process.env.API_GATEWAY_URL ?? 'http://localhost:8000';
  const endpoint = new URL(
    `/product/api/products/${encodeURIComponent(slug)}`,
    gatewayUrl
  );

  const response = await fetch(endpoint, { cache: 'no-store' });
  if (response.status === 404 || response.status === 400) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Gateway returned HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!isProductResponse(payload)) {
    throw new Error('Gateway returned an invalid product response');
  }

  return payload.product;
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let product: Product | null;

  try {
    product = await loadProduct(slug);
  } catch (error) {
    console.error('Unable to load the product details.', error);
    throw error;
  }

  if (!product) {
    notFound();
  }

  return (
    <main className="store-shell">
      <header className="store-header">
        <Link className="store-brand" href="/" aria-label="EShop home">
          <span className="store-brand-mark">E</span>
          <span>eshop</span>
        </Link>
        <span className="store-header-note">Thoughtful finds, everyday.</span>
      </header>

      <nav className="detail-breadcrumb" aria-label="Breadcrumb">
        <Link href="/">All products</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/?${new URLSearchParams({ category: product.category })}`}>
          {product.category}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.title}</span>
      </nav>

      <article className="product-detail">
        <div className="product-detail-art" aria-hidden="true">
          <span>{product.category.slice(0, 1).toUpperCase()}</span>
          {product.stock > 0 ? (
            <span className="product-stock">In stock</span>
          ) : (
            <span className="product-stock product-stock-empty">Sold out</span>
          )}
        </div>

        <div className="product-detail-content">
          <p className="catalog-eyebrow">
            {product.category} / {product.subcategory}
          </p>
          <h1>{product.title}</h1>
          {product.brand && <p className="detail-brand">by {product.brand}</p>}

          <div className="detail-price-row">
            <strong>{formatPrice(product.sale_price)}</strong>
            {product.regular_price > product.sale_price && (
              <del>{formatPrice(product.regular_price)}</del>
            )}
            <span
              className="product-rating"
              aria-label={`${product.rattings} out of 5 stars`}
            >
              ★ {product.rattings.toFixed(1)}
            </span>
          </div>

          <p className="detail-short-description">
            {product.short_description}
          </p>

          <div className="detail-stock-note">
            {product.stock > 0
              ? `${product.stock} available`
              : 'Currently out of stock'}
          </div>

          <section className="detail-section" aria-labelledby="description">
            <h2 id="description">Description</h2>
            <p>{product.detailed_description}</p>
          </section>

          {(product.colors.length > 0 || product.sizes.length > 0) && (
            <section className="detail-section" aria-labelledby="options">
              <h2 id="options">Product details</h2>
              {product.colors.length > 0 && (
                <p>
                  <strong>Colors:</strong> {product.colors.join(', ')}
                </p>
              )}
              {product.sizes.length > 0 && (
                <p>
                  <strong>Sizes:</strong> {product.sizes.join(', ')}
                </p>
              )}
            </section>
          )}

          {product.warranty && (
            <section className="detail-section" aria-labelledby="warranty">
              <h2 id="warranty">Warranty</h2>
              <p>{product.warranty}</p>
            </section>
          )}

          {product.tags.length > 0 && (
            <div className="detail-tags" aria-label="Product tags">
              {product.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      </article>

      <footer className="store-footer">
        <span>EShop</span>
        <Link href="/">Continue shopping</Link>
      </footer>
    </main>
  );
}
