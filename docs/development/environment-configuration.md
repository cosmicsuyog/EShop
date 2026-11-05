# Environment configuration

Use .env.local for local values. Start Nx or Prisma through the scripts in tools/: they read .env.local, validate the database URL, load an allowlist of keys into the child process, and ensure the validated local database URL takes precedence.

.env.example contains placeholders and the isolated MongoDB URL. Never paste real credentials into it or into documentation.

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | MongoDB URL; guarded commands require 127.0.0.1:27018/eshop_development?replicaSet=eshop-dev |
| REDIS_DATABASE_URL | Redis connection used by OTP/session state |
| ACCESS_TOKEN_SECRET | Signs access tokens; use a random local-only value |
| REFRESH_TOKEN_SECRET | Signs refresh tokens; use a distinct random local-only value |
| USER_UI_ORIGIN, SELLER_UI_ORIGIN | Allowed storefront origins for credentialed CORS and origin checks |
| NEXT_PUBLIC_API_GATEWAY_URL | Browser-side API base URL used by both frontends |
| API_GATEWAY_URL | Server-side API base URL used by the customer storefront |
| NEXT_PUBLIC_USER_UI_URL, NEXT_PUBLIC_SELLER_UI_URL | Cross-app links between customer and seller interfaces |
| AUTH_SERVICE_URL, PRODUCT_SERVICE_URL | Gateway upstream service addresses |
| SMTP_HOST, SMTP_PORT, SMTP_SERVICE, SMTP_USER, SMTP_PASS | Mail provider connection and credentials |
| IMAGEKIT_PRIVATE_KEY | Server-side ImageKit credential for product image operations |
| STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET | Stripe test-mode API and webhook verification credentials |
| STRIPE_REFRESH_URL, STRIPE_RETURN_URL | Seller Connect onboarding return destinations |

Default local application ports are listed in the [system overview](../architecture/system-overview.md). Services also honor a process-level PORT; the guarded wrapper does not read arbitrary variables from .env.local.

The repository root .env is tracked. Do not use it for local writes or copy it into .env.local; .gitignore cannot remove a tracked file from Git history. See [authentication and security](../architecture/authentication-and-security.md).
