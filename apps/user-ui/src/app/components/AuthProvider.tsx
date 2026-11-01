'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import axios from 'axios';
import { getApiErrorMessage, getCurrentUser, SafeUser } from '../lib/authApi';
import {
  addProductToCart,
  clearCustomerCart,
  CustomerCart,
  fetchCustomerCart,
  removeProductFromCart,
  setCartItemQuantity,
} from '../lib/cartApi';
import type { CustomerSessionStatus } from '../lib/routeAccess';

type AuthContextValue = {
  user: SafeUser | null;
  status: CustomerSessionStatus;
  error: string | null;
  cart: CustomerCart | null;
  cartLoading: boolean;
  cartError: string | null;
  restoreSession: () => Promise<void>;
  clearSession: () => void;
  refreshCart: () => Promise<void>;
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  updateCartQuantity: (productId: string, quantity: number) => Promise<void>;
  removeCartItem: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [status, setStatus] = useState<CustomerSessionStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CustomerCart | null>(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const restoreGeneration = useRef(0);

  const clearSession = useCallback(() => {
    restoreGeneration.current += 1;
    setUser(null);
    setStatus('unauthenticated');
    setError(null);
    setCart(null);
    setCartLoading(false);
    setCartError(null);
  }, []);

  const refreshCart = useCallback(async () => {
    const generation = restoreGeneration.current;
    setCartLoading(true);
    setCartError(null);

    try {
      const currentCart = await fetchCustomerCart();
      if (generation === restoreGeneration.current) {
        setCart(currentCart);
      }
    } catch (requestError) {
      if (generation === restoreGeneration.current) {
        setCart(null);
        setCartError(
          axios.isAxiosError(requestError) &&
            requestError.response?.status === 401
            ? null
            : getApiErrorMessage(requestError)
        );
      }
    } finally {
      if (generation === restoreGeneration.current) {
        setCartLoading(false);
      }
    }
  }, []);

  const runCartMutation = useCallback(
    async (mutation: () => Promise<CustomerCart>) => {
      const generation = restoreGeneration.current;
      setCartError(null);
      try {
        const updatedCart = await mutation();
        if (generation === restoreGeneration.current) {
          setCart(updatedCart);
        }
      } catch (requestError) {
        if (generation === restoreGeneration.current) {
          setCartError(getApiErrorMessage(requestError));
        }
        throw requestError;
      }
    },
    []
  );

  const addToCart = useCallback(
    (productId: string, quantity = 1) =>
      runCartMutation(() => addProductToCart(productId, quantity)),
    [runCartMutation]
  );

  const updateCartQuantity = useCallback(
    (productId: string, quantity: number) =>
      runCartMutation(() => setCartItemQuantity(productId, quantity)),
    [runCartMutation]
  );

  const removeCartItem = useCallback(
    (productId: string) =>
      runCartMutation(() => removeProductFromCart(productId)),
    [runCartMutation]
  );

  const clearCart = useCallback(
    () => runCartMutation(clearCustomerCart),
    [runCartMutation]
  );

  const restoreSession = useCallback(async () => {
    const generation = ++restoreGeneration.current;
    setUser(null);
    setStatus('loading');
    setError(null);
    setCart(null);
    setCartLoading(false);
    setCartError(null);

    try {
      const profile = await getCurrentUser();
      if (generation !== restoreGeneration.current) {
        return;
      }

      setUser(profile);
      setStatus('authenticated');
      await refreshCart();
    } catch (requestError) {
      if (generation !== restoreGeneration.current) {
        return;
      }

      setUser(null);
      setStatus('unauthenticated');
      setCart(null);
      setCartLoading(false);
      setCartError(null);
      setError(
        axios.isAxiosError(requestError) &&
          requestError.response?.status === 401
          ? null
          : 'Your session could not be checked. Please try again.'
      );
    }
  }, [refreshCart]);

  useEffect(() => {
    void restoreSession();

    const handleSessionChanged = () => {
      void restoreSession();
    };
    const handleSessionCleared = () => clearSession();

    window.addEventListener('auth:session-changed', handleSessionChanged);
    window.addEventListener('auth:session-cleared', handleSessionCleared);
    return () => {
      window.removeEventListener('auth:session-changed', handleSessionChanged);
      window.removeEventListener('auth:session-cleared', handleSessionCleared);
    };
  }, [clearSession, restoreSession]);

  const value = useMemo(
    () => ({
      user,
      status,
      error,
      cart,
      cartLoading,
      cartError,
      restoreSession,
      clearSession,
      refreshCart,
      addToCart,
      updateCartQuantity,
      removeCartItem,
      clearCart,
    }),
    [
      user,
      status,
      error,
      cart,
      cartLoading,
      cartError,
      restoreSession,
      clearSession,
      refreshCart,
      addToCart,
      updateCartQuantity,
      removeCartItem,
      clearCart,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
