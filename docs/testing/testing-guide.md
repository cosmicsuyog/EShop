# Testing guide

Nx defines unit/integration tests for the applications and five E2E projects. Run commands through tools/Invoke-LocalNx.ps1; the wrapper enforces the local database target. Install dependencies with npm ci --legacy-peer-deps.

## Unit and integration suites

~~~powershell
./tools/Invoke-LocalNx.ps1 test auth-service '--runInBand'
./tools/Invoke-LocalNx.ps1 test product-service '--runInBand'
./tools/Invoke-LocalNx.ps1 test api-gateway '--runInBand'
./tools/Invoke-LocalNx.ps1 test user-ui '--runInBand'
./tools/Invoke-LocalNx.ps1 test seller-ui '--runInBand'
~~~

Some suites mock Prisma, Redis, SMTP, Stripe, and ImageKit boundaries. A passing unit suite is not evidence that an external provider or local service is reachable.

## Build, lint, and typecheck

~~~powershell
./tools/Invoke-LocalNx.ps1 run-many '--target=build' '--projects=api-gateway,auth-service,product-service,user-ui,seller-ui' '--parallel=1'
./tools/Invoke-LocalNx.ps1 run-many '--target=lint' '--projects=api-gateway,auth-service,product-service,user-ui,seller-ui' '--parallel=1'
./tools/Invoke-LocalNx.ps1 run-many '--target=typecheck' '--projects=api-gateway,auth-service,product-service,user-ui,seller-ui' '--parallel=1'
~~~

## E2E suites

The five projects and commands are in [E2E testing](e2e-testing.md). UI browser suites require Playwright Chromium.

## Current CI boundary

.github/workflows/ci.yml runs Nx affected lint, test, and build on pull requests and pushes to master. The workflow does not run the five E2E projects or Prisma/database checks. Treat CI status separately from local E2E and infrastructure verification.

Historical results and caveats are recorded in [project status](../../PROJECT_COMPLETION.md). Re-run relevant checks after code changes; documentation does not assert that the latest tree has passed them.
