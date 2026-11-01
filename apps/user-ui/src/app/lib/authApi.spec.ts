import {
  type AxiosAdapter,
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import {
  authApi,
  getPostLoginPath,
  isSafeUser,
  SafeUser,
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
      ].map((path) => authApi.post(path).catch(() => undefined))
    );

    expect(requestedPaths).toHaveLength(4);
    expect(refreshRequestCount).toBe(1);
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
  });
});
