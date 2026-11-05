# Known limitations

## Product scope

- There is no checkout, buyer payment collection, order lifecycle, or order management.
- Cart contents are stored and editable, but the cart is not converted into a purchase.
- Discount codes can be managed by sellers but are not applied to an order.
- Seller product routes support create/list/soft-delete/restore; a general product edit endpoint is not present.
- The local repository does not include the reference shared React components package as a separate package. UI controls are implemented in app code.
- Product custom specifications not represented by the local Prisma model are not supported.

## Infrastructure and integrations

- Local application startup depends on MongoDB replica-set and Redis availability.
- Registration and password recovery delivery require working SMTP.
- Product image operations require ImageKit credentials.
- Stripe Connect requires Stripe test credentials for development; live provider operations were not used for recorded tests.
- The repository has no complete production deployment stack or public site URL.
- The workflow runs affected lint/test/build on pull requests and master pushes; it does not run E2E or Prisma/database checks.
- Current local Redis availability and latest schema/index synchronization should be verified before treating the environment as ready.

## Security and repository metadata

- Cookie-authenticated mutations need a deployment-specific CSRF review; current CORS/origin checks are not a comprehensive CSRF guarantee.
- The root .env file is tracked. Its contents are intentionally not documented. Review and remediate that file/history and rotate any live credentials before public distribution.
- No LICENSE file exists. Do not assume open-source reuse permissions.
- No public deployment URL or screenshots are configured.

See [authentication and security](../architecture/authentication-and-security.md), [deployment status](../deployment/deployment-guide.md), and [project status](../../PROJECT_COMPLETION.md).
