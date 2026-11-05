'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { SellerHeader } from '../../components/SellerHeader';
import {
  createSellerShop,
  getCurrentSeller,
  getSellerApiErrorMessage,
  logoutSeller,
  registerSeller,
  SafeSeller,
  SellerShop,
  verifySeller,
} from '../../lib/sellerApi';
import {
  SellerRegistrationValues,
  SellerShopValues,
  validateSellerRegistration,
  validateSellerShop,
} from '../../lib/sellerFormValidation';

const shopCategories = [
  ['clothing', 'Clothing & Apparel'],
  ['electronics', 'Electronics & Gadgets'],
  ['grocery', 'Grocery & Supermarkets'],
  ['restaurant', 'Restaurants & Cafes'],
  ['beauty', 'Beauty & Personal Care'],
  ['furniture', 'Furniture & Home Decor'],
  ['books', 'Books & Stationery'],
  ['toys', 'Toys & Games'],
  ['sports', 'Sports & Fitness'],
  ['hardware', 'Hardware & Tools'],
  ['pet', 'Pet Supplies & Services'],
  ['medical', 'Medical Supplies & Equipment'],
  ['jewelry', 'Jewelry & Accessories'],
  ['florist', 'Florist & Gifts'],
  ['baby', 'Baby Products & Kids Stores'],
  ['art', 'Art & Collectibles'],
  ['music', 'Music & Entertainment'],
  ['technology', 'Technology & Electronics'],
  ['garden', 'Garden & Outdoor Living'],
  ['bakery', 'Bakery & Pastry'],
  ['optical', 'Optical & Vision Care'],
  ['mobile', 'Mobile Phones & Accessories'],
  ['real_estate', 'Real Estate & Home Services'],
  ['fitness', 'Fitness & Sports'],
  ['entertainment', 'Entertainment & Media'],
  ['automotive', 'Automotive & Motor Vehicles'],
  ['outdoors', 'Outdoors & Camping'],
  ['home', 'Home & Living'],
  ['health', 'Health & Wellness'],
  ['other', 'Other'],
] as const;

const emptyRegistration: SellerRegistrationValues = {
  name: '',
  email: '',
  password: '',
  phone_number: '',
  country: '',
};

const emptyShop: SellerShopValues = {
  name: '',
  bio: '',
  address: '',
  opening_hours: '',
  website: '',
  category: '',
};

type SignupStep = 'account' | 'verification' | 'shop' | 'complete';

export default function SellerRegisterPage() {
  const [step, setStep] = useState<SignupStep>('account');
  const [registration, setRegistration] =
    useState<SellerRegistrationValues>(emptyRegistration);
  const [otp, setOtp] = useState('');
  const [shopValues, setShopValues] = useState<SellerShopValues>(emptyShop);
  const [seller, setSeller] = useState<SafeSeller | null>(null);
  const [createdShop, setCreatedShop] = useState<SellerShop | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getCurrentSeller()
      .then((profile) => {
        if (!active) {
          return;
        }
        setSeller(profile);
        if (profile.shop) {
          setCreatedShop(profile.shop);
          setStep('complete');
        } else {
          setStep('shop');
        }
      })
      .catch((requestError: unknown) => {
        if (
          active &&
          !(
            requestError &&
            typeof requestError === 'object' &&
            'response' in requestError &&
            requestError.response &&
            typeof requestError.response === 'object' &&
            'status' in requestError.response &&
            requestError.response.status === 401
          )
        ) {
          setError(getSellerApiErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) {
          setIsCheckingSession(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const clearSession = () => {
      setSeller(null);
      setCreatedShop(null);
      setStep('account');
    };
    window.addEventListener('seller:session-cleared', clearSession);
    return () =>
      window.removeEventListener('seller:session-cleared', clearSession);
  }, []);

  const updateRegistration = (
    field: keyof SellerRegistrationValues,
    value: string
  ) => {
    setRegistration((current) => ({ ...current, [field]: value }));
  };

  const updateShop = (field: keyof SellerShopValues, value: string) => {
    setShopValues((current) => ({ ...current, [field]: value }));
  };

  const submitAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const validationError = validateSellerRegistration(registration);
    if (validationError) {
      setError(validationError);
      return;
    }

    const normalized = {
      ...registration,
      name: registration.name.trim(),
      email: registration.email.trim().toLowerCase(),
      phone_number: registration.phone_number.trim(),
      country: registration.country.trim(),
    };
    setRegistration(normalized);
    setIsSubmitting(true);
    try {
      await registerSeller(normalized);
      setStep('verification');
    } catch (requestError) {
      setError(getSellerApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitVerification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the six-digit verification code sent to your email.');
      return;
    }

    setIsSubmitting(true);
    try {
      const verifiedSeller = await verifySeller(registration, otp);
      setSeller(verifiedSeller);
      setRegistration((current) => ({ ...current, password: '' }));
      setOtp('');
      setStep('shop');
    } catch (requestError) {
      setError(getSellerApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitShop = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const validationError = validateSellerShop(shopValues);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!seller) {
      setError('Sign in as a seller to create your shop.');
      return;
    }

    setIsSubmitting(true);
    try {
      const shop = await createSellerShop({
        ...shopValues,
        name: shopValues.name.trim(),
        bio: shopValues.bio.trim(),
        address: shopValues.address.trim(),
        opening_hours: shopValues.opening_hours.trim(),
        website: shopValues.website.trim() || undefined,
      });
      setCreatedShop(shop);
      setSeller((current) => (current ? { ...current, shop } : current));
      setStep('complete');
    } catch (requestError) {
      setError(getSellerApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const signOut = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await logoutSeller();
      setSeller(null);
      setCreatedShop(null);
      setRegistration(emptyRegistration);
      setShopValues(emptyShop);
      setStep('account');
    } catch (requestError) {
      setError(getSellerApiErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="store-shell">
      <SellerHeader />

      <section
        className="auth-panel seller-onboarding"
        aria-labelledby="seller-register-title"
      >
        <p className="catalog-eyebrow">SELL WITH ESHOP</p>
        <h1 id="seller-register-title">Seller onboarding</h1>
        <div className="seller-stepper" aria-label="Seller setup progress">
          <span
            className={
              step === 'account' || step === 'verification' ? 'is-active' : ''
            }
          >
            Create account
          </span>
          <span className={step === 'shop' ? 'is-active' : ''}>
            Set up shop
          </span>
          <span className={step === 'complete' ? 'is-active' : ''}>
            Complete
          </span>
        </div>

        {isCheckingSession ? (
          <p className="auth-notice" role="status">
            Checking seller session…
          </p>
        ) : (
          <>
            {error && (
              <p className="auth-error seller-form-error" role="alert">
                {error}
              </p>
            )}

            {step === 'account' && (
              <>
                <p className="auth-intro">
                  Create a seller account to set up your shop.
                </p>
                <form className="auth-form" onSubmit={submitAccount} noValidate>
                  <label htmlFor="seller-name">Name</label>
                  <input
                    autoComplete="name"
                    id="seller-name"
                    onChange={(event) =>
                      updateRegistration('name', event.target.value)
                    }
                    required
                    value={registration.name}
                  />

                  <label htmlFor="seller-email">Email address</label>
                  <input
                    autoComplete="email"
                    id="seller-email"
                    onChange={(event) =>
                      updateRegistration('email', event.target.value)
                    }
                    required
                    type="email"
                    value={registration.email}
                  />

                  <label htmlFor="seller-phone">Phone number</label>
                  <input
                    autoComplete="tel"
                    id="seller-phone"
                    onChange={(event) =>
                      updateRegistration('phone_number', event.target.value)
                    }
                    required
                    type="tel"
                    value={registration.phone_number}
                  />

                  <label htmlFor="seller-country">Country</label>
                  <input
                    autoComplete="country-name"
                    id="seller-country"
                    onChange={(event) =>
                      updateRegistration('country', event.target.value)
                    }
                    required
                    value={registration.country}
                  />

                  <label htmlFor="seller-password">Password</label>
                  <input
                    autoComplete="new-password"
                    id="seller-password"
                    onChange={(event) =>
                      updateRegistration('password', event.target.value)
                    }
                    required
                    type="password"
                    value={registration.password}
                  />

                  <button
                    className="auth-submit"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    {isSubmitting ? 'Sending code…' : 'Send verification code'}
                  </button>
                </form>
              </>
            )}

            {step === 'verification' && (
              <>
                <p className="auth-intro">
                  Enter the six-digit verification code sent to{' '}
                  {registration.email}.
                </p>
                <form
                  className="auth-form"
                  onSubmit={submitVerification}
                  noValidate
                >
                  <label htmlFor="seller-otp">Verification code</label>
                  <input
                    autoComplete="one-time-code"
                    id="seller-otp"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    pattern="\d{4}"
                    required
                    value={otp}
                  />
                  <button
                    className="auth-submit"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    {isSubmitting ? 'Verifying…' : 'Verify and continue'}
                  </button>
                  <button
                    className="auth-secondary"
                    disabled={isSubmitting}
                    onClick={() => {
                      setStep('account');
                      setError('');
                    }}
                    type="button"
                  >
                    Back to account details
                  </button>
                </form>
              </>
            )}

            {step === 'shop' && (
              <>
                <p className="auth-intro">
                  {seller
                    ? `Welcome, ${seller.name}. Add the basic details for your shop.`
                    : 'Sign in as a seller to create your shop.'}
                </p>
                <form className="auth-form" onSubmit={submitShop} noValidate>
                  <label htmlFor="shop-name">Shop name *</label>
                  <input
                    autoComplete="organization"
                    id="shop-name"
                    onChange={(event) => updateShop('name', event.target.value)}
                    required
                    value={shopValues.name}
                  />

                  <label htmlFor="shop-bio">Bio (maximum 100 words) *</label>
                  <input
                    id="shop-bio"
                    onChange={(event) => updateShop('bio', event.target.value)}
                    required
                    value={shopValues.bio}
                  />

                  <label htmlFor="shop-address">Address *</label>
                  <input
                    autoComplete="street-address"
                    id="shop-address"
                    onChange={(event) =>
                      updateShop('address', event.target.value)
                    }
                    required
                    value={shopValues.address}
                  />

                  <label htmlFor="shop-opening-hours">Opening hours *</label>
                  <input
                    id="shop-opening-hours"
                    onChange={(event) =>
                      updateShop('opening_hours', event.target.value)
                    }
                    placeholder="Mon-Fri: 9am-6pm"
                    required
                    value={shopValues.opening_hours}
                  />

                  <label htmlFor="shop-website">Website</label>
                  <input
                    autoComplete="url"
                    id="shop-website"
                    onChange={(event) =>
                      updateShop('website', event.target.value)
                    }
                    type="url"
                    value={shopValues.website}
                  />

                  <label htmlFor="shop-category">Category *</label>
                  <select
                    id="shop-category"
                    onChange={(event) =>
                      updateShop('category', event.target.value)
                    }
                    required
                    value={shopValues.category}
                  >
                    <option value="">Select a category</option>
                    {shopCategories.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>

                  <button
                    className="auth-submit"
                    disabled={isSubmitting || !seller}
                    type="submit"
                  >
                    {isSubmitting ? 'Creating shop…' : 'Create shop'}
                  </button>
                </form>
              </>
            )}

            {step === 'complete' && createdShop && (
              <div className="auth-success" role="status">
                <h2>Your shop is ready</h2>
                <p>{createdShop.name}</p>
                <p>{createdShop.category}</p>
                <Link href="/dashboard/payments">Set up payouts (Stripe Connect)</Link>
                <Link href="/dashboard/discount-codes">Manage discount codes</Link>
                <Link href="/dashboard/all-products">Manage products</Link>
                <a href={process.env.NEXT_PUBLIC_USER_UI_URL ?? 'http://localhost:3000'}>
                  Continue to the storefront
                </a>
                <button
                  className="auth-secondary seller-sign-out"
                  disabled={isSubmitting}
                  onClick={signOut}
                  type="button"
                >
                  {isSubmitting ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            )}
          </>
        )}

        <p className="auth-switch">
          Already a seller? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
