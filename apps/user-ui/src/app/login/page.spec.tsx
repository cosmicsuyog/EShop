import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LoginPage from './page';

jest.mock('next/link', () => {
  const { createElement } = require('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
      createElement('a', { href, ...props }, children),
  };
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn() }),
}));

jest.mock('../components/StoreHeader', () => ({
  StoreHeader: () => React.createElement('header', null, 'Store header'),
}));

describe('customer sign-in page', () => {
  it('links to the customer password recovery flow', () => {
    const markup = renderToStaticMarkup(React.createElement(LoginPage));

    expect(markup).toContain('href="/forgot-password"');
    expect(markup).toContain('Forgot your password?');
  });
});
