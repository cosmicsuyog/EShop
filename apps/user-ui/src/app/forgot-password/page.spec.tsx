import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ForgotPasswordPage from './page';

jest.mock('next/link', () => {
  const { createElement } = require('react');
  return {
    __esModule: true,
    default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
      createElement('a', { href, ...props }, children),
  };
});

jest.mock('../components/StoreHeader', () => ({
  StoreHeader: () => React.createElement('header', null, 'Store header'),
}));

describe('customer password recovery page', () => {
  it('renders the email request step and sign-in navigation', () => {
    const markup = renderToStaticMarkup(
      React.createElement(ForgotPasswordPage)
    );

    expect(markup).toContain('Forgot your password?');
    expect(markup).toContain('id="reset-email"');
    expect(markup).toContain('Send reset code');
    expect(markup).toContain('href="/login"');
  });
});
