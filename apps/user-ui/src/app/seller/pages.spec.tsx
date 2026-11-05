import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SellerLoginPage from './login/page';
import SellerRegisterPage from './register/page';
import SellerProductsPage from './products/page';
import NewSellerProductPage from './products/new/page';

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

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

jest.mock('../components/StoreHeader', () => ({
  StoreHeader: () => React.createElement('header', null, 'Store header'),
}));

describe('seller onboarding pages', () => {
  it('renders the seller login form with accessible email and password labels', () => {
    const markup = renderToStaticMarkup(React.createElement(SellerLoginPage));

    expect(markup).toContain('Seller sign in');
    expect(markup).toContain('for="seller-login-email"');
    expect(markup).toContain('for="seller-login-password"');
    expect(markup).toContain('Sign in as seller');
    expect(markup).toContain('href="/seller/register"');
  });

  it('shows a session-checking state before the authenticated shop setup', () => {
    const markup = renderToStaticMarkup(
      React.createElement(SellerRegisterPage)
    );

    expect(markup).toContain('Seller onboarding');
    expect(markup).toContain('Checking seller session');
    expect(markup).toContain('aria-label="Seller setup progress"');
  });

  it('renders the product management loading state', () => {
    const markup = renderToStaticMarkup(
      React.createElement(SellerProductsPage)
    );

    expect(markup).toContain('Your products');
    expect(markup).toContain('Checking seller session and loading products');
  });

  it('renders the product creation page with a seller session check', () => {
    const markup = renderToStaticMarkup(
      React.createElement(NewSellerProductPage)
    );

    expect(markup).toContain('Add a product');
    expect(markup).toContain('Checking seller session');
  });
});
