# Contributing

Thanks for taking an interest in EShop. Contributions should describe a focused change and include enough context for a maintainer to review it.

## Before opening a pull request

1. Check the existing issues and pull requests for related work.
2. Keep the change aligned with functionality present in the project or clearly describe the proposed addition.
3. Add or update tests when application behavior changes.
4. Update the relevant documentation when commands, routes, configuration, or behavior change.
5. Run the checks relevant to the changed projects. Start with the [testing guide](docs/testing/testing-guide.md).
6. Review the final diff for generated artifacts, environment files, credentials, and unrelated changes.

Use the local wrappers for Prisma and Nx commands. They verify that database commands target the isolated local MongoDB instance. Never use production credentials or live payment transactions for tests.

## Pull request description

Include:

- The behavior changed and why.
- Any related issue.
- Tests and checks run, with failures or limitations stated accurately.
- Documentation or configuration changes.

There is no contribution license grant or project license in this repository. Do not assume a license has been granted.
