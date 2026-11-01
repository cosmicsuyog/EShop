import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CartPage from './page';
import { ProductPurchaseActions } from '../components/ProductPurchaseActions';
import { StoreHeader } from '../components/StoreHeader';
import { useAuth } from '../components/AuthProvider';
import type { CustomerCart } from '../lib/cartApi';

jest.mock('next/link', () => {
  const { createElement } = require('react');
  return {
    __esModule: true,
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children: React.ReactNode;
      [key: string]: unknown;
    }) => createElement('a', { href, ...props }, children),
  };
});

jest.mock('next/image', () => {
  const { createElement } = require('react');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      const imageProps = { ...props };
      delete imageProps.fill;
      delete imageProps.priority;
      delete imageProps.sizes;
      delete imageProps.unoptimized;
      return createElement('img', imageProps);
    },
  };
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

jest.mock('../components/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

const authenticatedUser = {
  id: 'user-id',
  email: 'customer@example.com',
  name: 'Customer',
};

const cart: CustomerCart = {
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

const mockUseAuth = jest.mocked(useAuth);
const authState = {
  user: authenticatedUser,
  status: 'authenticated' as const,
  error: null,
  cart,
  cartLoading: false,
  cartError: null,
  restoreSession: jest.fn(),
  clearSession: jest.fn(),
  refreshCart: jest.fn(),
  addToCart: jest.fn(),
  updateCartQuantity: jest.fn(),
  removeCartItem: jest.fn(),
  clearCart: jest.fn(),
};

const render = (element: React.ReactElement) => renderToStaticMarkup(element);

describe('shopping cart storefront', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue(authState);
  });

  it('renders cart products, quantities, line subtotals, and cart subtotal', () => {
    const markup = render(React.createElement(CartPage));

    expect(markup).toContain('Canvas Backpack');
    expect(markup).toContain('Quantity for Canvas Backpack');
    expect(markup).toContain('Subtotal: 99.98');
    expect(markup).toContain('aria-label="Cart, 2 items"');
  });

  it('renders the empty-cart state', () => {
    mockUseAuth.mockReturnValue({
      ...authState,
      cart: { ...cart, items: [], itemCount: 0, subtotal: 0 },
    });

    const markup = render(React.createElement(CartPage));

    expect(markup).toContain('Your cart is waiting for something good.');
    expect(markup).toContain('Continue shopping');
  });

  it('keeps unavailable items removable without quantity controls', () => {
    mockUseAuth.mockReturnValue({
      ...authState,
      cart: {
        ...cart,
        items: [
          {
            ...cart.items[0],
            available: false,
            product: null,
            lineSubtotal: 0,
          },
        ],
      },
    });

    const markup = render(React.createElement(CartPage));

    expect(markup).toContain('Product no longer available');
    expect(markup).toContain('Currently unavailable');
    expect(markup).toContain('>Remove</button>');
    expect(markup).not.toContain('Quantity for');
  });

  it('shows cart loading and API error states', () => {
    mockUseAuth.mockReturnValue({
      ...authState,
      cart: null,
      cartLoading: true,
    });
    expect(render(React.createElement(CartPage))).toContain(
      'Loading your cart…'
    );

    mockUseAuth.mockReturnValue({
      ...authState,
      cart: null,
      cartError: 'Cart unavailable.',
    });
    expect(render(React.createElement(CartPage))).toContain(
      'Cart unavailable.'
    );
  });

  it('shows a sign-in prompt instead of an add action for guests', () => {
    mockUseAuth.mockReturnValue({
      ...authState,
      user: null,
      status: 'unauthenticated',
    });

    const markup = render(
      React.createElement(ProductPurchaseActions, {
        productId: cart.items[0].productId,
        productSlug: 'canvas-backpack',
        stock: 12,
      })
    );

    expect(markup).toContain('Sign in to add to cart');
    expect(markup).toContain('/login?next=%2Fproducts%2Fcanvas-backpack');
    expect(markup).not.toContain('Add to cart');
  });

  it('shows the cart count in the storefront header', () => {
    const markup = render(React.createElement(StoreHeader));

    expect(markup).toContain('aria-label="Cart, 2 items"');
    expect(markup).toContain('>Cart <span class="cart-count">2</span>');
  });
});
