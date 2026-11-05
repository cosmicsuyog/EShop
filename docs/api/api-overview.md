# API overview

The browser apps use the API Gateway at http://localhost:8000 by default.

- GET /gateway-health is served by the gateway.
- /product/... is proxied to Product Service. Product routes are mounted at /api, so catalog and seller routes begin /product/api/....
- Other paths are proxied to Auth Service. Customer, seller, and cart routes begin /api/....
- Auth Service also serves Swagger UI at http://localhost:6001/api-docs and generated JSON at /docs-json.

Browser requests use credentialed cookies. Authenticated operations require the relevant customer or seller session. Product routes described as seller-only require verified seller middleware.

See [authentication](authentication-api.md), [product](product-api.md), and [seller](seller-api.md) route tables. Gateway routing is described in the [system overview](../architecture/system-overview.md).
