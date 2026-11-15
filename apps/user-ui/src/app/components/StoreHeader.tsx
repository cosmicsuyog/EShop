'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { authApi } from '../lib/authApi';
import { useAuth } from './AuthProvider';
import { useLayout } from '../../hooks/useLayout';

const DEFAULT_LOGO = '/brand/eshop-logo.svg';

const EMPTY_CATEGORIES: string[] = [];
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export function StoreHeader({
  searchTerm = '',
  initialCategories = EMPTY_CATEGORIES,
}: {
  searchTerm?: string;
  initialCategories?: string[];
}) {
  const router = useRouter();
  const { user, status, cart, clearSession } = useAuth();
  const { data: layout } = useLayout();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [isDepartmentsOpen, setIsDepartmentsOpen] = useState(false);
  const [categories, setCategories] = useState(initialCategories);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [subcategoriesByCategory, setSubcategoriesByCategory] = useState<
    Record<string, string[]>
  >({});
  const [loadingSubcategories, setLoadingSubcategories] = useState<string | null>(null);
  const [subcategoryError, setSubcategoryError] = useState<string | null>(null);
  const departmentsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  useEffect(() => {
    if (layout?.categories?.length) setCategories(layout.categories);
  }, [layout?.categories]);

  useEffect(() => {
    const syncFavorites = () => {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem('eshop:favorites') ?? '[]');
        setFavoriteCount(Array.isArray(saved) ? saved.length : 0);
      } catch { setFavoriteCount(0); }
    };
    syncFavorites();
    window.addEventListener('eshop:favorites-changed', syncFavorites);
    return () => window.removeEventListener('eshop:favorites-changed', syncFavorites);
  }, []);

  useEffect(() => {
    if (!isDepartmentsOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsDepartmentsOpen(false);
        setExpandedCategory(null);
      }
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!departmentsRef.current?.contains(event.target as Node)) {
        setIsDepartmentsOpen(false);
        setExpandedCategory(null);
      }
    };

    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsideClick);
    };
  }, [isDepartmentsOpen]);

  const loadCategories = async () => {
    if (categories.length > 0 || categoriesLoading) return;
    setCategoriesLoading(true);
    setCategoriesError(false);
    try {
      const gatewayUrl =
        process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:8000';
      const response = await fetch(
        new URL('/product/api/categories', gatewayUrl),
        { cache: 'no-store' }
      );
      const payload: unknown = await response.json();
      if (
        !response.ok ||
        !payload ||
        typeof payload !== 'object' ||
        !('success' in payload) ||
        payload.success !== true ||
        !('categories' in payload)
      ) {
        throw new Error('Invalid categories response');
      }
      const receivedCategories = payload.categories;
      if (!isStringArray(receivedCategories)) {
        throw new Error('Invalid categories response');
      }
      setCategories(receivedCategories);
    } catch {
      setCategoriesError(true);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadSubcategories = async (category: string) => {
    setExpandedCategory(category);
    setSubcategoryError(null);
    if (category in subcategoriesByCategory || loadingSubcategories === category) {
      return;
    }

    setLoadingSubcategories(category);
    try {
      const gatewayUrl =
        process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:8000';
      const endpoint = new URL('/product/api/subcategories', gatewayUrl);
      endpoint.searchParams.set('category', category);
      const response = await fetch(endpoint, { cache: 'no-store' });
      const payload: unknown = await response.json();
      if (
        !response.ok ||
        !payload ||
        typeof payload !== 'object' ||
        !('success' in payload) ||
        payload.success !== true ||
        !('subcategories' in payload)
      ) {
        throw new Error('Invalid subcategories response');
      }
      const receivedSubcategories = payload.subcategories;
      if (!isStringArray(receivedSubcategories)) {
        throw new Error('Invalid subcategories response');
      }
      setSubcategoriesByCategory((current) => ({
        ...current,
        [category]: receivedSubcategories,
      }));
    } catch {
      setSubcategoryError(category);
    } finally {
      setLoadingSubcategories(null);
    }
  };

  const categoryHref = (category: string, subcategory?: string) => {
    const query = new URLSearchParams({ category });
    if (subcategory) query.set('subcategory', subcategory);
    if (searchTerm) query.set('q', searchTerm);
    return `/?${query.toString()}`;
  };

  const signOut = async () => {
    setIsSigningOut(true);
    try {
      await authApi.post('/api/auth/logout-user');
      clearSession();
      router.replace('/login?logout=success');
    } catch {
      clearSession();
      router.replace('/login?logout=failed');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="store-header">
      <div className="store-header-main">
        <div className="store-brand-group">
          <Link className="store-brand" href="/" aria-label="EShop home">
            <img className="store-brand-image" src={layout?.logo || DEFAULT_LOGO} alt="EShop" />
          </Link>
          <span className="store-header-note">Thoughtful finds, everyday.</span>
        </div>

        <form action="/" className="market-search" method="get" role="search">
          <label className="visually-hidden" htmlFor="market-search">
            Search products
          </label>
          <input
            autoComplete="off"
            defaultValue={searchTerm}
            id="market-search"
            maxLength={100}
            name="q"
            placeholder="Search the collection…"
            type="search"
          />
          <button aria-label="Search" type="submit">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="10.8" cy="10.8" r="6.4" />
              <path d="m16 16 4.2 4.2" />
            </svg>
          </button>
        </form>

        <nav className="auth-header-actions" aria-label="Account">
          <a
            className="auth-header-link open-shop-link"
            href={`${process.env.NEXT_PUBLIC_SELLER_SERVER_URI ?? process.env.NEXT_PUBLIC_SELLER_UI_URL ?? 'http://localhost:3001'}/signup`}
          >
            Open a shop
          </a>
          <Link
            aria-label={`Cart, ${cart?.itemCount ?? 0} items`}
            className="auth-header-link cart-header-link"
            href="/cart"
          >
            Cart{' '}
            <span className="cart-count">{cart?.itemCount ?? 0}</span>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M3 4h2l2.2 11.2a2 2 0 0 0 2 1.6h8a2 2 0 0 0 1.9-1.5L21 8H6" />
              <path d="M9 8v9m6-9v9" />
              <path d="M7 8h14l-1 11H9L7 8Z" />
            </svg>
          </Link>
          {status === 'loading' ? (
            <span className="auth-header-status" role="status">
              Checking account…
            </span>
          ) : user ? (
            <>
              <Link className="auth-header-link account-header-link" href="/profile">
                <span className="account-header-icon" aria-hidden="true">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="account-header-copy">
                  <span>Hello,</span>
                  <strong>{user.name.split(' ')[0]}</strong>
                </span>
              </Link>
              <button
                className="auth-header-link auth-sign-out"
                disabled={isSigningOut}
                onClick={signOut}
                type="button"
              >
                {isSigningOut ? 'Signing out…' : 'Sign out'}
              </button>
            </>
          ) : (
            <>
              <Link
                className="auth-header-link account-header-link"
                href="/login"
              >
                <span className="account-header-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="8" r="3.2" />
                    <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
                  </svg>
                </span>
                <span className="account-header-copy">
                  <span>Hello,</span>
                  <strong>Sign in</strong>
                </span>
              </Link>
              <Link
                className="auth-header-link create-account-link"
                href="/register"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>

      <nav className="store-nav" aria-label="Main navigation">
        <div className="department-menu-wrap" ref={departmentsRef}>
          <button
            aria-controls="department-menu"
            aria-expanded={isDepartmentsOpen}
            className="department-link"
            onClick={() => {
              const nextOpen = !isDepartmentsOpen;
              setIsDepartmentsOpen(nextOpen);
              if (nextOpen) void loadCategories();
              else setExpandedCategory(null);
            }}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>All departments</span>
            <span className="department-chevron" aria-hidden="true">⌄</span>
          </button>
          {isDepartmentsOpen && (
            <div
              className="department-menu"
              id="department-menu"
              aria-label="Browse departments"
            >
              {categoriesLoading && categories.length === 0 ? (
                <p className="department-menu-state" role="status">
                  Loading departments…
                </p>
              ) : categoriesError && categories.length === 0 ? (
                <div className="department-menu-state" role="status">
                  <span>Departments are temporarily unavailable.</span>
                  <button type="button" onClick={() => void loadCategories()}>
                    Try again
                  </button>
                </div>
              ) : categories.length === 0 ? (
                <p className="department-menu-state" role="status">
                  No departments yet.
                </p>
              ) : (
                <ul>
                  {categories.map((category) => {
                    const isExpanded = expandedCategory === category;
                    const subcategories = subcategoriesByCategory[category] ?? [];
                    return (
                      <li key={category}>
                        <div
                          className={`department-category-row${isExpanded ? ' is-expanded' : ''}`}
                          onMouseEnter={() => void loadSubcategories(category)}
                        >
                          <Link
                            href={categoryHref(category)}
                            onClick={() => setIsDepartmentsOpen(false)}
                          >
                            {category}
                          </Link>
                          <button
                            aria-expanded={isExpanded}
                            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${category} subcategories`}
                            onClick={() => {
                              if (isExpanded) setExpandedCategory(null);
                              else void loadSubcategories(category);
                            }}
                            type="button"
                          >
                            <span aria-hidden="true">›</span>
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="department-subcategories">
                            {loadingSubcategories === category ? (
                              <p role="status">Loading…</p>
                            ) : subcategoryError === category ? (
                              <button
                                className="department-retry"
                                onClick={() => void loadSubcategories(category)}
                                type="button"
                              >
                                Could not load. Try again
                              </button>
                            ) : subcategories.length > 0 ? (
                              subcategories.map((subcategory) => (
                                <Link
                                  href={categoryHref(category, subcategory)}
                                  key={subcategory}
                                  onClick={() => setIsDepartmentsOpen(false)}
                                >
                                  {subcategory}
                                </Link>
                              ))
                            ) : (
                              <p>No subcategories available.</p>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="store-nav-links">
          <Link href="/">Home</Link>
          <Link href="/#catalog">Products</Link>
          <a
            href={`${
              process.env.NEXT_PUBLIC_SELLER_SERVER_URI ?? process.env.NEXT_PUBLIC_SELLER_UI_URL ?? 'http://localhost:3001'
            }/signup`}
          >
            Become a seller
          </a>
        </div>
        <div className="store-nav-quick-links" aria-label="Shopping shortcuts">
          <Link aria-label={`Favorites, ${favoriteCount} items`} href="/favorites" title="Favorites"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg><span>{favoriteCount}</span></Link>
          <Link aria-label={`Cart, ${cart?.itemCount ?? 0} items`} href="/cart" title="Shopping bag"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></svg><span>{cart?.itemCount ?? 0}</span></Link>
        </div>
      </nav>
    </header>
  );
}
