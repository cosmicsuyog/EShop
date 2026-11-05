'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { StoreHeader } from '../../components/StoreHeader';
import {
  getSellerApiErrorMessage,
  getCurrentSeller,
} from '../../lib/sellerApi';
import {
  deleteSellerProduct,
  getSellerProducts,
  restoreSellerProduct,
  SellerProduct,
} from '../../lib/sellerProductApi';

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

const formatPrice = (price: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);

export default function SellerProductsPage() {
  const [state, setState] = useState<PageState>('checking');
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [error, setError] = useState('');
  const [busyProductId, setBusyProductId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setState('checking');
    setError('');
    try {
      const seller = await getCurrentSeller();
      if (!seller.shop) {
        setState('shop-required');
        return;
      }
      setProducts(await getSellerProducts());
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
    void loadProducts();
  }, [loadProducts]);

  const changeProductState = async (
    product: SellerProduct,
    action: 'delete' | 'restore'
  ) => {
    setBusyProductId(product.id);
    setError('');
    try {
      if (action === 'delete') {
        await deleteSellerProduct(product.id);
      } else {
        await restoreSellerProduct(product.id);
      }
      await loadProducts();
    } catch (requestError) {
      setError(getSellerApiErrorMessage(requestError));
    } finally {
      setBusyProductId(null);
    }
  };

  return (
    <main className="store-shell">
      <StoreHeader />
      <section className="seller-products-page">
        <div className="seller-products-heading">
          <div>
            <p className="catalog-eyebrow">SELL WITH ESHOP</p>
            <h1>Your products</h1>
          </div>
          <Link
            className="auth-submit seller-products-add"
            href="/seller/products/new"
          >
            Add product
          </Link>
        </div>

        {state === 'checking' && (
          <p className="auth-notice" role="status">
            Checking seller session and loading products…
          </p>
        )}

        {state === 'unauthenticated' && (
          <div className="seller-products-notice">
            <p>Sign in as a seller to manage your products.</p>
            <Link href="/seller/login">Seller sign in</Link>
          </div>
        )}

        {state === 'shop-required' && (
          <div className="seller-products-notice">
            <p>Create your shop before adding products.</p>
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
            onClick={() => void loadProducts()}
            type="button"
          >
            Try again
          </button>
        )}

        {state === 'ready' &&
          (products.length === 0 ? (
            <div className="seller-products-empty">
              <p>You have not added any products yet.</p>
              <Link href="/seller/products/new">Create your first product</Link>
            </div>
          ) : (
            <ul className="seller-product-list">
              {products.map((product) => (
                <li className="seller-product-card" key={product.id}>
                  <div className="seller-product-card-content">
                    <p className="catalog-eyebrow">
                      {product.category} / {product.subcategory}
                    </p>
                    <h2>{product.title}</h2>
                    <p>{product.short_description}</p>
                    <div className="seller-product-meta">
                      <span>Price: ${formatPrice(product.sale_price)}</span>
                      <span>Stock: {product.stock}</span>
                      <span>{product.isDeleted ? 'Deleted' : 'Active'}</span>
                    </div>
                  </div>
                  <div className="seller-product-actions">
                    {product.isDeleted ? (
                      <button
                        className="auth-secondary"
                        disabled={busyProductId === product.id}
                        onClick={() =>
                          void changeProductState(product, 'restore')
                        }
                        type="button"
                      >
                        {busyProductId === product.id
                          ? 'Restoring…'
                          : 'Restore'}
                      </button>
                    ) : (
                      <button
                        className="seller-product-delete"
                        disabled={busyProductId === product.id}
                        onClick={() =>
                          void changeProductState(product, 'delete')
                        }
                        type="button"
                      >
                        {busyProductId === product.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </section>
    </main>
  );
}
