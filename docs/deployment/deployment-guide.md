# Deployment status and preparation

This repository does not currently provide a complete production deployment configuration. It has a Dockerfile for Auth Service, but no root Compose stack or end-to-end deployment manifests for the gateway, product service, customer UI, seller UI, MongoDB, and Redis. Local development commands are not a production deployment recipe.

Before deployment, select and document hosting for all five runtime apps, configure private service-to-service network paths, provision MongoDB and Redis, and manage SMTP, Stripe, and ImageKit credentials in a secret manager. Set browser origins and gateway upstream URLs to the final HTTPS hostnames.

A deployment review should cover:

- TLS termination, secure cookie behavior, CORS origins, and CSRF protection.
- MongoDB replica-set backups, network access, schema synchronization, and indexes.
- Redis availability and access controls.
- Stripe test/live key separation, webhook endpoint, and signature secret.
- SMTP delivery and ImageKit account configuration.
- Health checks, logs, monitoring, resource limits, and incident response.
- Building and validating each app and running E2E checks against staging.

Do not expose backend service ports directly unless network policy explicitly requires it. No public deployment URL is configured in this repository.
