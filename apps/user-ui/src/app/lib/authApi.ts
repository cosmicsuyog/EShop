import axios from 'axios';

export const authApi = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? 'http://localhost:8000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  return requestedPath?.startsWith('/') && !requestedPath.startsWith('//')
    ? requestedPath
    : '/account';
};
