'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StoreHeader } from '../components/StoreHeader';
import { useAuth } from '../components/AuthProvider';
import type { CustomerCartItem } from '../lib/cartApi';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);

function CartItemImage({ item }: { item: CustomerCartItem }) {
  const [failed, setFailed] = useState(false);
  const image = item.product?.images[0];

  return (
    <div className="cart-item-art">
      {image && !failed ? (
        <Image
          alt=""
          height={112}
          onError={() => setFailed(true)}
          src={image.url}
          unoptimized
          width={112}
        />
      ) : (
        <span aria-hidden="true">
          {item.product?.title.slice(0, 1).toUpperCase() ?? '?'}
        </span>
      )}
    </div>
  );
}

export default function CartPage() {
  const router = useRouter();
  const {
    user,
    status,
    cart,
    cartLoading,
    cartError,
    refreshCart,
    updateCartQuantity,
    removeCartItem,
    clearCart,
  } = useAuth();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login?next=%2Fcart');
    }
  }, [router, status]);

  const runAction = async (key: string, action: () => Promise<void>) => {
    setPendingAction(key);
    try {
      await action();
    } catch {
      // The shared auth context exposes the request error.
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <main className="store-shell">
      <StoreHeader />
      {status === 'loading' ? (
        <section className="cart-state" role="status">
          Checking your session…
        </section>
      ) : !user ? (
        <section className="cart-state" role="status">
          Redirecting to sign in…
        </section>
      ) : (
        <section className="cart-page" aria-labelledby="cart-title">
          <div className="cart-heading">
            <div>
              <p className="catalog-eyebrow">YOUR SELECTION</p>
              <h1 id="cart-title">Shopping cart</h1>
            </div>
            {cart && cart.items.length > 0 && (
              <button
                className="cart-text-button"
                disabled={pendingAction !== null}
                onClick={() => void runAction('clear', () => clearCart())}
                type="button"
              >
                {pendingAction === 'clear' ? 'Clearing…' : 'Clear cart'}
              </button>
            )}
          </div>

          {cartLoading ? (
            <div className="cart-state" role="status">
              Loading your cart…
            </div>
          ) : cartError ? (
            <div className="cart-state cart-error-state">
              <p role="alert">{cartError}</p>
              <button
                className="auth-submit"
                onClick={() => void refreshCart()}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : cart && cart.items.length === 0 ? (
            <div className="cart-state cart-empty">
              <h2>Your cart is waiting for something good.</h2>
              <p>Browse the catalog and add a product you love.</p>
              <Link className="account-shopping-link" href="/">
                Continue shopping
              </Link>
            </div>
          ) : cart ? (
            <>
              <div className="cart-layout">
                <ul className="cart-items">
                  {cart.items.map((item) => {
                    const itemPending = pendingAction === item.productId;
                    const product = item.product;

                    return (
                      <li className="cart-item" key={item.id}>
                        <CartItemImage item={item} />
                        <div className="cart-item-details">
                          {product ? (
                            <Link
                              className="cart-product-title"
                              href={`/products/${encodeURIComponent(
                                product.slug
                              )}`}
                            >
                              {product.title}
                            </Link>
                          ) : (
                            <h2 className="cart-product-title">
                              Product no longer available
                            </h2>
                          )}
                          {!item.available && (
                            <p className="cart-unavailable" role="status">
                              Currently unavailable; remove this item to
                              continue.
                            </p>
                          )}
                          {product && (
                            <p className="cart-item-price">
                              {formatPrice(product.salePrice)} each
                            </p>
                          )}
                          <div className="cart-item-controls">
                            {item.available && product && (
                              <div
                                aria-label={`Quantity for ${product.title}`}
                                className="cart-quantity"
                              >
                                <button
                                  aria-label={`Decrease quantity of ${product.title}`}
                                  disabled={
                                    pendingAction !== null || item.quantity <= 1
                                  }
                                  onClick={() =>
                                    void runAction(item.productId, () =>
                                      updateCartQuantity(
                                        item.productId,
                                        Math.min(
                                          item.quantity - 1,
                                          product.stock
                                        )
                                      )
                                    )
                                  }
                                  type="button"
                                >
                                  −
                                </button>
                                <span aria-live="polite">{item.quantity}</span>
                                <button
                                  aria-label={`Increase quantity of ${product.title}`}
                                  disabled={
                                    pendingAction !== null ||
                                    item.quantity >= product.stock
                                  }
                                  onClick={() =>
                                    void runAction(item.productId, () =>
                                      updateCartQuantity(
                                        item.productId,
                                        item.quantity + 1
                                      )
                                    )
                                  }
                                  type="button"
                                >
                                  +
                                </button>
                              </div>
                            )}
                            <button
                              className="cart-text-button"
                              disabled={pendingAction !== null}
                              onClick={() =>
                                void runAction(item.productId, () =>
                                  removeCartItem(item.productId)
                                )
                              }
                              type="button"
                            >
                              {itemPending ? 'Updating…' : 'Remove'}
                            </button>
                          </div>
                          {item.available && (
                            <p className="cart-line-subtotal">
                              Subtotal: {formatPrice(item.lineSubtotal)}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <aside className="cart-summary" aria-label="Cart summary">
                  <h2>Order summary</h2>
                  <div>
                    <span>Items</span>
                    <span>{cart.itemCount}</span>
                  </div>
                  <div className="cart-summary-total">
                    <strong>Subtotal</strong>
                    <strong>{formatPrice(cart.subtotal)}</strong>
                  </div>
                  <p>Shipping and taxes are calculated later.</p>
                  <Link className="account-shopping-link" href="/">
                    Continue shopping
                  </Link>
                </aside>
              </div>
              {cartError && (
                <p className="auth-error cart-mutation-error" role="alert">
                  {cartError}
                </p>
              )}
            </>
          ) : (
            <div className="cart-state" role="status">
              Preparing your cart…
            </div>
          )}
        </section>
      )}
    </main>
  );
}
