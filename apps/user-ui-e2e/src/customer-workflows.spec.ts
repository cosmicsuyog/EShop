import { expect, test } from '@playwright/test';

const cartForQuantity = (quantity: number) => ({
  cart: {
    id: 'cart-e2e',
    items: [
      {
        id: 'cart-item-e2e',
        productId: 'product-e2e',
        quantity,
        available: true,
        product: {
          id: 'product-e2e',
          title: 'Everyday Backpack',
          slug: 'everyday-backpack',
          salePrice: 24.5,
          stock: 5,
          images: [],
        },
        lineSubtotal: quantity * 24.5,
      },
    ],
    itemCount: quantity,
    subtotal: quantity * 24.5,
  },
});

const cors = {
  'access-control-allow-origin': 'http://127.0.0.1:3000',
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'Content-Type,Authorization',
};

const handlePreflight = (page: import('@playwright/test').Page) =>
  page.route('**/api/**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: cors });
    }
    return route.fallback();
  });

test('customer can request, verify, and complete a password reset', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute('href', '/forgot-password');
  await page.goto('/forgot-password');
  await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible();

  await page.getByLabel('Email address').fill('invalid-email');
  await page.getByRole('button', { name: 'Send reset code' }).click();
  await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible();

  await page.route('**/api/forgot-password-user', async (route) =>
    route.fulfill({
      status: 200,
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'If an account exists, password reset instructions will be sent.' }),
    })
  );
  await page.route('**/api/verify-forgot-password-user', async (route) =>
    route.fulfill({
      status: 200,
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Code verified.' }),
    })
  );
  await page.route('**/api/reset-password-user', async (route) =>
    route.fulfill({
      status: 200,
      headers: cors,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Password reset successfully.' }),
    })
  );
  await handlePreflight(page);

  await page.getByLabel('Email address').fill('customer@example.test');
  await page.getByRole('button', { name: 'Send reset code' }).click();
  await expect(page.getByText('If an account exists for that address, check your inbox for a six-digit reset code.', { exact: true })).toBeVisible();
  await page.getByLabel('Six-digit code').fill('123456');
  await page.getByRole('button', { name: 'Verify code' }).click();
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
  await page.getByRole('textbox', { name: 'New password', exact: true }).fill('New-password-123');
  await page.getByRole('textbox', { name: 'Confirm new password' }).fill('New-password-123');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('heading', { name: 'You can sign in again' })).toBeVisible();
});

test('customer can adjust their cart quantity and see the updated subtotal', async ({ page }) => {
  let quantity = 1;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      return route.fulfill({ status: 204, headers: cors });
    }
    const url = new URL(request.url());
    if (url.pathname === '/api/auth/logged-in-user') {
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ success: true, user: { id: 'customer-e2e', email: 'customer@example.test', name: 'Customer' } }) });
    }
    if (url.pathname === '/api/cart' && request.method() === 'GET') {
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(cartForQuantity(quantity)) });
    }
    if (url.pathname === '/api/cart/items/product-e2e' && request.method() === 'PATCH') {
      quantity = Number((await request.postDataJSON()).quantity);
      return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(cartForQuantity(quantity)) });
    }
    return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: JSON.stringify({ message: 'Unexpected E2E request.' }) });
  });

  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Shopping cart' })).toBeVisible();
  const quantityControl = page.getByLabel('Quantity for Everyday Backpack');
  await expect(quantityControl.locator('[aria-live="polite"]')).toHaveText('1');
  await page.getByRole('button', { name: 'Increase quantity of Everyday Backpack' }).click();
  await expect(quantityControl.locator('[aria-live="polite"]')).toHaveText('2');
  await expect(page.getByText('Subtotal: 49.00')).toBeVisible();
});
