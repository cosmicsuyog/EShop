import { expect, test } from '@playwright/test';

test('seller login validates input and reports authentication failures', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Seller sign in' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup');

  await page.getByLabel('Email address').fill('not-an-email');
  await page.getByLabel('Password').fill('sample-password');
  await page.getByRole('button', { name: 'Sign in as seller' }).click();
  await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible();

  await page.route('**/api/login-seller', async (route) =>
    route.fulfill({
      status: 401,
      headers: {
        'access-control-allow-origin': 'http://127.0.0.1:3001',
        'access-control-allow-credentials': 'true',
      },
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Invalid email or password.' }),
    })
  );
  await page.getByLabel('Email address').fill('seller@example.test');
  await page.getByRole('button', { name: 'Sign in as seller' }).click();
  await expect(page.getByText('Invalid email or password.', { exact: true })).toBeVisible();
});

test('an unauthenticated seller cannot open the dashboard', async ({ page }) => {
  await page.route('**/api/logged-in-seller', async (route) =>
    route.fulfill({
      status: 401,
      headers: {
        'access-control-allow-origin': 'http://127.0.0.1:3001',
        'access-control-allow-credentials': 'true',
      },
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Seller access token is required.' }),
    })
  );
  await page.route('**/api/refresh-seller-token', async (route) =>
    route.fulfill({
      status: 401,
      headers: {
        'access-control-allow-origin': 'http://127.0.0.1:3001',
        'access-control-allow-credentials': 'true',
      },
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Seller refresh token is required.' }),
    })
  );

  await page.goto('/dashboard');
  await expect(page.getByText('Sign in to open your seller workspace.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Seller sign in' })).toHaveAttribute('href', '/login');
});
