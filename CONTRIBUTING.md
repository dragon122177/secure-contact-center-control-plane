# Contributing

RelayOps welcomes focused pull requests that improve correctness, security, operability, or
documentation.

1. Create a branch from `main`.
2. Copy `.env.example` to `.env` and start the dependencies with Docker Compose.
3. Add tests for behavioral changes.
4. Run `npm run check` before opening a pull request.
5. Explain operational or schema implications in the pull request description.

Database changes must be additive migrations. Never edit a migration that has already shipped.
Security reports should follow [SECURITY.md](SECURITY.md), not a public issue.
