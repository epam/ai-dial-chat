## 1. Config defaulting

- [x] 1.1 In `apps/chat-api/src/config/environment.config.ts`, remove `CORS_ORIGIN`'s static default (`= 'http://localhost:4207'`) and add a `@Transform(({ obj }) => ...)` that falls back to `obj['AUTH_CALLBACK_BASE_URL']` when `CORS_ORIGIN` is unset/empty, per `design.md` § Decisions.
- [x] 1.2 In the same file, add an equivalent `@Transform(({ obj }) => ...)` to `AUTH_POST_LOGOUT_REDIRECT_URI` falling back to `obj['AUTH_CALLBACK_BASE_URL']`, keeping its existing `@IsOptional() @IsUrl({ require_tld: false })` decorators.
- [x] 1.3 In `apps/chat-api/src/main.ts`, change the `app.enableCors(...)` call (around line 168-178) to read `origin: configService.get('CORS_ORIGIN', { infer: true })` instead of `process.env.CORS_ORIGIN || 'http://localhost:4207'`.

### Verification

- Run `npm run test:file -- apps/chat-api/src/config/tests/validation.spec.ts` (add new cases in 2.1 first, then re-run).

## 2. Config validation tests

- [x] 2.1 In `apps/chat-api/src/config/tests/validation.spec.ts`, add cases covering: `CORS_ORIGIN` unset defaults to `AUTH_CALLBACK_BASE_URL`; `CORS_ORIGIN` explicitly set overrides the default; `AUTH_POST_LOGOUT_REDIRECT_URI` unset defaults to `AUTH_CALLBACK_BASE_URL`; `AUTH_POST_LOGOUT_REDIRECT_URI` explicitly set overrides the default. Follow the existing `baseConfig`/`validate({ ...baseConfig, ... })` fixture pattern already in that file.
- [x] 2.2 In `apps/chat-api/src/config/validation.spec.ts` (the root-level duplicate spec file), check whether it also asserts `CORS_ORIGIN`'s old static default or otherwise conflicts with 2.1; update or remove any now-incorrect assertion there so the two spec files don't disagree. (Checked: this file only tests `ALLOWED_IFRAME_ORIGINS`; no conflicting assertions found, no changes needed.)

### Verification

- Run `npm run test:file -- apps/chat-api/src/config/tests/validation.spec.ts`
- Run `npm run test:file -- apps/chat-api/src/config/validation.spec.ts`

## 3. Provider-registry and controller test updates

- [x] 3.1 In `apps/chat-api/src/auth/providers/provider-registry.service.spec.ts`, updated the `'missing AUTH_POST_LOGOUT_REDIRECT_URI throws on init when a provider is configured'` test: since this spec mocks `ConfigService` directly (bypassing `validate()`), it still exercises `resolvePostLogoutRedirectUri`'s defensive `requireField` guard — renamed to `'missing AUTH_POST_LOGOUT_REDIRECT_URI still throws on init as a defensive invariant'` with a comment explaining why. Added a new test, `'applies the AUTH_CALLBACK_BASE_URL-derived default once already backfilled by validate()'`, covering the realistic case where `ConfigService` already reflects `validate()`'s backfilled value.
- [x] 3.2 Checked `apps/chat-api/src/auth/auth.controller.spec.ts` and `apps/chat-api/src/auth/tests/auth-metrics.spec.ts` fixtures: `auth-metrics.spec.ts` needs no change (both vars set explicitly). Added `'still accepts a callbackUrl on the auth callback base origin when CORS_ORIGIN is unset'` to `auth.controller.spec.ts`, confirming `isOriginAllowed` still allows the `AUTH_CALLBACK_BASE_URL` origin when `CORS_ORIGIN` is unset.

### Verification

- Run `npm run test:file -- apps/chat-api/src/auth/providers/provider-registry.service.spec.ts`
- Run `npm run test:file -- apps/chat-api/src/auth/auth.controller.spec.ts`
- Run `npm run test:file -- apps/chat-api/src/auth/tests/auth-metrics.spec.ts`

## 4. Documentation updates

- [x] 4.1 Update `apps/chat-api/.env.template`: change the `CORS_ORIGIN` and `AUTH_POST_LOGOUT_REDIRECT_URI` lines to be commented out by default (matching the `# AUTH_COOKIE_SECURE=false`-style convention already used in that file for optional vars) with a comment noting they default to `AUTH_CALLBACK_BASE_URL` when unset.
- [x] 4.2 Update `apps/chat-api/README.md`: move `CORS_ORIGIN` and `AUTH_POST_LOGOUT_REDIRECT_URI` out of the plain "Optional, fixed default" framing into a description of the new `AUTH_CALLBACK_BASE_URL` fallback — specifically the "Optional" table (~lines 152-166, currently `CORS_ORIGIN | http://localhost:4207 | ...` and `AUTH_POST_LOGOUT_REDIRECT_URI | — | ... Required if at least one identity provider is configured.`), the example `.env.local` blocks (~lines 68-70, 81), and the "## CORS Configuration" section (~lines 731-745).
- [x] 4.3 Update `docs/auth/testing-current-auth-implementation.md` (lines referencing all three vars, e.g. ~59, 62-63, 71, 73, 129, 153) to reflect that `CORS_ORIGIN`/`AUTH_POST_LOGOUT_REDIRECT_URI` are now optional with an `AUTH_CALLBACK_BASE_URL` fallback.
- [x] 4.4 Update `docs/architecture.md` (~line 654, the `Origin`/`Referer` validated against `CORS_ORIGIN` note) to mention the new default.
- [x] 4.5 Update `docs/legacy-chat-migration-guide.md` (~line 84, "`AUTH_POST_LOGOUT_REDIRECT_URI` ... required once any provider is configured") to describe the default instead of a hard requirement. Also updated the `APP_BASE_ORIGIN`→`CORS_ORIGIN` table row (~line 67) and the "Register `AUTH_POST_LOGOUT_REDIRECT_URI` with the provider" callout (~line 188).
- [x] 4.6 Run `npm run validate:docs` to confirm README/doc consistency checks pass after 4.1-4.5. (Passed: 48 markdown files validated.)

## 5. Full verification

- [x] 5.1 Run `npm run verify:changed` once all slices above are complete. (Passed: typecheck, lint, and test all green.)
- [x] 5.2 Run `npm run verify:full` as the final check before merge. (Ran: `typecheck:full` passed. `lint:check` failed only on a pre-existing, unrelated Prettier error in `libs/chat-hooks/src/skill/tests/useSkillEditorLoad.spec.ts`, introduced by commit `8cf5f5d2c` before this change started. `test:full` failed only on a pre-existing, unrelated `attachment-canvas-consumer-fixture:build` dependency-resolution error for `@tabler/icons-react`. Neither touches a file this change modified; `@epam/chat-api:test` and `@epam/chat:test` both passed, and `npm run verify:changed` was fully green.)
