type CatalogProduct = {
  slug: string;
  title: string;
  category: string;
  subcategory: string;
  short_description: string;
  brand: string | null;
  stock: number;
  sale_price: number;
  regular_price: number;
  rattings: number;
};

type CatalogResponse = {
  success: true;
  products: CatalogProduct[];
};

export const dynamic = 'force-dynamic';

const isCatalogProduct = (value: unknown): value is CatalogProduct => {
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
    (typeof product.brand === 'string' || product.brand === null) &&
    typeof product.stock === 'number' &&
    typeof product.sale_price === 'number' &&
    typeof product.regular_price === 'number' &&
    typeof product.rattings === 'number'
  );
};

const isCatalogResponse = (value: unknown): value is CatalogResponse =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'success' in value &&
      value.success === true &&
      'products' in value &&
      Array.isArray(value.products) &&
      value.products.every(isCatalogProduct)
  );

const formatPrice = (price: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);

async function loadCatalog(): Promise<{
  products: CatalogProduct[];
  error: boolean;
}> {
  try {
    const gatewayUrl = process.env.API_GATEWAY_URL ?? 'http://localhost:8000';
    const endpoint = new URL(
      '/product/api/products?page=1&limit=12',
      gatewayUrl
    );
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Gateway returned HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (!isCatalogResponse(payload)) {
      throw new Error('Gateway returned an invalid product catalog response');
    }

    return { products: payload.products, error: false };
  } catch (error) {
    console.error('Unable to load the product catalog.', error);
    return { products: [], error: true };
  }
}

export default async function Index() {
  const { products, error } = await loadCatalog();

  return (
    <main className="store-shell">
      <header className="store-header">
        <a className="store-brand" href="/" aria-label="EShop home">
          <span className="store-brand-mark">E</span>
          <span>eshop</span>
        </a>
        <span className="store-header-note">Thoughtful finds, everyday.</span>
      </header>

      <section className="catalog-intro" aria-labelledby="catalog-title">
        <p className="catalog-eyebrow">THE EVERYDAY EDIT</p>
        <h1 id="catalog-title">Good things, picked for you.</h1>
        <p className="catalog-lede">
          Explore the latest finds across our product catalog.
        </p>
      </section>

      <section className="catalog-section" aria-labelledby="products-title">
        <div className="catalog-section-heading">
          <div>
            <p className="catalog-eyebrow">SHOP THE COLLECTION</p>
            <h2 id="products-title">Featured products</h2>
          </div>
          {!error && (
            <span className="catalog-count">
              {products.length} {products.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        {error ? (
          <div className="catalog-message" role="status">
            <h3>Catalog temporarily unavailable</h3>
            <p>
              We could not reach the product catalog. Please try again in a
              little while.
            </p>
          </div>
        ) : products.length === 0 ? (
          <div className="catalog-message" role="status">
            <h3>Your next favorite is on its way.</h3>
            <p>There are no products to show right now. Check back soon.</p>
          </div>
        ) : (
          <div className="catalog-grid">
            {products.map((product) => (
              <article className="product-card" key={product.slug}>
                <div className="product-card-art" aria-hidden="true">
                  <span>{product.category.slice(0, 1).toUpperCase()}</span>
                  {product.stock > 0 ? (
                    <span className="product-stock">In stock</span>
                  ) : (
                    <span className="product-stock product-stock-empty">
                      Sold out
                    </span>
                  )}
                </div>
                <div className="product-card-content">
                  <p className="product-category">
                    {product.category} <span>/</span> {product.subcategory}
                  </p>
                  <h3>{product.title}</h3>
                  <p className="product-description">
                    {product.short_description}
                  </p>
                  <div className="product-card-footer">
                    <div className="product-prices">
                      <strong>{formatPrice(product.sale_price)}</strong>
                      {product.regular_price > product.sale_price && (
                        <del>{formatPrice(product.regular_price)}</del>
                      )}
                    </div>
                    <span
                      className="product-rating"
                      aria-label={`${product.rattings} out of 5 stars`}
                    >
                      ★ {product.rattings.toFixed(1)}
                    </span>
                  </div>
                  {product.brand && (
                    <p className="product-brand">{product.brand}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="store-footer">
        <span>EShop</span>
        <span>Prices shown in the catalog currency.</span>
      </footer>
    </main>
  );
}
