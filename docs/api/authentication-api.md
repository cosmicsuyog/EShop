# Authentication API

Auth routes are mounted at /api and are reachable through the gateway at http://localhost:8000. Browser clients send credentials with cookies.

## Customer routes

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| POST | /api/user-registration | Public | Request customer registration/OTP |
| POST | /api/verify-registration | Public | Verify registration OTP |
| POST | /api/login-user | Public | Sign in |
| GET | /api/auth/logged-in-user | Customer session | Read current customer profile |
| POST | /api/auth/refresh-token | Refresh cookie and trusted storefront origin | Rotate customer session |
| POST | /api/auth/logout-user | Customer browser/session | Revoke session and clear cookies |
| POST | /api/forgot-password-user | Public | Request recovery OTP |
| POST | /api/verify-forgot-password-user | Public | Verify recovery OTP and establish reset grant |
| POST | /api/reset-password-user | Reset grant | Set a new customer password |

The reset grant is handled by the backend. Do not put reset credentials in URLs, logs, analytics, or client storage.

## Customer cart

| Method | Route | Access |
| --- | --- | --- |
| GET | /api/cart | Customer session |
| POST | /api/cart/items | Customer session |
| PATCH | /api/cart/items/:productId | Customer session |
| DELETE | /api/cart/items/:productId | Customer session |
| DELETE | /api/cart | Customer session |

## Seller account routes

| Method | Route | Access |
| --- | --- | --- |
| POST | /api/seller-registration | Public |
| POST | /api/verify-seller | Public |
| POST | /api/login-seller | Public |
| GET | /api/logged-in-seller | Seller session |
| POST | /api/refresh-seller-token | Seller refresh cookie |
| POST | /api/logout-seller | Seller session/browser |
| POST | /api/create-shop | Seller session |

Stripe Connect routes are documented in [seller API](seller-api.md). Auth Service Swagger UI is available at /api-docs when the service runs on port 6001.
