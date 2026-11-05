# Feature inventory

This inventory reflects implemented local source and inspected reference scope. It separates local additions and known gaps from reference features.

## Implemented

- Customer registration, OTP verification, login, password recovery, profile lookup, session refresh, and logout.
- Public catalog categories, subcategories, product list/search/pagination, and product detail.
- Customer cart with add, quantity update, item removal, and clear operations.
- Seller registration, verification, login, logout, profile, and shop creation.
- Seller product create/list/soft-delete/restore.
- Seller-owned product image upload/removal through ImageKit.
- Seller-owned discount create/list/delete.
- Seller Stripe Connect onboarding link, account status, dashboard link, and signed webhook endpoint.
- Separate customer and seller Next.js applications.
- API Gateway and five E2E Nx projects.

## Local additions and reference notes

The customer cart exists locally, but is not buyer checkout. The reference shared components package is not present as a separate local package; form controls are implemented in the applications. Product custom specifications beyond the current Prisma model have not been invented.

The reference E2E projects were mostly scaffold-level checks. Local suites exercise HTTP and browser workflows with provider mocks.

## Not implemented

Checkout, customer payment collection, order management, checkout-time discount application, and a general product edit route are absent. See [known limitations](known-limitations.md) and [project validation status](../../PROJECT_COMPLETION.md).
