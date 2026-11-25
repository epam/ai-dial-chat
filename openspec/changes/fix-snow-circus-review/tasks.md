# Tasks

Risk-first: validate safe geometry and selection, then synchronize native bounds, then browser regression and docs. Preserve host isolation and extensionless TS imports.

- [x] 1. Add optional pre-ranking eligibility in `libs/celebrations/src/utils/borrow-targets.ts` and bounded contact validation in `button-props-adapter.ts`. Verification: `npm run test:file -- libs/celebrations/src/utils/tests/button-props-adapter.spec.ts libs/celebrations/src/utils/tests/cat-borrow-adapter.spec.ts`.
- [x] 2. Add native bounds and matching publication validation in the Themes working copy; refresh unpublished 1.5.0 assets, inventory, hashes and Chat fixtures. Verification: Themes publication/source checks, focused checker tests, and `npm run test:file -- libs/celebrations/src/stories/tests/snow-circus-fixtures.spec.ts`.
- [x] 3. Exercise mobile edge return, original browser matrix/RTL/reduced motion, source envelope and selection regression; verify cleanup, unchanged source art and no host integration in shared code. Verification: `npm exec -- nx run @epam/ai-dial-celebrations:test-snow-circus-browser`, recorded targeted geometry probes, scoped lint/typecheck. Existing full-workspace failure evidence from the original change remains applicable; avoid repeating unrelated failing targets without cause.
- [x] 4. Correct `docs/architecture.md`, shared/authoring READMEs and record verification. Verification: `npm run validate:docs`, `npm run validate:specs`, strict OpenSpec validation and `git diff --check`.

- [x] 5. Replace the locally cached unpublished 1.5.0 candidate with 1.5.1, update catalog/default and local delivery revision, and verify old-manifest-to-new-version recovery in the browser. Retain published 1.2.0–1.4.0 unchanged.
