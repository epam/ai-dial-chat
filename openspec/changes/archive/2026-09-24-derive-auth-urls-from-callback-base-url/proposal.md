## Why

GitHub issue [#9000](https://github.com/epam/ai-dial-chat/issues/9000): `AUTH_POST_LOGOUT_REDIRECT_URI` and `CORS_ORIGIN` must currently be configured as separate environment variables even though, for the standard single-origin deployment, they carry the same value as `AUTH_CALLBACK_BASE_URL`. This is redundant configuration that invites drift (e.g. a deployer updates the callback base URL for a new environment but forgets the other two, and login degrades or CORS starts rejecting the origin). Deriving both from `AUTH_CALLBACK_BASE_URL` by default — while still letting either be set explicitly to override — removes that duplication for the common case without losing flexibility for split-origin deployments.

## What Changes

- `AUTH_POST_LOGOUT_REDIRECT_URI` becomes optional: when unset, it defaults to the value of `AUTH_CALLBACK_BASE_URL` instead of failing application boot once any auth provider is configured. **BREAKING** in the narrow sense that a deployment relying on the current "boot fails if unset" behavior to catch a forgotten variable will no longer fail boot — it now silently gets a usable default instead. Behavior for every deployment that already sets it explicitly is unchanged.
- `CORS_ORIGIN` changes its default: instead of a fixed `http://localhost:4207` (the frontend dev-server port, unrelated to the deployed callback origin), it defaults to `AUTH_CALLBACK_BASE_URL` when unset. **BREAKING** for any deployment that relies on the old hardcoded default and has never set `AUTH_CALLBACK_BASE_URL` to the same value — its allowed CORS origin changes. Any deployment that already sets `CORS_ORIGIN` explicitly is unchanged.
- `apps/chat-api/src/main.ts`'s `app.enableCors(...)` call stops reading `CORS_ORIGIN` from raw `process.env` (which had its own independent hardcoded fallback) and reads it through `ConfigService` instead, so it observes the same validated, defaulted value as the rest of the app (`auth.controller.ts`, `csrf.guard.ts`).
- `.env.template`, `apps/chat-api/README.md`, and the auth/architecture docs are updated to describe the new defaulting behavior instead of showing three independently-required/independently-defaulted values.
- Out of scope: the issue's lower-priority idea of supporting IdP-less deployments is not addressed by this change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `auth-provider-env-config`: the existing requirement "Single app-wide post-logout redirect URI" currently documents `AUTH_POST_LOGOUT_REDIRECT_URI` as required-if-any-provider-is-configured, failing boot when unset. This changes to: default to `AUTH_CALLBACK_BASE_URL` when unset, still overridable, and boot no longer fails for this reason. This also adds a new requirement for `CORS_ORIGIN` defaulting to `AUTH_CALLBACK_BASE_URL`, since `CORS_ORIGIN` is app-wide auth-adjacent configuration read alongside `AUTH_CALLBACK_BASE_URL` and `AUTH_POST_LOGOUT_REDIRECT_URI` throughout `apps/chat-api/src/auth/**` (`auth.controller.ts`'s `isOriginAllowed`, `csrf.guard.ts`) and this spec is the closest existing owner of app-wide auth URL defaulting; no other spec capability currently governs `CORS_ORIGIN`.

## Impact

- Code: `apps/chat-api/src/config/environment.config.ts` (`CORS_ORIGIN`, `AUTH_POST_LOGOUT_REDIRECT_URI` field decorators), `apps/chat-api/src/main.ts` (CORS origin now read via `ConfigService` instead of raw `process.env`).
- No API surface, request/response shape, or `AUTH_{PROVIDER}_*` per-provider variable changes.
- Tests: `apps/chat-api/src/config/tests/validation.spec.ts`, `apps/chat-api/src/auth/providers/provider-registry.service.spec.ts` (existing "missing AUTH_POST_LOGOUT_REDIRECT_URI throws" test needs to change since it is no longer "missing" once `AUTH_CALLBACK_BASE_URL` backfills it), `apps/chat-api/src/auth/auth.controller.spec.ts`, `apps/chat-api/src/auth/tests/auth-metrics.spec.ts`.
- Docs: `apps/chat-api/.env.template`, `apps/chat-api/README.md`, `docs/auth/testing-current-auth-implementation.md`, `docs/architecture.md`, `docs/legacy-chat-migration-guide.md`.
- No i18n impact (backend-only, no user-visible strings).
- No frontend (`apps/chat`) or `libs/*` impact.
