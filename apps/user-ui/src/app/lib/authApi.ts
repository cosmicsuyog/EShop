import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

export const authApi = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:8000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _authRetry?: boolean;
  }
}

const refreshExcludedPaths = new Set([
  '/api/login-user',
  '/api/user-registration',
  '/api/verify-registration',
  '/api/auth/refresh-token',
  '/api/auth/logout-user',
]);

let refreshPromise: Promise<void> | null = null;

const getRequestPath = (config: InternalAxiosRequestConfig) => {
  try {
    return new URL(config.url ?? '', config.baseURL).pathname;
  } catch {
    return config.url?.split('?')[0] ?? '';
  }
};

const clearClientSession = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:session-cleared'));
  }
};

authApi.interceptors.response.use(
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

    if (config._authRetry) {
      clearClientSession();
      return Promise.reject(error);
    }
    config._authRetry = true;

    if (!refreshPromise) {
      refreshPromise = authApi
        .post('/api/auth/refresh-token')
        .then(() => undefined)
        .catch((refreshError: unknown) => {
          clearClientSession();
          throw refreshError;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    try {
      await refreshPromise;
      return await authApi.request(config);
    } catch {
      return Promise.reject(error);
    }
  }
);

export type SafeUser = {
  id: string;
  email: string;
  name: string;
};

export const isSafeUser = (value: unknown): value is SafeUser =>
  Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      typeof value.id === 'string' &&
      'email' in value &&
      typeof value.email === 'string' &&
      'name' in value &&
      typeof value.name === 'string'
  );

export const getSafeUserProfile = (value: unknown): SafeUser | null =>
  isSafeUser(value)
    ? {
        id: value.id,
        email: value.email,
        name: value.name,
      }
    : null;

export const loginCustomer = async (email: string, password: string) => {
  const { data } = await authApi.post<{ user?: unknown }>('/api/login-user', {
    email,
    password,
  });
  const user = getSafeUserProfile(data.user);
  if (!user) {
    throw new Error('The authentication service returned an invalid user.');
  }
  return user;
};

export const requestCustomerRegistration = async (values: {
  name: string;
  email: string;
  password: string;
}) => authApi.post('/api/user-registration', values);

export const verifyCustomerRegistration = async (
  values: { name: string; email: string; password: string },
  otp: string
) =>
  authApi.post('/api/verify-registration', {
    ...values,
    otp,
  });

export const getCurrentUser = async () => {
  const { data } = await authApi.get<{ user?: unknown }>(
    '/api/auth/logged-in-user'
  );
  const user = getSafeUserProfile(data.user);
  if (!user) {
    throw new Error('The authentication service returned an invalid user.');
  }
  return user;
};

export const getApiErrorMessage = (error: unknown) => {
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

export const getPostLoginPath = (search: string) => {
  const requestedPath = new URLSearchParams(search).get('next');
  if (
    !requestedPath?.startsWith('/') ||
    requestedPath.startsWith('//')
  ) {
    return '/account';
  }

  const resolvedPath = new URL(requestedPath, 'http://localhost');
  return resolvedPath.origin === 'http://localhost'
    ? `${resolvedPath.pathname}${resolvedPath.search}${resolvedPath.hash}`
    : '/account';
};
