import { authApi } from './authApi';
import {
  addProductToCart,
  clearCustomerCart,
  fetchCustomerCart,
  isCustomerCart,
  removeProductFromCart,
  setCartItemQuantity,
} from './cartApi';

jest.mock('./authApi', () => ({
  authApi: {
    delete: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
}));

const cart = {
  id: 'cart-id',
  items: [
    {
      id: 'item-id',
      productId: '507f1f77bcf86cd799439011',
      quantity: 2,
      available: true,
      product: {
        id: '507f1f77bcf86cd799439011',
        title: 'Canvas Backpack',
        slug: 'canvas-backpack',
        salePrice: 49.99,
        stock: 12,
        images: [{ url: 'https://images.example.com/backpack.jpg' }],
      },
      lineSubtotal: 99.98,
    },
  ],
  itemCount: 2,
  subtotal: 99.98,
};

const response = () => ({ data: { cart } });

describe('cart API client', () => {
  const get = jest.mocked(authApi.get);
  const post = jest.mocked(authApi.post);
  const patch = jest.mocked(authApi.patch);
  const deleteRequest = jest.mocked(authApi.delete);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and validates the authenticated customer cart', async () => {
    get.mockResolvedValue(response() as never);

    await expect(fetchCustomerCart()).resolves.toEqual(cart);
    expect(get).toHaveBeenCalledWith('/api/cart');
  });

  it('adds a product with the requested quantity', async () => {
    post.mockResolvedValue(response() as never);

    await expect(
      addProductToCart('507f1f77bcf86cd799439011', 2)
    ).resolves.toEqual(cart);
    expect(post).toHaveBeenCalledWith('/api/cart/items', {
      productId: '507f1f77bcf86cd799439011',
      quantity: 2,
    });
  });

  it('updates an item quantity using an encoded product ID', async () => {
    patch.mockResolvedValue(response() as never);

    await expect(setCartItemQuantity('product/id', 3)).resolves.toEqual(cart);
    expect(patch).toHaveBeenCalledWith('/api/cart/items/product%2Fid', {
      quantity: 3,
    });
  });

  it('removes a product from the cart', async () => {
    deleteRequest.mockResolvedValue(response() as never);

    await expect(
      removeProductFromCart('507f1f77bcf86cd799439011')
    ).resolves.toEqual(cart);
    expect(deleteRequest).toHaveBeenCalledWith(
      '/api/cart/items/507f1f77bcf86cd799439011'
    );
  });

  it('clears the authenticated customer cart', async () => {
    deleteRequest.mockResolvedValue(response() as never);

    await expect(clearCustomerCart()).resolves.toEqual(cart);
    expect(deleteRequest).toHaveBeenCalledWith('/api/cart');
  });

  it('rejects malformed cart responses', async () => {
    get.mockResolvedValue({ data: { cart: { id: 'cart-id' } } } as never);

    await expect(fetchCustomerCart()).rejects.toThrow(
      'The cart service returned an invalid response.'
    );
  });

  it('rejects cart data with invalid item quantities', () => {
    expect(
      isCustomerCart({
        ...cart,
        items: [{ ...cart.items[0], quantity: 0 }],
      })
    ).toBe(false);
  });

  it('propagates API request errors', async () => {
    const requestError = new Error('request failed');
    get.mockRejectedValue(requestError);

    await expect(fetchCustomerCart()).rejects.toBe(requestError);
  });
});
