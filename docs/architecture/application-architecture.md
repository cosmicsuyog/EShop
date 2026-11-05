# Application architecture

The workspace uses Nx to coordinate five runtime applications and five E2E projects.

| Project | Local port | Main responsibility |
| --- | ---: | --- |
| api-gateway | 8000 | Credentialed CORS, rate limiting, health endpoint, Express proxy routes |
| auth-service | 6001 | Customer/seller accounts, OTP verification, sessions, recovery, cart, shops, Stripe Connect |
| product-service | 6002 | Public catalog and authenticated seller product, image, discount operations |
| user-ui | 3000 | Customer catalog, product pages, registration/login, password recovery, cart |
| seller-ui | 3001 | Seller registration/login, shop setup, products, images, discounts, payments |

The E2E projects are api-gateway-e2e, auth-service-e2e, product-service-e2e, seller-ui-e2e, and user-ui-e2e. They run through Nx e2e targets and do not own stable service ports.

## Shared code

Packages/ contains:

- error-handler/: common Express error middleware and error types.
- middleware/: verified seller token/session middleware for protected Product Service routes.
- libs/auth/: seller token claim verification.
- libs/prisma/: shared Prisma Client instance.
- libs/redis/: shared ioredis connection.

Prisma schema and generated client live under prisma/ and generated/prisma/ respectively; generated output is ignored by Git.

## Gateway routing

The gateway defaults to Auth Service at http://localhost:6001 and Product Service at http://localhost:6002. It mounts a proxy under /product and sends other requests to Auth Service. Browser origins default to http://localhost:3000 and http://localhost:3001.

See [system overview](system-overview.md) for the communication diagram and [development workflow](../development/development-workflow.md) for Nx commands.
