# E2E testing

The workspace has five E2E projects:

| Project | Boundary exercised |
| --- | --- |
| api-gateway-e2e | Gateway HTTP routing, cookies, customer/seller CORS |
| auth-service-e2e | Customer session rotation/revocation and seller account/shop flows with mocked provider behavior |
| product-service-e2e | Seller product ownership/lifecycle and discount ownership |
| user-ui-e2e | Customer password recovery and cart browser workflows |
| seller-ui-e2e | Seller login and protected dashboard browser behavior |

These tests use HTTP tests or Playwright Chromium. Provider integrations are mocked where appropriate; E2E results do not verify live Stripe, ImageKit, SMTP, or database-provider accounts.

## Run

Install dependencies and ensure .env.local points only to the isolated local database. The Nx wrapper checks the URL before launching tests.

~~~powershell
npx playwright install chromium
./tools/Invoke-LocalNx.ps1 run api-gateway-e2e:e2e '--runInBand'
./tools/Invoke-LocalNx.ps1 run auth-service-e2e:e2e '--runInBand'
./tools/Invoke-LocalNx.ps1 run product-service-e2e:e2e '--runInBand'
./tools/Invoke-LocalNx.ps1 run seller-ui-e2e:e2e
./tools/Invoke-LocalNx.ps1 run user-ui-e2e:e2e
~~~

UI E2E targets build and start their Next.js app through Playwright configuration. Reports are generated under the E2E project and ignored by Git.

See the [testing guide](testing-guide.md) for unit, build, lint, and typecheck commands.
