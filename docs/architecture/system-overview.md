# System overview

EShop separates customer and seller experiences into independent Next.js applications. Both use the API Gateway, which routes requests to focused Express services. The services share the Prisma client, Redis connection, authentication helpers, seller middleware, and error handling under Packages/.

~~~mermaid
flowchart LR
  customer[Customer browser] --> userUI[user-ui :3000]
  seller[Seller browser] --> sellerUI[seller-ui :3001]
  userUI --> gateway[API Gateway :8000]
  sellerUI --> gateway
  gateway -->|/product/*| product[Product Service :6002]
  gateway -->|other API requests| auth[Auth Service :6001]
  auth --> shared[Shared packages]
  product --> shared
  shared --> mongo[(MongoDB replica set)]
  auth --> redis[(Redis)]
  auth --> smtp[SMTP provider]
  auth --> stripe[Stripe Connect]
  product --> imagekit[ImageKit]
~~~

## Request flow

- Customer and seller clients send credentialed requests to the gateway.
- Gateway routes /product/... to Product Service. The product application mounts its router at /api, so public catalog routes use /product/api/products, /product/api/categories, and related paths.
- Other API paths are forwarded to Auth Service. Authentication and cart routes are mounted under /api.
- Auth Service uses Prisma with MongoDB for accounts, shops, product references, discount codes, carts, and images. Redis supports OTP, reset, and session state.
- Product Service uses ImageKit for seller image uploads and deletions. Stripe Connect is handled by Auth Service.

## Boundaries

The gateway is the browser-facing API entry point. Backend services also expose their own default ports for local development; those direct ports should not be exposed publicly without an appropriate network and security configuration.

The five E2E projects exercise service HTTP boundaries and customer/seller browser flows. They are test targets, not runtime services.

See [application architecture](application-architecture.md), [database design](database-design.md), and the [API overview](../api/api-overview.md).
