'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { StoreHeader } from '../../components/StoreHeader';
import {
  getCurrentSeller,
  getSellerApiErrorMessage,
  SafeSeller,
} from '../../lib/sellerApi';
import {
  createSellerDiscountCode,
  deleteSellerDiscountCode,
  getSellerDiscountCodes,
  SellerDiscountCode,
} from '../../lib/sellerDiscountApi';

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

type DiscountFormValues = {
  public_name: string;
  discountType: 'percentage' | 'flat';
  discountValue: string;
  discountCode: string;
};

const initialFormValues: DiscountFormValues = {
  public_name: '',
  discountType: 'percentage',
  discountValue: '',
  discountCode: '',
};

export default function SellerDiscountsPage() {
  const [state, setState] = useState<PageState>('checking');
  const [seller, setSeller] = useState<SafeSeller | null>(null);
  const [discounts, setDiscounts] = useState<SellerDiscountCode[]>([]);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formValues, setFormValues] = useState<DiscountFormValues>(initialFormValues);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyCodeId, setBusyCodeId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setState('checking');
    setError('');
    try {
      const sellerProfile = await getCurrentSeller();
      setSeller(sellerProfile);
      if (!sellerProfile.shop) {
        setState('shop-required');
        return;
      }

      const list = await getSellerDiscountCodes();
      setDiscounts(list);
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
    void loadData();
  }, [loadData]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (discounts.length >= 8) {
      setError('You can only create up to 8 discount codes.');
      return;
    }

    const title = formValues.public_name.trim();
    if (!title) {
      setError('Title is required.');
      return;
    }

    const val = Number(formValues.discountValue);
    if (!Number.isFinite(val) || val <= 0) {
      setError('Discount value must be at least 1.');
      return;
    }

    if (formValues.discountType === 'percentage' && (val < 1 || val > 100)) {
      setError('Percentage discount must be between 1% and 100%.');
      return;
    }

    const code = formValues.discountCode.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,30}$/.test(code)) {
      setError('Discount code must be 2 to 30 characters (letters, numbers, hyphens, and underscores).');
      return;
    }

    setIsSubmitting(true);
    try {
      await createSellerDiscountCode({
        public_name: title,
        discountType: formValues.discountType,
        discountValue: val,
        discountCode: code,
      });

      setSuccessMessage(`Discount code ${code} created successfully!`);
      setFormValues(initialFormValues);
      setShowCreateForm(false);
      await loadData();
    } catch (requestError) {
      setError(getSellerApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (discount: SellerDiscountCode) => {
    if (!confirm(`Are you sure you want to delete discount code "${discount.discountCode}"?`)) {
      return;
    }

    setBusyCodeId(discount.id);
    setError('');
    setSuccessMessage('');
    try {
      await deleteSellerDiscountCode(discount.id);
      setSuccessMessage(`Discount code ${discount.discountCode} deleted successfully.`);
      await loadData();
    } catch (requestError) {
      setError(getSellerApiErrorMessage(requestError));
    } finally {
      setBusyCodeId(null);
    }
  };

  return (
    <main className="store-shell">
      <StoreHeader />
      <section className="seller-products-page">
        <div className="seller-products-heading">
          <div>
            <p className="catalog-eyebrow">SELL WITH ESHOP</p>
            <h1>Discount Codes</h1>
            {seller?.shop?.name && (
              <p className="catalog-eyebrow mt-1">{seller.shop.name}</p>
            )}
          </div>
          <div className="seller-header-nav-actions">
            <Link className="auth-secondary" href="/seller/products">
              Products
            </Link>
            <Link className="auth-secondary" href="/seller/payments">
              Payouts
            </Link>
            {state === 'ready' && !showCreateForm && (
              <button
                className="auth-submit seller-products-add"
                disabled={discounts.length >= 8}
                onClick={() => {
                  setShowCreateForm(true);
                  setError('');
                }}
                type="button"
              >
                Create discount
              </button>
            )}
          </div>
        </div>

        {state === 'checking' && (
          <p className="auth-notice" role="status">
            Checking seller session and loading discount codes…
          </p>
        )}

        {state === 'unauthenticated' && (
          <div className="seller-products-notice">
            <p>Sign in as a seller to manage your discount codes.</p>
            <Link href="/seller/login">Seller sign in</Link>
          </div>
        )}

        {state === 'shop-required' && (
          <div className="seller-products-notice">
            <p>Create your shop before creating discount codes.</p>
            <Link href="/seller/register">Set up your shop</Link>
          </div>
        )}

        {error && (
          <p className="auth-error seller-form-error" role="alert">
            {error}
          </p>
        )}

        {successMessage && (
          <div className="auth-notice seller-banner-success" role="status">
            {successMessage}
          </div>
        )}

        {state === 'error' && (
          <button
            className="auth-secondary"
            onClick={() => void loadData()}
            type="button"
          >
            Try again
          </button>
        )}

        {state === 'ready' && showCreateForm && (
          <div className="auth-panel seller-product-form-panel mb-8">
            <h2>Create New Discount Code</h2>
            <p className="auth-intro">
              You can create up to 8 active promotional codes for your shop ({discounts.length}/8 used).
            </p>
            <form className="auth-form" onSubmit={handleCreate} noValidate>
              <label htmlFor="discount-public-name">Title (Public Name) *</label>
              <input
                id="discount-public-name"
                onChange={(e) =>
                  setFormValues({ ...formValues, public_name: e.target.value })
                }
                placeholder="e.g. Summer Sale 20%"
                required
                value={formValues.public_name}
              />

              <label htmlFor="discount-type">Discount Type *</label>
              <select
                id="discount-type"
                onChange={(e) =>
                  setFormValues({
                    ...formValues,
                    discountType: e.target.value as 'percentage' | 'flat',
                  })
                }
                value={formValues.discountType}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Flat Amount ($)</option>
              </select>

              <label htmlFor="discount-value">
                Discount Value * {formValues.discountType === 'percentage' ? '(1 - 100 %)' : '($ USD)'}
              </label>
              <input
                id="discount-value"
                min="1"
                max={formValues.discountType === 'percentage' ? '100' : undefined}
                onChange={(e) =>
                  setFormValues({ ...formValues, discountValue: e.target.value })
                }
                placeholder={formValues.discountType === 'percentage' ? '20' : '15'}
                required
                type="number"
                value={formValues.discountValue}
              />

              <label htmlFor="discount-code">Discount Code (Alphanumeric) *</label>
              <input
                id="discount-code"
                onChange={(e) =>
                  setFormValues({
                    ...formValues,
                    discountCode: e.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g. SUMMER20"
                required
                value={formValues.discountCode}
              />

              <div className="flex gap-4 items-center mt-4">
                <button
                  className="auth-submit"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? 'Creating…' : 'Save Discount Code'}
                </button>
                <button
                  className="auth-secondary"
                  onClick={() => setShowCreateForm(false)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {state === 'ready' && (
          <div className="seller-discounts-container">
            {discounts.length === 0 ? (
              <div className="seller-products-empty">
                <p>No discount codes available yet.</p>
                <button
                  className="auth-secondary mt-3"
                  onClick={() => setShowCreateForm(true)}
                  type="button"
                >
                  Create your first discount code
                </button>
              </div>
            ) : (
              <div className="seller-discounts-table-wrapper">
                <table className="seller-discounts-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Value</th>
                      <th>Code</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {discounts.map((discount) => (
                      <tr key={discount.id}>
                        <td className="font-semibold">{discount.public_name}</td>
                        <td className="capitalize">
                          {discount.discountType === 'percentage'
                            ? 'Percentage (%)'
                            : 'Flat ($)'}
                        </td>
                        <td>
                          {discount.discountType === 'percentage'
                            ? `${discount.discountValue}%`
                            : `$${discount.discountValue.toFixed(2)}`}
                        </td>
                        <td>
                          <code className="seller-code-tag">{discount.discountCode}</code>
                        </td>
                        <td>
                          <button
                            className="seller-product-delete"
                            disabled={busyCodeId === discount.id}
                            onClick={() => void handleDelete(discount)}
                            type="button"
                          >
                            {busyCodeId === discount.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
