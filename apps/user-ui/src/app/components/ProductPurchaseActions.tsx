'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from './AuthProvider';

export function ProductPurchaseActions({
  productId,
  productSlug,
  stock,
}: {
  productId: string;
  productSlug: string;
  stock: number;
}) {
  const { user, status, addToCart, cartError } = useAuth();
  const [isAdding, setIsAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const handleAddToCart = async () => {
    setIsAdding(true);
    setAdded(false);
    try {
      await addToCart(productId);
      setAdded(true);
    } catch {
      // The shared auth context exposes the request error.
    } finally {
      setIsAdding(false);
    }
  };

  if (status === 'loading') {
    return (
      <p className="purchase-session-status" role="status">
        Checking your account…
      </p>
    );
  }

  if (stock < 1) {
    return (
      <button
        className="auth-submit purchase-add-button"
        disabled
        type="button"
      >
        Out of stock
      </button>
    );
  }

  if (!user) {
    return (
      <Link
        className="auth-submit purchase-sign-in"
        href={`/login?next=${encodeURIComponent(`/products/${productSlug}`)}`}
      >
        Sign in to add to cart
      </Link>
    );
  }

  return (
    <div className="purchase-actions">
      <button
        className="auth-submit purchase-add-button"
        disabled={isAdding}
        onClick={() => void handleAddToCart()}
        type="button"
      >
        {isAdding ? 'Adding…' : 'Add to cart'}
      </button>
      {added && (
        <p className="purchase-success" role="status">
          Added to your cart. <Link href="/cart">View cart</Link>
        </p>
      )}
      {cartError && (
        <p className="auth-error purchase-error" role="alert">
          {cartError}
        </p>
      )}
    </div>
  );
}
