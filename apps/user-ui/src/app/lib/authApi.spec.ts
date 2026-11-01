import {
  type AxiosAdapter,
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import {
  authApi,
  getApiErrorMessage,
  getCurrentUser,
  getPostLoginPath,
  isSafeUser,
  loginCustomer,
  requestCustomerRegistration,
  SafeUser,
  verifyCustomerRegistration,
} from './authApi';

const makeResponse = (
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown
): AxiosResponse => ({
  data,
  status,
  statusText: status === 401 ? 'Unauthorized' : 'OK',
  headers: new AxiosHeaders(),
  config,
});

const unauthorized = (config: InternalAxiosRequestConfig) => {
  const response = makeResponse(config, 401, { message: 'Unauthorized' });
  return Promise.reject(
    new AxiosError(
      'Unauthorized',
      AxiosError.ERR_BAD_REQUEST,
      config,
      undefined,
      response
    )
  );
};

describe('auth API client', () => {
  const originalAdapter = authApi.defaults.adapter as AxiosAdapter;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

  afterEach(() => {
    authApi.defaults.adapter = originalAdapter;
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  });

  it('shares one refresh request between concurrent 401 responses', async () => {
    let refreshCount = 0;
    const resourceAttempts = new Map<string, number>();

    authApi.defaults.adapter = async (config) => {
      const path = new URL(config.url ?? '', config.baseURL).pathname;
      if (path === '/api/auth/refresh-token') {
        refreshCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return makeResponse(config, 200, { success: true });
      }

      const attempts = (resourceAttempts.get(path) ?? 0) + 1;
      resourceAttempts.set(path, attempts);
      if (!config._authRetry) {
        return unauthorized(config);
      }

      return makeResponse(config, 200, { path, attempts });
    };

    const responses = await Promise.all([
      authApi.get('/api/resource-one'),
      authApi.get('/api/resource-two'),
    ]);

    expect(refreshCount).toBe(1);
    expect(resourceAttempts.get('/api/resource-one')).toBe(2);
    expect(resourceAttempts.get('/api/resource-two')).toBe(2);
    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
  });

  it('does not refresh login, registration, or refresh requests', async () => {
    const requestedPaths: string[] = [];
    let refreshRequestCount = 0;
    authApi.defaults.adapter = async (config) => {
      const path = new URL(config.url ?? '', config.baseURL).pathname;
      requestedPaths.push(path);
      if (path === '/api/auth/refresh-token') {
        refreshRequestCount += 1;
      }
      return unauthorized(config);
    };

    await Promise.all(
      [
        '/api/login-user',
        '/api/user-registration',
        '/api/verify-registration',
        '/api/auth/refresh-token',
        '/api/auth/logout-user',
      ].map((path) => authApi.post(path).catch(() => undefined))
    );

    expect(requestedPaths).toHaveLength(5);
    expect(refreshRequestCount).toBe(1);
  });

  it('logs in with credentials and returns only safe profile data', async () => {
    let requestConfig: InternalAxiosRequestConfig | undefined;
    authApi.defaults.adapter = async (config) => {
      requestConfig = config;
      return makeResponse(config, 200, {
        user: {
          id: 'user-1',
          email: 'customer@example.com',
          name: 'Customer',
          password: 'must-not-be-retained',
        },
      });
    };

    await expect(
      loginCustomer('customer@example.com', 'password')
    ).resolves.toEqual({
      id: 'user-1',
      email: 'customer@example.com',
      name: 'Customer',
    });
    expect(requestConfig?.url).toBe('/api/login-user');
    expect(requestConfig?.withCredentials).toBe(true);
    expect(JSON.parse(requestConfig?.data as string)).toEqual({
      email: 'customer@example.com',
      password: 'password',
    });
  });

  it('handles invalid login credentials without refreshing', async () => {
    let refreshCount = 0;
    authApi.defaults.adapter = async (config) => {
      if (config.url === '/api/auth/refresh-token') {
        refreshCount += 1;
      }
      return unauthorized(config);
    };

    await expect(
      loginCustomer('customer@example.com', 'wrong-password')
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(refreshCount).toBe(0);
  });

  it('sends the backend two-step OTP registration contract', async () => {
    const requests: Array<{ path: string; body: unknown }> = [];
    authApi.defaults.adapter = async (config) => {
      requests.push({
        path: config.url ?? '',
        body: JSON.parse(config.data as string),
      });
      return makeResponse(config, 200, { success: true });
    };

    const values = {
      name: 'Customer',
      email: 'customer@example.com',
      password: 'password',
    };
    await requestCustomerRegistration(values);
    await verifyCustomerRegistration(values, '1234');

    expect(requests).toEqual([
      { path: '/api/user-registration', body: values },
      { path: '/api/verify-registration', body: { ...values, otp: '1234' } },
    ]);
  });

  it('returns registration and verification server errors to the UI', async () => {
    authApi.defaults.adapter = async (config) => {
      const response = makeResponse(config, 400, {
        message: 'User already exists with this email!',
      });
      return Promise.reject(
        new AxiosError(
          'Bad Request',
          AxiosError.ERR_BAD_REQUEST,
          config,
          undefined,
          response
        )
      );
    };

    await expect(
      requestCustomerRegistration({
        name: 'Customer',
        email: 'customer@example.com',
        password: 'password',
      })
    ).rejects.toMatchObject({ response: { status: 400 } });
    try {
      await verifyCustomerRegistration(
        {
          name: 'Customer',
          email: 'customer@example.com',
          password: 'password',
        },
        '1234'
      );
      throw new Error('Verification should have failed.');
    } catch (error) {
      expect(getApiErrorMessage(error)).toBe(
        'User already exists with this email!'
      );
    }
  });

  it('restores a safe current-user profile without sensitive fields', async () => {
    authApi.defaults.adapter = async (config) =>
      makeResponse(config, 200, {
        user: {
          id: 'user-1',
          email: 'customer@example.com',
          name: 'Customer',
          password: 'must-not-be-retained',
        },
      });

    await expect(getCurrentUser()).resolves.toEqual({
      id: 'user-1',
      email: 'customer@example.com',
      name: 'Customer',
    });
  });

  it('retries a protected request no more than once', async () => {
    let refreshCount = 0;
    let requestCount = 0;
    authApi.defaults.adapter = async (config) => {
      const path = new URL(config.url ?? '', config.baseURL).pathname;
      if (path === '/api/auth/refresh-token') {
        refreshCount += 1;
        return makeResponse(config, 200, { success: true });
      }

      requestCount += 1;
      return unauthorized(config);
    };

    await expect(authApi.get('/api/protected')).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(requestCount).toBe(2);
    expect(refreshCount).toBe(1);
  });

  it('clears client session when refresh fails', async () => {
    const dispatchEvent = jest.fn();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { dispatchEvent },
    });

    authApi.defaults.adapter = async (config) =>
      unauthorized(config);

    await expect(authApi.get('/api/protected')).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'auth:session-cleared' })
    );
  });

  it('validates profile shape and limits post-login redirects to local paths', () => {
    const safeProfile: SafeUser = {
      id: 'user-1',
      email: 'customer@example.com',
      name: 'Customer',
    };
    expect(isSafeUser(safeProfile)).toBe(true);
    expect(isSafeUser({ id: 'user-1', email: 'not-an-email', name: 7 })).toBe(
      false
    );
    expect(getPostLoginPath('?next=%2Faccount')).toBe('/account');
    expect(getPostLoginPath('?next=%2F%2Fexample.com')).toBe('/account');
    expect(getPostLoginPath('?next=%2F%5C%5Cexample.com')).toBe('/account');
  });
});
