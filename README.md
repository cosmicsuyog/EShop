# EShop

[![CI](https://github.com/cosmicsuyog/EShop/actions/workflows/ci.yml/badge.svg)](https://github.com/cosmicsuyog/EShop/actions/workflows/ci.yml)
![Nx 20](https://img.shields.io/badge/Nx-20-143055?logo=nx)
![Next.js 15](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)
![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react)
![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![MongoDB](https://img.shields.io/badge/MongoDB-Prisma-47A248?logo=mongodb)

**A multi-vendor storefront workspace with separate customer and seller applications, backed by focused Node.js services.**

EShop is an Nx monorepo containing a customer storefront, a seller workspace, an API Gateway, an authentication service, and a product service. Customers can browse a catalog and manage a cart. Sellers can register, set up a shop, manage products and discount codes, upload product images, and onboard a Stripe Connect account.

The repository is a development project. Checkout, buyer payment collection, and order management are not implemented.

[Architecture](docs/architecture/system-overview.md) · [Setup](docs/development/installation.md) · [API](docs/api/api-overview.md) · [Testing](docs/testing/testing-guide.md) · [Known limitations](docs/project/known-limitations.md)

## Contents

- [Features](#features)
- [Technology](#technology)
- [Architecture](#architecture)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [Applications and ports](#applications-and-ports)
- [API overview](#api-overview)
- [Tests and CI](#tests-and-ci)
- [Security](#security)
- [Screenshots](#screenshots)
- [Limitations](#limitations)
- [Contributing and license](#contributing-and-license)

## Features

- Customer registration, email OTP verification, login, password recovery, and session management.
- Catalog browsing by category and subcategory, product search, pagination, and product detail pages.
- Customer cart with item quantity changes and removal.
- Separate seller registration, verification, login, and dashboard.
- Seller shop setup and product creation, listing, soft deletion, and restoration.
- Seller product image upload and removal through ImageKit.
- Seller discount code creation, listing, and deletion.
- Stripe Connect seller onboarding, account status, and dashboard links.
- API Gateway routing, origin-based CORS, and request rate limiting.
- HttpOnly cookie sessions with Redis-backed refresh rotation and revocation.
- Jest unit/integration suites and five Nx E2E projects covering HTTP and browser workflows.

The cart is a local project feature. It does not submit orders or collect customer payments.

## Technology

| Area | Technologies |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, Axios, React Hook Form |
| Backend | Node.js 20, Express 4, TypeScript |
| Database | MongoDB replica set, Prisma ORM 6 |
| Authentication | JWT access and refresh tokens, HttpOnly cookies, Redis via ioredis |
| Integrations | SMTP through Nodemailer, Stripe Connect, ImageKit |
| Testing | Jest 29, Playwright |
| Monorepo and build | Nx 20, npm, TypeScript, esbuild, Webpack |
| Local infrastructure | MongoDB, Redis, SMTP provider, Stripe test account, ImageKit account |

## Architecture

The customer and seller Next.js apps call the gateway. The gateway sends /product traffic to Product Service and other API traffic to Auth Service. Both backend services use shared Prisma and error-handling libraries. Auth Service also uses Redis, SMTP, and Stripe; Product Service uses ImageKit for seller image operations.

~~~mermaid
flowchart LR
  customer[Customer browser] --> userUI[user-ui :3000]
  seller[Seller browser] --> sellerUI[seller-ui :3001]
  userUI --> gateway[API Gateway :8000]
  sellerUI --> gateway
  gateway -->|/product/*| product[Product Service :6002]
  gateway -->|other API paths| auth[Auth Service :6001]
  auth --> shared[Prisma and shared packages]
  product --> shared
  shared --> mongo[(MongoDB replica set)]
  auth --> redis[(Redis sessions and OTP state)]
  auth --> smtp[SMTP provider]
  auth --> stripe[Stripe Connect]
  product --> imagekit[ImageKit]
  gateway -. tested by .-> gatewayE2E[api-gateway-e2e]
  auth -. tested by .-> authE2E[auth-service-e2e]
  product -. tested by .-> productE2E[product-service-e2e]
  userUI -. tested by .-> userE2E[user-ui-e2e]
  sellerUI -. tested by .-> sellerE2E[seller-ui-e2e]
~~~

See [system overview](docs/architecture/system-overview.md) and [application architecture](docs/architecture/application-architecture.md) for routing and project details.

## Repository layout

~~~text
.
├── apps/
│   ├── api-gateway/             # Express routing, CORS, rate limiting
│   ├── api-gateway-e2e/
│   ├── auth-service/            # Customer/seller auth, cart, shop, Stripe
│   ├── auth-service-e2e/
│   ├── product-service/         # Catalog, seller products, images, discounts
│   ├── product-service-e2e/
│   ├── seller-ui/               # Seller Next.js application
│   ├── seller-ui-e2e/
│   ├── user-ui/                 # Customer Next.js storefront
│   └── user-ui-e2e/
├── Packages/
│   ├── error-handler/
│   ├── libs/{auth,prisma,redis}/
│   └── middleware/
├── prisma/schema.prisma
├── docs/
│   ├── api/
│   ├── architecture/
│   ├── development/
│   ├── deployment/
│   ├── project/
│   └── testing/
├── tools/                       # Local database guarded Nx/Prisma wrappers
├── .github/workflows/ci.yml
├── nx.json
└── package.json
~~~

## Quick start

### Prerequisites

- Windows PowerShell 5.1 or PowerShell 7.
- Node.js 20 and npm.
- MongoDB with replica-set support, running locally on the isolated development port.
- Redis.
- SMTP credentials for registration and password recovery email.
- Stripe test credentials for Connect flows and ImageKit credentials for image uploads.

### Install and configure

From the repository root:

~~~powershell
npm ci --legacy-peer-deps
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
~~~

Edit .env.local with local secrets and provider settings. Do not copy values from the root .env. Detailed setup is in [installation](docs/development/installation.md), [environment configuration](docs/development/environment-configuration.md), and [local services](docs/development/local-services.md).

### Start the isolated database

In a dedicated PowerShell window:

~~~powershell
New-Item -ItemType Directory -Force tmp/eshop-dev-mongodb/data | Out-Null
mongod --dbpath "$PWD/tmp/eshop-dev-mongodb/data" --bind_ip 127.0.0.1 --port 27018 --replSet eshop-dev
~~~

Initialize the replica set once in another window:

~~~powershell
mongosh "mongodb://127.0.0.1:27018/admin?directConnection=true" --eval "rs.initiate({_id:'eshop-dev',members:[{_id:0,host:'127.0.0.1:27018'}]})"
~~~

Wait for the member to become PRIMARY. Do not use the existing MongoDB service on port 27017. Start Redis separately; details are in [local services](docs/development/local-services.md).

### Generate Prisma Client and synchronize the development schema

The guarded wrapper refuses any database URL other than the isolated loopback database:

~~~powershell
./tools/Invoke-LocalPrisma.ps1 validate
./tools/Invoke-LocalPrisma.ps1 generate
./tools/Invoke-LocalPrisma.ps1 db push
~~~

### Run the applications

Open separate terminals for each process:

~~~powershell
./tools/Invoke-LocalNx.ps1 serve auth-service
./tools/Invoke-LocalNx.ps1 serve product-service
./tools/Invoke-LocalNx.ps1 serve api-gateway
./tools/Invoke-LocalNx.ps1 dev user-ui '--port=3000'
./tools/Invoke-LocalNx.ps1 dev seller-ui '--port=3001'
~~~

The wrappers load allowlisted values from .env.local and set the validated local database URL for the child process. Use them for Prisma and Nx commands in this workspace.

## Applications and ports

| Nx project | Local port | Responsibility |
| --- | ---: | --- |
| api-gateway | 8000 | CORS, rate limiting, and upstream routing |
| auth-service | 6001 | Customer/seller auth, cart, shops, Stripe Connect |
| product-service | 6002 | Public catalog and seller product/image/discount APIs |
| user-ui | 3000 | Customer storefront, accounts, recovery, cart |
| seller-ui | 3001 | Seller registration, shop setup, and dashboard |

E2E projects are Nx test targets rather than long-running services; they use the relevant application ports or test-managed server processes.

## API overview

The browser apps call the gateway at http://localhost:8000. Auth endpoints use /api/...; product endpoints use /product/api/....

| Method | Gateway route | Purpose |
| --- | --- | --- |
| GET | /gateway-health | Gateway health response |
| POST | /api/user-registration, /api/verify-registration, /api/login-user | Customer account flow |
| POST | /api/forgot-password-user, /api/verify-forgot-password-user, /api/reset-password-user | Customer password recovery |
| GET, POST, PATCH, DELETE | /api/cart... | Authenticated customer cart |
| POST, GET, DELETE, PUT | /product/api/... | Catalog and seller product/image/discount routes |
| POST, GET | /api/create-stripe-link, /api/stripe-account-status | Seller Stripe Connect |

See [API overview](docs/api/api-overview.md), [authentication API](docs/api/authentication-api.md), [product API](docs/api/product-api.md), and [seller API](docs/api/seller-api.md) for route details. Auth Service also serves Swagger UI at /api-docs on port 6001.

## Tests and CI

Run common checks through the guarded Nx wrapper:

~~~powershell
./tools/Invoke-LocalNx.ps1 test auth-service '--runInBand'
./tools/Invoke-LocalNx.ps1 test product-service '--runInBand'
./tools/Invoke-LocalNx.ps1 test api-gateway '--runInBand'
./tools/Invoke-LocalNx.ps1 test user-ui '--runInBand'
./tools/Invoke-LocalNx.ps1 test seller-ui '--runInBand'
./tools/Invoke-LocalNx.ps1 run-many '--target=lint' '--projects=api-gateway,auth-service,product-service,user-ui,seller-ui' '--parallel=1'
./tools/Invoke-LocalNx.ps1 run-many '--target=build' '--projects=api-gateway,auth-service,product-service,user-ui,seller-ui' '--parallel=1'
~~~

The five E2E projects and their setup are documented in the [testing guide](docs/testing/testing-guide.md) and [E2E guide](docs/testing/e2e-testing.md). Install Chromium for browser tests with:

~~~powershell
npx playwright install chromium
~~~

The GitHub Actions workflow runs affected lint, test, and build targets on pull requests and pushes to master. It does not currently run E2E tests or Prisma/database checks. The CI badge above reflects that workflow; it does not claim that the latest run is passing.

## Security

- Customer and seller tokens are stored in HttpOnly, Secure, SameSite=None cookies.
- Refresh tokens rotate through Redis-backed session records; logout revokes the active session. Customer password reset increments a database session version.
- Seller IDs for protected seller operations come from verified authentication middleware, not request body identity fields.
- The gateway and Auth Service configure credentialed CORS for customer and seller origins. The gateway also applies request rate limiting.
- Product input, discount fields, and image IDs/content have validation; uploaded image content is limited to PNG, JPEG, or WebP and 5 MiB per image.
- Stripe webhook events are verified using the provider signature.

These controls do not replace a deployment security review. In particular, review CSRF protections, cookie/origin behavior, secrets, TLS, rate limits, and provider webhooks before exposing a deployment publicly. See [authentication and security](docs/architecture/authentication-and-security.md).

## Screenshots

No reviewed product screenshots are currently included. To add them, place sanitized captures under docs/assets/screenshots/ and update this section with meaningful alt text. Do not include real customer data, credentials, tokens, or private account details.

## Limitations

- Checkout, buyer payment collection, order management, and applying discount codes during checkout are not implemented.
- The cart is a standalone customer feature.
- Seller product APIs cover create/list/soft-delete/restore; a general product editing route is not present.
- Stripe and ImageKit require external accounts and credentials. Email delivery requires an SMTP provider.
- The repository does not contain a complete deployment stack or a LICENSE file.

See [known limitations](docs/project/known-limitations.md) and [feature inventory](docs/project/feature-inventory.md).

Suggested GitHub description and topics are prepared in [repository metadata](docs/project/github-about.md); they have not been applied.

## Contributing and license

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change. Community expectations are in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and security reports are covered by [SECURITY.md](SECURITY.md).

There is currently no license file. All rights remain with the copyright holder unless and until a license is added; do not assume the code is available for reuse under an open-source license.
