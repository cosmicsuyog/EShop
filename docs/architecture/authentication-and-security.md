# Authentication and security

This document describes implemented controls visible in the current source. It is not a penetration-test report or production security certification.

## Customer and seller sessions

- Auth Service issues JWT access and refresh tokens in HttpOnly, Secure, SameSite=None cookies.
- Refresh routes rotate the session identifier in Redis; logout removes the active Redis session.
- Customer tokens include a session version. Password reset increments the persisted version so previously issued customer sessions fail validation.
- Seller access tokens are tied to the active Redis refresh session and seller identity.
- Browser clients send cookies with credentialed requests and attempt token refresh after an authenticated request receives 401.

Because cookies use SameSite=None, deployments need a deliberate CSRF strategy. The current code checks the expected storefront Origin for customer refresh/logout and restricts CORS to configured storefront origins, but these checks should not be treated as comprehensive CSRF protection for every mutation.

## Authorization and input checks

- Product Service seller middleware verifies seller token claims and checks the live Redis session.
- Protected product, image, and discount controllers derive seller identity from verified middleware state; request-supplied seller IDs are not the source of authorization.
- Product and discount services validate submitted fields and ownership. Product image upload checks the declared format and file signature, accepts PNG/JPEG/WebP, limits an image to 5 MiB, and caps unattached seller uploads at eight.
- Catalog pagination and search inputs have bounds.
- Stripe webhook events are checked against the configured Stripe signature.

Validation is route-specific; do not infer that every request field across all services is schema-validated.

## Gateway and origins

The gateway and Auth Service allow the configured customer and seller origins with credentials. The gateway configures request rate limiting. Keep backend service ports private in deployed environments and use HTTPS for public traffic.

## Secrets and local setup

Use .env.local for local configuration. It is ignored by Git, and the guarded Prisma/Nx wrappers allowlist configuration and enforce the isolated local MongoDB URL before launching commands. Never put live credentials in .env.example or documentation.

A root .env file is tracked in this repository. Its contents are intentionally not reproduced here. Review repository history and remove/rotate any live credentials through a separate security remediation before public distribution; .gitignore does not untrack an already tracked file.

## Operational review before deployment

Before exposing the services publicly, review CSRF protection for cookie-authenticated mutations, cookie domains and origins, TLS, secret storage/rotation, Redis access, MongoDB network access, webhook configuration, provider error handling, rate limits, monitoring, backups, and incident response. Local test suites are not a deployment security review.

See [known limitations](../project/known-limitations.md) and [environment configuration](../development/environment-configuration.md).
