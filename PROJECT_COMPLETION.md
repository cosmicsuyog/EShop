# EShop reference completion

Last updated: 2026-11-05
Reference: `becodemy/eshop-multivendor-ecommerce-microservice` at `0b93e0d`

## Verified reference inventory

The reference contains ten Nx applications: `api-gateway`, `api-gateway-e2e`, `auth-service`, `auth-service-e2e`, `product-service`, `product-service-e2e`, `seller-ui`, `seller-ui-e2e`, `user-ui`, and `user-ui-e2e`. Its packages are `components`, `database`, `error-handler`, and `middleware`.

Reference functionality includes customer registration/OTP/login/password reset; seller registration/OTP/login, shop creation, Stripe Connect; product category/subcategory and catalog pages; seller product create/list/soft-delete/restore; product image upload/removal; seller discount create/list/delete; and common API/database/middleware/error-handler code. The reference has no customer cart, checkout, buyer payment collection, or order management. Its three API E2E specs are hello-route smoke tests, its two browser E2E specs only check the home page heading, and its hourly product cleanup job fetches old soft-deleted records without deleting them. These scaffolded or ineffective behaviors are not treated as functioning product requirements.

## Starting local state

- Branch `main`, clean at start, HEAD `f16ca7c`.
- Preserved commits: `c7eb1c0` Stripe Connect, `6849298` seller discount management, `f16ca7c` customer password reset and final integration.
- Local apps: API Gateway, Auth Service, Product Service, Auth Service E2E, and `user-ui` (currently misnamed by Nx as `@./user-ui`). The seller experience is embedded under `user-ui`; four reference E2E projects are absent.
- Local adds customer cart and product catalog/detail workflows that are not present in the reference; preserve them.
- Local already has seller shop, product lifecycle, Stripe and discount flows with ownership-scoped backend authorization. Product image upload/removal endpoints are absent locally.
- Local Prisma schema adds cart relations and already declares the product image relation. Root docs are still the generic Nx starter README. Local workspace has no shared components package.
- The isolated `.env.local` points to `127.0.0.1:27018/eshop_development` with replica set `eshop-dev`; never print its value or use root `.env` for writes. The installed MongoDB Windows service is configured for port `27017` and its existing data directory. No MongoDB listener was found on `27018`, and no Redis listener was found on `6379`. Work must start a second, isolated MongoDB process using only a new ignored workspace data directory; do not edit or restart the service on `27017`.
- Reference README is the generated Nx starter, so it provides no useful runbook. Reference requires external email, image-hosting, and Stripe integrations; availability must be verified or reported as needing credentials.

## Completion roadmap

1. **Seller application boundary:** create an independent Nx `seller-ui`, move seller workflows out of customer routes while preserving old entry points as redirects, configure app origin/API integration and route protection, and restore reference product image upload/removal with a provider boundary and safe mocked tests.
2. **E2E coverage:** add all missing E2E Nx projects and make all five exercise useful HTTP/browser boundaries and isolation checks. Use mocks for email, Stripe, and image hosting; no production credentials or real transactions.
3. **Local integrations and hardening:** bring up only the isolated replica set on port 27018, verify `.env.local` through Nx/application runtime and schema indexes, inspect Redis/email behavior, and address verified security gaps such as invalidating customer sessions after password reset.
4. **Developer experience:** replace the starter README with setup/run/test instructions, document secret-free environment keys and ports, and include completion/progress evidence.
5. **Final validation:** Nx project and sync checks; Prisma validation/generation; unit/integration/E2E tests; app builds; lint/type checks; local DB/index checks; `git diff --check`; coherent milestone commits with task-only staging.

## Current milestone

1. **Independent seller UI:** complete. Seller registration/login, dashboard, product list/create/delete/restore, Stripe Connect, discounts, dashboard navigation and logout now run in a separate Nx app. The old storefront seller URLs remain as redirects; `user-ui` keeps its customer routes. The seller app now has a first-class Nx name and build/test/lint targets.
2. **Product images:** next. The reference has authenticated ImageKit upload/removal endpoints and persists uploaded image records with products; the local product flow currently does not expose those operations.
3. **E2E projects, integrations/security, documentation, and final validation:** pending in that order.

## Current-task validation

- `nx build seller-ui`: passed after the dashboard layout and logout were added.
- `nx test seller-ui --runInBand`: 4 suites, 21 tests passed.
- `nx lint seller-ui`: passed.
- `nx build user-ui`: passed after seller routes became redirects.
- `nx test user-ui --runInBand`: 7 suites, 33 tests passed.
- `nx run-many --target=lint --projects=user-ui,seller-ui --parallel=1`: passed; storefront reports three existing warnings, seller app has none.
- `nx sync:check`: passed after `nx sync` added the seller app TypeScript reference.
- Nx reports remote cache upload warnings because this workspace is not connected to Nx Cloud; local task results succeeded.

The seller-UI milestone is ready for its first implementation commit. No commit has been created for this request yet.

## Validation and resume

Previously committed work has its own validation history; current-task checks will be recorded after each milestone and must not be assumed to have passed. Resume by reading this document, checking `git status --short`, and continuing at the current milestone. Never clean/reset the repository, amend previous commits, push, expose secrets, or write to MongoDB Atlas.
