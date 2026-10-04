## 1. Sanitize the example

Strategy: one dashboard slice, followed by its documentation and verification. This is
Grafana JSON and documentation only; application Vitest/build targets do not apply.

- [x] 1.1 Add `docs/examples/dashboards/07-bff-red-overview.json` with portable metadata,
      datasource wiring, and corrected measurement boundaries.
      Verification: inspect the full string inventory, compare panel layout, validate every
      variable/reference, and evaluate all expressions with promtool synthetic fixtures.

## 2. Document and verify

- [x] 2.1 Add the RED example and concise scope note to `docs/observability.md`.
      Verification: `npm run validate:docs`, strict OpenSpec validation, Prettier,
      `git diff --check`, and a final privacy scan of new artifacts.
