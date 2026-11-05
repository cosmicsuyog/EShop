import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const sellerApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:8000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _sellerAuthRetry?: boolean;
  }
}

const refreshExcludedPaths = new Set([
  '/api/seller-registration',
  '/api/verify-seller',
  '/api/login-seller',
  '/api/refresh-seller-token',
  '/api/logout-seller',
]);

let refreshPromise: Promise<void> | null = null;

const getRequestPath = (config: InternalAxiosRequestConfig) => {
  try {
    return new URL(config.url ?? '', config.baseURL).pathname;
  } catch {
    return config.url?.split('?')[0] ?? '';
  }
};

const clearSellerSession = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('seller:session-cleared'));
  }
};

sellerApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig | undefined;
    if (
      !config ||
      error.response?.status !== 401 ||
      refreshExcludedPaths.has(getRequestPath(config))
    ) {
      return Promise.reject(error);
    }

    if (config._sellerAuthRetry) {
      clearSellerSession();
      return Promise.reject(error);
    }
    config._sellerAuthRetry = true;

    if (!refreshPromise) {
      refreshPromise = sellerApi
        .post('/api/refresh-seller-token')
        .then(() => undefined)
        .catch((refreshError: unknown) => {
          clearSellerSession();
          throw refreshError;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    try {
      await refreshPromise;
      return await sellerApi.request(config);
    } catch {
      return Promise.reject(error);
    }
  }
);

export type SellerShop = {
  id: string;
  name: string;
  bio: string | null;
  category: string;
  website: string | null;
  address: string | null;
  opening_hours: string | null;
};

export type SafeSeller = {
  id: string;
  name: string;
  email: string;
  phone_number: string;
  country: string;
  shop?: SellerShop | null;
};

const isString = (value: unknown): value is string => typeof value === 'string';

const getSafeSellerShop = (value: unknown): SellerShop | null => {
  if (
    !value ||
    typeof value !== 'object' ||
    !('id' in value) ||
    !isString(value.id) ||
    !('name' in value) ||
    !isString(value.name) ||
    !('category' in value) ||
    !isString(value.category)
  ) {
    return null;
  }

  const shop = value as Record<string, unknown>;
  const optionalFields = [
    'bio',
    'website',
    'address',
    'opening_hours',
  ] as const;
  for (const field of optionalFields) {
    const fieldValue = shop[field];
    if (
      fieldValue !== null &&
      fieldValue !== undefined &&
      !isString(fieldValue)
    ) {
      return null;
    }
  }

  return {
    id: value.id,
    name: value.name,
    bio: isString(shop.bio) ? shop.bio : null,
    category: value.category,
    website: isString(shop.website) ? shop.website : null,
    address: isString(shop.address) ? shop.address : null,
    opening_hours: isString(shop.opening_hours) ? shop.opening_hours : null,
  };
};

const isSellerShop = (value: unknown): value is SellerShop =>
  getSafeSellerShop(value) !== null;

export const isSafeSeller = (value: unknown): value is SafeSeller =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      isString(value.id) &&
      'name' in value &&
      isString(value.name) &&
      'email' in value &&
      isString(value.email) &&
      'phone_number' in value &&
      isString(value.phone_number) &&
      'country' in value &&
      isString(value.country) &&
      (!('shop' in value) ||
        value.shop === null ||
        value.shop === undefined ||
        isSellerShop(value.shop))
  );

export const getSafeSellerProfile = (value: unknown): SafeSeller | null => {
  if (!isSafeSeller(value)) {
    return null;
  }

  const shop =
    value.shop === undefined || value.shop === null
      ? value.shop
      : getSafeSellerShop(value.shop);

  return {
    id: value.id,
    name: value.name,
    email: value.email,
    phone_number: value.phone_number,
    country: value.country,
    ...(shop !== undefined ? { shop } : {}),
  };
};

const readSellerResponse = (value: unknown): SafeSeller => {
  if (!value || typeof value !== 'object' || !('seller' in value)) {
    throw new Error('The authentication service returned an invalid seller.');
  }
  const seller = getSafeSellerProfile(value.seller);
  if (!seller) {
    throw new Error('The authentication service returned an invalid seller.');
  }
  return seller;
};

export const registerSeller = async (values: {
  name: string;
  email: string;
  password: string;
  phone_number: string;
  country: string;
}) => sellerApi.post('/api/seller-registration', values);

export const verifySeller = async (
  values: {
    name: string;
    email: string;
    password: string;
    phone_number: string;
    country: string;
  },
  otp: string
) => {
  const { data } = await sellerApi.post('/api/verify-seller', {
    ...values,
    otp,
  });
  return readSellerResponse(data);
};

export const loginSeller = async (email: string, password: string) => {
  const { data } = await sellerApi.post('/api/login-seller', {
    email,
    password,
  });
  return readSellerResponse(data);
};

export const getCurrentSeller = async () => {
  const { data } = await sellerApi.get('/api/logged-in-seller');
  return readSellerResponse(data);
};

export const createSellerShop = async (values: {
  name: string;
  bio: string;
  address: string;
  opening_hours: string;
  website?: string;
  category: string;
}) => {
  const { data } = await sellerApi.post('/api/create-shop', values);
  if (!data || typeof data !== 'object' || !('shop' in data)) {
    throw new Error('The authentication service returned an invalid shop.');
  }
  const shop = getSafeSellerShop(data.shop);
  if (!shop) {
    throw new Error('The authentication service returned an invalid shop.');
  }
  return shop;
};

export const logoutSeller = () => sellerApi.post('/api/logout-seller');

export type StripeAccountStatus = {
  connected: boolean;
  stripeId: string | null;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  currency?: string;
};

export const createStripeConnectLink = async (urls?: {
  refresh_url?: string;
  return_url?: string;
}) => {
  const { data } = await sellerApi.post('/api/create-stripe-link', urls ?? {});
  if (!data || typeof data !== 'object' || typeof data.url !== 'string') {
    throw new Error('Failed to generate Stripe onboarding link.');
  }
  return { url: data.url as string, data: data.data };
};

export const getStripeAccountStatus = async (): Promise<StripeAccountStatus> => {
  const { data } = await sellerApi.get('/api/stripe-account-status');
  if (!data || typeof data !== 'object') {
    throw new Error('Failed to retrieve Stripe account status.');
  }
  return {
    connected: Boolean(data.connected),
    stripeId: (data.stripeId as string) || null,
    detailsSubmitted: Boolean(data.detailsSubmitted),
    payoutsEnabled: Boolean(data.payoutsEnabled),
    chargesEnabled: Boolean(data.chargesEnabled),
    currency: (data.currency as string) || undefined,
  };
};

export const createStripeDashboardLink = async (): Promise<string> => {
  const { data } = await sellerApi.post('/api/create-stripe-dashboard-link');
  if (!data || typeof data !== 'object' || typeof data.url !== 'string') {
    throw new Error('Failed to generate Stripe dashboard link.');
  }
  return data.url;
};

export const getSellerApiErrorMessage = (error: unknown) => {
  if (
    axios.isAxiosError(error) &&
    error.response?.data &&
    typeof error.response.data === 'object' &&
    'message' in error.response.data &&
    typeof error.response.data.message === 'string'
  ) {
    return error.response.data.message;
  }
  return 'We could not complete your request. Please try again.';
};
