# EShop implementation and validation status

Last reviewed: 2026-11-05

Reference: becodemy/eshop-multivendor-ecommerce-microservice, revision 0b93e0d

This file records implementation and validation evidence. It is not a claim that the project is production-ready or that every check currently passes.

## Workspace and feature scope

The reference has ten Nx projects: api-gateway, api-gateway-e2e, auth-service, auth-service-e2e, product-service, product-service-e2e, seller-ui, seller-ui-e2e, user-ui, and user-ui-e2e. All ten project names are present locally.

The reference packages include components, database, error-handler, and middleware. Locally, Prisma, Redis, authentication helpers, seller middleware, and error handling are under Packages/. The reference components package is not present as a separate package; controls are implemented in the apps.

Implemented features include:

- Customer registration, OTP verification, login, password recovery, and session handling.
- Catalog browsing and product details.
- Customer cart (a local addition; not checkout).
- Seller registration, OTP verification, login, and shop creation.
- Seller product create/list/soft-delete/restore and product image upload/removal.
- Seller discount create/list/delete.
- Stripe Connect seller onboarding and status links.
- Separate customer and seller Next.js apps.
- Five E2E projects for HTTP and browser boundaries.

The reference does not implement checkout, buyer payment collection, or order management. A general product edit route and checkout-time discount application are also absent locally. See the [feature inventory](docs/project/feature-inventory.md) and [known limitations](docs/project/known-limitations.md).

## Documentation and repository cleanup

The root README now introduces the actual architecture, feature scope, local setup, ports, API groups, testing, security boundaries, screenshots plan, and limitations. Detailed guides are organized under docs/ for architecture, development, APIs, testing, deployment boundaries, feature inventory, limitations, and prepared GitHub About metadata.

Contributor, security, and conduct guidance plus GitHub issue and pull-request templates are present. The GitHub About description/topics are documented for manual entry; no GitHub settings were changed.

No .dots directory or .dots references were found. Two tracked Playwright last-run result files were removed and report output patterns are ignored. No license file was present or added.

## Feature commits

- c7eb1c0 — Stripe Connect seller onboarding.
- 6849298 — seller discount management.
- f16ca7c — customer password recovery and integration.
- f4ac035 — separate seller UI.
- 48a91fa — broad integration including product images, session revocation/rotation, gateway origins, and E2E projects.

At the last Git inspection, HEAD was 48a91fa on main and also appeared as origin/main. This documentation pass does not change application source.

## Last recorded validation

These outcomes were recorded during earlier implementation work. They are historical results, not a current green status; relevant checks need to be rerun after later source changes.

- API Gateway E2E: 3 passed (cookie forwarding, product routing, customer/seller CORS).
- Auth Service E2E: 2 passed (customer session rotation/revocation; seller registration, shop creation, mocked Stripe link, identity forgery rejection, logout revocation).
- Product Service E2E: 2 passed (seller product lifecycle/ownership; discount isolation/deletion).
- Seller UI Chromium E2E: 2 passed (login validation/error and protected dashboard).
- User UI Chromium E2E: 2 passed (password recovery and cart quantity/subtotal).
- Auth unit/integration: 82 passed before the latest seller access-token Redis-session middleware change; rerun required.
- Product unit suite: a prior run passed before the latest seller Redis-session middleware change; rerun required.
- Product Service build passed after Node Fetch API type support was added. Auth Service, API Gateway, and both UI builds passed as E2E prerequisites.
- Prisma Client generation passed after sessionVersion was added. Validation and database push passed earlier for the image schema; rerun validation/generation/schema sync and index inspection for the latest schema.
- Nx sync, latest lint, full unit test/typecheck/build, MongoDB PRIMARY/index state, and application-level database verification remain to be rechecked.

The GitHub Actions workflow runs affected lint, test, and build for pull requests and pushes to master. It does not run E2E or Prisma/database checks.

## Local infrastructure observations

- The isolated MongoDB TCP port 27018 was listening at the last environment check. Replica-set PRIMARY and current Prisma indexes were not reverified after the sessionVersion schema change.
- Redis at 127.0.0.1:6379 was not listening at the last environment check.
- SMTP and live Stripe/ImageKit accounts were not verified. Provider tests use mocks.
- The local database wrapper accepts only 127.0.0.1:27018, database eshop_development, replica set eshop-dev. Use it for local Nx and Prisma commands.

## Security findings

- The root .env file is tracked. Its contents are intentionally not included here. Review the repository history and remove/rotate any live credentials separately before public distribution; do not use it for database writes.
- .env.local is ignored by Git and must not be committed.
- Cookie-authenticated mutations need a deployment-specific CSRF review. Current CORS and selected origin checks are not a comprehensive CSRF guarantee.
- No live payment transaction or provider credentials were used in recorded tests.
- The repository has no LICENSE file. No license is added by the documentation work.

## Resume checks

1. Confirm MongoDB replica set eshop-dev reaches PRIMARY on 127.0.0.1:27018 and start isolated local Redis.
2. Run guarded Prisma validate, generate, and db push, then verify required indexes.
3. Rerun Auth and Product unit suites after seller session middleware changes.
4. Run all five E2E projects, affected builds, lint, typecheck, and Nx sync checks.
5. Verify SMTP/provider configuration only with safe test credentials.
6. Review the Git diff and keep root .env and .env.local out of staging.
