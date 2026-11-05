# Seller API

Seller account, shop, and Stripe Connect routes are served by Auth Service under /api. Seller product, image, and discount routes are served by Product Service under /product/api.

## Shop and Stripe Connect

| Method | Route | Purpose |
| --- | --- | --- |
| POST | /api/create-shop | Create the authenticated seller's shop |
| POST | /api/create-stripe-link | Create a Stripe Connect onboarding link |
| GET | /api/stripe-account-status | Read connected account and onboarding status |
| POST | /api/create-stripe-dashboard-link | Create a Stripe Express dashboard login link |
| POST | /api/stripe-webhook | Receive signed Stripe events |

Shop and account routes require a seller session. The webhook is verified using STRIPE_WEBHOOK_SECRET; configure the provider webhook to reach this route where events are required.

## Product lifecycle

| Method | Route | Purpose |
| --- | --- | --- |
| POST | /product/api/create-product | Create |
| GET | /product/api/get-shop-products | List owned products |
| DELETE | /product/api/delete-product/:productId | Soft-delete |
| PUT | /product/api/restore-product/:productId | Restore |

Product and image authorization derives seller identity from verified middleware state. Seller IDs supplied by a client are not used as the ownership authority.

## Discounts

| Method | Route | Purpose |
| --- | --- | --- |
| POST | /product/api/create-discount-code | Create |
| GET | /product/api/get-discount-codes | List the authenticated seller's codes |
| DELETE | /product/api/delete-discount-code/:id | Delete an owned code |

Discount types are percentage and flat. Percentage values are 1–100; flat values must be at least 1. Titles are limited to 100 characters, codes to 2–30 alphanumeric/underscore/hyphen characters, and each seller can create up to eight codes. Codes are globally unique. There is no update route, and the project does not apply discounts during checkout.

See [authentication API](authentication-api.md) and [product API](product-api.md).
