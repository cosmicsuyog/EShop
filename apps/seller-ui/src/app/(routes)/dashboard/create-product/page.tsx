'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { SellerHeader } from '../../../components/SellerHeader';
import {
  getCurrentSeller,
  getSellerApiErrorMessage,
} from '../../../lib/sellerApi';
import {
  createSellerProduct,
  SellerProductInput,
} from '../../../lib/sellerProductApi';

type FormValues = {
  title: string;
  slug: string;
  short_description: string;
  detailed_description: string;
  category: string;
  subcategory: string;
  tags: string;
  colors: string;
  sizes: string;
  stock: string;
  sale_price: string;
  regular_price: string;
  brand: string;
  video_url: string;
  warranty: string;
  cash_on_delivery: string;
};

const initialValues: FormValues = {
  title: '',
  slug: '',
  short_description: '',
  detailed_description: '',
  category: '',
  subcategory: '',
  tags: '',
  colors: '',
  sizes: '',
  stock: '0',
  sale_price: '',
  regular_price: '',
  brand: '',
  video_url: '',
  warranty: '',
  cash_on_delivery: '',
};

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

const parseList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const optionalValue = (value: string) => value.trim() || undefined;

export default function NewSellerProductPage() {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [state, setState] = useState<PageState>('checking');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getCurrentSeller()
      .then((seller) => {
        if (active) {
          setState(seller.shop ? 'ready' : 'shop-required');
        }
      })
      .catch((requestError: unknown) => {
        if (!active) {
          return;
        }
        if (isUnauthorized(requestError)) {
          setState('unauthenticated');
        } else {
          setError(getSellerApiErrorMessage(requestError));
          setState('error');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const update = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (state !== 'ready') {
      setError('Sign in as a seller with an owned shop to create products.');
      return;
    }

    const stock = Number(values.stock);
    const salePrice = Number(values.sale_price);
    const regularPrice = Number(values.regular_price);
    if (
      values.stock.trim().length === 0 ||
      values.sale_price.trim().length === 0 ||
      values.regular_price.trim().length === 0 ||
      !Number.isSafeInteger(stock) ||
      stock < 0 ||
      !Number.isFinite(salePrice) ||
      salePrice < 0 ||
      !Number.isFinite(regularPrice) ||
      regularPrice < 0
    ) {
      setError('Enter a non-negative whole-number stock and valid prices.');
      return;
    }

    const input: SellerProductInput = {
      title: values.title.trim(),
      slug: values.slug.trim(),
      short_description: values.short_description.trim(),
      detailed_description: values.detailed_description.trim(),
      category: values.category.trim(),
      subcategory: values.subcategory.trim(),
      tags: parseList(values.tags),
      colors: parseList(values.colors),
      sizes: parseList(values.sizes),
      stock,
      sale_price: salePrice,
      regular_price: regularPrice,
      ...(optionalValue(values.brand)
        ? { brand: optionalValue(values.brand) }
        : {}),
      ...(optionalValue(values.video_url)
        ? { video_url: optionalValue(values.video_url) }
        : {}),
      ...(optionalValue(values.warranty)
        ? { warranty: optionalValue(values.warranty) }
        : {}),
      ...(optionalValue(values.cash_on_delivery)
        ? { cash_on_delivery: optionalValue(values.cash_on_delivery) }
        : {}),
    };

    setIsSubmitting(true);
    try {
      await createSellerProduct(input);
      router.push('/dashboard/all-products');
    } catch (requestError) {
      setError(getSellerApiErrorMessage(requestError));
      setIsSubmitting(false);
    }
  };

  const field = (
    id: keyof FormValues,
    label: string,
    options: {
      required?: boolean;
      type?: string;
      multiline?: boolean;
      hint?: string;
    } = {}
  ) => (
    <>
      <label htmlFor={`seller-product-${id}`}>{label}</label>
      {options.multiline ? (
        <textarea
          id={`seller-product-${id}`}
          onChange={(event) => update(id, event.target.value)}
          required={options.required}
          value={values[id]}
        />
      ) : (
        <input
          autoComplete="off"
          id={`seller-product-${id}`}
          onChange={(event) => update(id, event.target.value)}
          required={options.required}
          type={options.type ?? 'text'}
          value={values[id]}
        />
      )}
      {options.hint && (
        <span className="seller-product-field-hint">{options.hint}</span>
      )}
    </>
  );

  return (
    <main className="store-shell">
      <SellerHeader />
      <section
        className="auth-panel seller-product-form-panel"
        aria-labelledby="seller-product-form-title"
      >
        <p className="catalog-eyebrow">SELL WITH ESHOP</p>
        <h1 id="seller-product-form-title">Add a product</h1>
        <p className="auth-intro">
          Add the product details shown in your shop and the customer catalog.
        </p>

        {state === 'checking' && (
          <p className="auth-notice" role="status">
            Checking seller session…
          </p>
        )}
        {state === 'unauthenticated' && (
          <div className="seller-products-notice">
            <p>Sign in as a seller to create products.</p>
            <Link href="/login">Seller sign in</Link>
          </div>
        )}
        {state === 'shop-required' && (
          <div className="seller-products-notice">
            <p>Create your shop before adding products.</p>
            <Link href="/signup">Set up your shop</Link>
          </div>
        )}
        {state === 'error' && (
          <p className="auth-error seller-form-error" role="alert">
            {error}
          </p>
        )}
        {error && state === 'ready' && (
          <p className="auth-error seller-form-error" role="alert">
            {error}
          </p>
        )}
        {state === 'ready' && (
          <form className="auth-form" onSubmit={submit} noValidate>
            {field('title', 'Product name', { required: true })}
            {field('slug', 'Product slug', { required: true })}
            {field('category', 'Category', { required: true })}
            {field('subcategory', 'Subcategory', { required: true })}
            {field('short_description', 'Short description', {
              required: true,
              multiline: true,
            })}
            {field('detailed_description', 'Detailed description', {
              required: true,
              multiline: true,
            })}
            {field('stock', 'Stock', { required: true, type: 'number' })}
            {field('sale_price', 'Sale price', {
              required: true,
              type: 'number',
            })}
            {field('regular_price', 'Regular price', {
              required: true,
              type: 'number',
            })}
            {field('tags', 'Tags', {
              hint: 'Separate multiple values with commas.',
            })}
            {field('colors', 'Colors', {
              hint: 'Separate multiple values with commas.',
            })}
            {field('sizes', 'Sizes', {
              hint: 'Separate multiple values with commas.',
            })}
            {field('brand', 'Brand')}
            {field('warranty', 'Warranty')}
            {field('video_url', 'Video URL', { type: 'url' })}
            {field('cash_on_delivery', 'Cash on delivery')}

            <button
              className="auth-submit"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Creating product…' : 'Create product'}
            </button>
            <Link className="seller-product-cancel" href="/dashboard/all-products">
              Cancel
            </Link>
          </form>
        )}
      </section>
    </main>
  );
}
