# Security policy

## Reporting a vulnerability

Please do not disclose exploitable vulnerability details in a public issue.

If GitHub private vulnerability reporting is enabled for this repository, submit a report through the repository's Security tab. If it is not enabled, contact the repository owner through the GitHub profile associated with this repository and ask for a private reporting channel. No private security email or response-time commitment is configured here.

Include the affected area, impact, reproduction steps, and any suggested mitigation. Do not include real user data, access tokens, passwords, or production secrets in a report.

## Supported versions

The repository has no published release or supported-version policy. Report issues against the current default branch and identify the commit or revision you tested.

## Credential handling

Use local test credentials and the isolated development database. Do not commit .env.local, provider credentials, or live payment secrets. The repository currently has a tracked root .env file; maintainers should review the repository history and remediate any live credentials separately.
