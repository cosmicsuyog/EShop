import { authApi } from './authApi';

export type CartProduct = {
  id: string;
  title: string;
  slug: string;
  salePrice: number;
  stock: number;
  images: { url: string }[];
};

export type CustomerCartItem = {
  id: string;
  productId: string;
  quantity: number;
  available: boolean;
  product: CartProduct | null;
  lineSubtotal: number;
};

export type CustomerCart = {
  id: string;
  items: CustomerCartItem[];
  itemCount: number;
  subtotal: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object');

const isCartProduct = (value: unknown): value is CartProduct => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.salePrice === 'number' &&
    Number.isFinite(value.salePrice) &&
    typeof value.stock === 'number' &&
    Number.isSafeInteger(value.stock) &&
    Array.isArray(value.images) &&
    value.images.every(
      (image) => isRecord(image) && typeof image.url === 'string'
    )
  );
};

const isCartItem = (value: unknown): value is CustomerCartItem => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.productId === 'string' &&
    typeof value.quantity === 'number' &&
    Number.isSafeInteger(value.quantity) &&
    value.quantity > 0 &&
    typeof value.available === 'boolean' &&
    (value.product === null || isCartProduct(value.product)) &&
    typeof value.lineSubtotal === 'number' &&
    Number.isFinite(value.lineSubtotal)
  );
};

export const isCustomerCart = (value: unknown): value is CustomerCart =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  Array.isArray(value.items) &&
  value.items.every(isCartItem) &&
  typeof value.itemCount === 'number' &&
  Number.isSafeInteger(value.itemCount) &&
  value.itemCount >= 0 &&
  typeof value.subtotal === 'number' &&
  Number.isFinite(value.subtotal) &&
  value.subtotal >= 0;

const parseCartResponse = (value: unknown) => {
  if (!isRecord(value) || !isCustomerCart(value.cart)) {
    throw new Error('The cart service returned an invalid response.');
  }
  return value.cart;
};

export const fetchCustomerCart = async () => {
  const { data } = await authApi.get<unknown>('/api/cart');
  return parseCartResponse(data);
};

export const addProductToCart = async (productId: string, quantity = 1) => {
  const { data } = await authApi.post<unknown>('/api/cart/items', {
    productId,
    quantity,
  });
  return parseCartResponse(data);
};

export const setCartItemQuantity = async (
  productId: string,
  quantity: number
) => {
  const { data } = await authApi.patch<unknown>(
    `/api/cart/items/${encodeURIComponent(productId)}`,
    { quantity }
  );
  return parseCartResponse(data);
};

export const removeProductFromCart = async (productId: string) => {
  const { data } = await authApi.delete<unknown>(
    `/api/cart/items/${encodeURIComponent(productId)}`
  );
  return parseCartResponse(data);
};

export const clearCustomerCart = async () => {
  const { data } = await authApi.delete<unknown>('/api/cart');
  return parseCartResponse(data);
};
