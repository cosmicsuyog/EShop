import Link from 'next/link';

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
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type CategoriesResponse = {
  success: true;
  categories: string[];
};

type SubcategoriesResponse = {
  success: true;
  subcategories: string[];
};

type CatalogSearchParams = {
  category?: string | string[];
  subcategory?: string | string[];
  page?: string | string[];
};

type CatalogResult = {
  products: CatalogProduct[];
  pagination: CatalogResponse['pagination'] | null;
  error: boolean;
};

const PAGE_SIZE = 12;

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

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isCatalogResponse = (value: unknown): value is CatalogResponse =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'success' in value &&
      value.success === true &&
      'products' in value &&
      Array.isArray(value.products) &&
      value.products.every(isCatalogProduct) &&
      'pagination' in value &&
      typeof value.pagination === 'object' &&
      value.pagination !== null &&
      'page' in value.pagination &&
      isPositiveSafeInteger(value.pagination.page) &&
      'limit' in value.pagination &&
      isPositiveSafeInteger(value.pagination.limit) &&
      'total' in value.pagination &&
      isNonNegativeSafeInteger(value.pagination.total) &&
      'totalPages' in value.pagination &&
      isNonNegativeSafeInteger(value.pagination.totalPages)
  );

const isCategoriesResponse = (value: unknown): value is CategoriesResponse =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'success' in value &&
      value.success === true &&
      'categories' in value &&
      Array.isArray(value.categories) &&
      value.categories.every((category) => typeof category === 'string')
  );

const isSubcategoriesResponse = (
  value: unknown
): value is SubcategoriesResponse =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'success' in value &&
      value.success === true &&
      'subcategories' in value &&
      Array.isArray(value.subcategories) &&
      value.subcategories.every(
        (subcategory) => typeof subcategory === 'string'
      )
  );

const formatPrice = (price: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);

const catalogPageHref = (
  page: number,
  category?: string,
  subcategory?: string
) => {
  const search = new URLSearchParams({ page: String(page) });
  if (category) {
    search.set('category', category);
  }
  if (subcategory) {
    search.set('subcategory', subcategory);
  }
  return `/?${search.toString()}`;
};

const catalogSubcategoryHref = (category: string, subcategory?: string) => {
  const search = new URLSearchParams({ category });
  if (subcategory) {
    search.set('subcategory', subcategory);
  }
  return `/?${search.toString()}`;
};

async function loadCatalog(
  category: string | undefined,
  subcategory: string | undefined,
  page: number
): Promise<CatalogResult> {
  try {
    const gatewayUrl = process.env.API_GATEWAY_URL ?? 'http://localhost:8000';
    const endpoint = new URL('/product/api/products', gatewayUrl);
    endpoint.searchParams.set('page', String(page));
    endpoint.searchParams.set('limit', String(PAGE_SIZE));
    if (category) {
      endpoint.searchParams.set('category', category);
    }
    if (subcategory) {
      endpoint.searchParams.set('subcategory', subcategory);
    }
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Gateway returned HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (!isCatalogResponse(payload)) {
      throw new Error('Gateway returned an invalid product catalog response');
    }

    return {
      products: payload.products,
      pagination: payload.pagination,
      error: false,
    };
  } catch (error) {
    console.error('Unable to load the product catalog.', error);
    return { products: [], pagination: null, error: true };
  }
}

async function loadCategories(): Promise<{
  categories: string[];
  error: boolean;
}> {
  try {
    const gatewayUrl = process.env.API_GATEWAY_URL ?? 'http://localhost:8000';
    const endpoint = new URL('/product/api/categories', gatewayUrl);
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Gateway returned HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (!isCategoriesResponse(payload)) {
      throw new Error('Gateway returned an invalid categories response');
    }

    return { categories: payload.categories, error: false };
  } catch (error) {
    console.error('Unable to load product categories.', error);
    return { categories: [], error: true };
  }
}

async function loadSubcategories(category: string | undefined): Promise<{
  subcategories: string[];
  error: boolean;
}> {
  if (!category) {
    return { subcategories: [], error: false };
  }

  try {
    const gatewayUrl = process.env.API_GATEWAY_URL ?? 'http://localhost:8000';
    const endpoint = new URL('/product/api/subcategories', gatewayUrl);
    endpoint.searchParams.set('category', category);
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Gateway returned HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (!isSubcategoriesResponse(payload)) {
      throw new Error('Gateway returned an invalid subcategories response');
    }

    return { subcategories: payload.subcategories, error: false };
  } catch (error) {
    console.error('Unable to load product subcategories.', error);
    return { subcategories: [], error: true };
  }
}

export default async function Index({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = await searchParams;
  const categoryParam = params.category;
  const invalidCategory =
    categoryParam !== undefined &&
    (typeof categoryParam !== 'string' ||
      categoryParam.trim().length === 0 ||
      categoryParam.length > 100);
  const selectedCategory =
    typeof categoryParam === 'string' && !invalidCategory
      ? categoryParam.trim()
      : undefined;
  const subcategoryParam = params.subcategory;
  const invalidSubcategory =
    subcategoryParam !== undefined &&
    (typeof subcategoryParam !== 'string' ||
      subcategoryParam.trim().length === 0 ||
      subcategoryParam.length > 100 ||
      !selectedCategory);
  const selectedSubcategory =
    typeof subcategoryParam === 'string' && !invalidSubcategory
      ? subcategoryParam.trim()
      : undefined;
  const pageParam = params.page;
  const page =
    typeof pageParam === 'string' && /^[1-9]\d*$/.test(pageParam)
      ? Number(pageParam)
      : undefined;
  const invalidPage =
    pageParam !== undefined &&
    (page === undefined ||
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger((page - 1) * PAGE_SIZE));
  const currentPage = page && !invalidPage ? page : 1;
  const catalogPromise =
    invalidCategory || invalidSubcategory || invalidPage
      ? Promise.resolve({
          products: [],
          pagination: null,
          error: false,
        })
      : loadCatalog(selectedCategory, selectedSubcategory, currentPage);
  const [
    { products, pagination, error },
    { categories, error: categoriesError },
    { subcategories, error: subcategoriesError },
  ] = await Promise.all([
    catalogPromise,
    loadCategories(),
    loadSubcategories(selectedCategory),
  ]);

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
            <h2 id="products-title">
              {selectedCategory
                ? `${selectedCategory} products`
                : 'Featured products'}
            </h2>
          </div>
          {!error && (
            <span className="catalog-count">
              {products.length} {products.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        <nav className="category-nav" aria-label="Product categories">
          <a
            className={`category-filter${selectedCategory ? '' : ' is-active'}`}
            href="/"
            aria-current={selectedCategory ? undefined : 'page'}
          >
            All products
          </a>
          {categories.map((category) => (
            <a
              className={`category-filter${
                selectedCategory === category ? ' is-active' : ''
              }`}
              href={`/?${new URLSearchParams({ category }).toString()}`}
              aria-current={selectedCategory === category ? 'page' : undefined}
              key={category}
            >
              {category}
            </a>
          ))}
        </nav>

        {categoriesError && (
          <p className="category-warning" role="status">
            Category filters are temporarily unavailable.
          </p>
        )}

        {selectedCategory && (
          <nav
            className="category-nav subcategory-nav"
            aria-label="Product subcategories"
          >
            <a
              className={`category-filter${
                selectedSubcategory ? '' : ' is-active'
              }`}
              href={catalogSubcategoryHref(selectedCategory)}
              aria-current={selectedSubcategory ? undefined : 'page'}
            >
              All {selectedCategory}
            </a>
            {subcategories.map((subcategory) => (
              <a
                className={`category-filter${
                  selectedSubcategory === subcategory ? ' is-active' : ''
                }`}
                href={catalogSubcategoryHref(selectedCategory, subcategory)}
                aria-current={
                  selectedSubcategory === subcategory ? 'page' : undefined
                }
                key={subcategory}
              >
                {subcategory}
              </a>
            ))}
          </nav>
        )}

        {subcategoriesError && selectedCategory && (
          <p className="category-warning" role="status">
            Subcategory filters are temporarily unavailable.
          </p>
        )}

        {invalidCategory || invalidSubcategory || invalidPage ? (
          <div className="catalog-message" role="alert">
            <h3>Invalid catalog filter</h3>
            <p>
              {invalidPage
                ? 'Choose a valid positive page number.'
                : invalidCategory
                ? 'Choose a category from the available filters.'
                : 'Choose a subcategory within a selected category.'}
            </p>
          </div>
        ) : error ? (
          <div className="catalog-message" role="status">
            <h3>Catalog temporarily unavailable</h3>
            <p>
              We could not reach the product catalog. Please try again in a
              little while.
            </p>
          </div>
        ) : products.length === 0 ? (
          <div className="catalog-message" role="status">
            <h3>
              {selectedCategory
                ? `No products found in ${selectedCategory}.`
                : 'Your next favorite is on its way.'}
            </h3>
            <p>There are no products to show right now. Check back soon.</p>
          </div>
        ) : (
          <div className="catalog-grid">
            {products.map((product) => (
              <Link
                className="product-card-link"
                href={`/products/${encodeURIComponent(product.slug)}`}
                key={product.slug}
              >
                <article className="product-card">
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
              </Link>
            ))}
          </div>
        )}

        {!error && pagination && pagination.totalPages > 0 && (
          <nav className="catalog-pagination" aria-label="Catalog pages">
            {currentPage > 1 ? (
              <Link
                className="pagination-link"
                href={catalogPageHref(
                  currentPage - 1,
                  selectedCategory,
                  selectedSubcategory
                )}
                rel="prev"
              >
                Previous
              </Link>
            ) : (
              <span
                className="pagination-link is-disabled"
                aria-disabled="true"
              >
                Previous
              </span>
            )}
            <span className="pagination-status" aria-live="polite">
              Page {currentPage} of {pagination.totalPages}
            </span>
            {currentPage < pagination.totalPages ? (
              <Link
                className="pagination-link"
                href={catalogPageHref(
                  currentPage + 1,
                  selectedCategory,
                  selectedSubcategory
                )}
                rel="next"
              >
                Next
              </Link>
            ) : (
              <span
                className="pagination-link is-disabled"
                aria-disabled="true"
              >
                Next
              </span>
            )}
          </nav>
        )}
      </section>

      <footer className="store-footer">
        <span>EShop</span>
        <span>Prices shown in the catalog currency.</span>
      </footer>
    </main>
  );
}
