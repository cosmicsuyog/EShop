# Development workflow

Nx coordinates the five applications and five E2E projects. The helper scripts load local configuration and enforce the isolated database URL. Use the wrappers for Prisma and Nx commands.

## Inspect projects and targets

~~~powershell
./tools/Invoke-LocalNx.ps1 show projects
./tools/Invoke-LocalNx.ps1 sync:check
~~~

## Run an application

~~~powershell
./tools/Invoke-LocalNx.ps1 serve auth-service
./tools/Invoke-LocalNx.ps1 serve product-service
./tools/Invoke-LocalNx.ps1 serve api-gateway
./tools/Invoke-LocalNx.ps1 dev user-ui '--port=3000'
./tools/Invoke-LocalNx.ps1 dev seller-ui '--port=3001'
~~~

## Test, build, lint, and typecheck

Quote Nx options so PowerShell passes them as arguments:

~~~powershell
./tools/Invoke-LocalNx.ps1 test auth-service '--runInBand'
./tools/Invoke-LocalNx.ps1 run-many '--target=test' '--projects=auth-service,product-service,api-gateway,user-ui,seller-ui' '--parallel=1'
./tools/Invoke-LocalNx.ps1 run-many '--target=build' '--projects=api-gateway,auth-service,product-service,user-ui,seller-ui' '--parallel=1'
./tools/Invoke-LocalNx.ps1 run-many '--target=lint' '--projects=api-gateway,auth-service,product-service,user-ui,seller-ui' '--parallel=1'
./tools/Invoke-LocalNx.ps1 run-many '--target=typecheck' '--projects=api-gateway,auth-service,product-service,user-ui,seller-ui' '--parallel=1'
~~~

Run E2E targets as described in the [testing guide](../testing/testing-guide.md). Browser suites require Playwright Chromium.

## Prisma changes

Update prisma/schema.prisma, then use the guarded commands:

~~~powershell
./tools/Invoke-LocalPrisma.ps1 validate
./tools/Invoke-LocalPrisma.ps1 generate
./tools/Invoke-LocalPrisma.ps1 db push
~~~

Review schema behavior and tests before committing. MongoDB schema synchronization uses db push; SQL migration commands do not apply.

## Pull requests

Keep changes focused, add or update tests with behavior changes, update relevant documentation, run affected checks, and review git diff --check. Never include .env.local, generated build output, test reports, or real credentials. See [contributing](../../CONTRIBUTING.md).
