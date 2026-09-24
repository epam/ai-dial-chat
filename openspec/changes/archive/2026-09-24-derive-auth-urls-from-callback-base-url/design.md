## Context

`apps/chat-api/src/config/environment.config.ts` defines `EnvironmentVariables`, validated once at boot by `apps/chat-api/src/config/validation.ts#validate()` via `plainToInstance` + `validateSync`. Three related fields:

- `AUTH_CALLBACK_BASE_URL` (`environment.config.ts:188-190`) — `@IsNotEmpty() @IsUrl({ require_tld: false })`, required, no default.
- `AUTH_POST_LOGOUT_REDIRECT_URI` (`environment.config.ts:192-194`) — `@IsOptional() @IsUrl({ require_tld: false })`, no default. `apps/chat-api/src/auth/providers/provider-builders.ts:75-80` (`resolvePostLogoutRedirectUri`) calls `requireField('A provider', 'AUTH_POST_LOGOUT_REDIRECT_URI', env.AUTH_POST_LOGOUT_REDIRECT_URI)`, which throws during provider assembly (i.e. application boot) whenever it is unset and any `AUTH_{PROVIDER}_CLIENT_ID` is configured.
- `CORS_ORIGIN` (`environment.config.ts:80-82`) — `@IsOptional() @IsString()`, with a static class-property default of `'http://localhost:4207'` (the frontend dev-server port). Consumed via `ConfigService.get('CORS_ORIGIN', { infer: true })` in `auth.controller.ts` (`isOriginAllowed`, login, callback) and `csrf.guard.ts`, but read a *second*, independent way in `apps/chat-api/src/main.ts:170` — `process.env.CORS_ORIGIN || 'http://localhost:4207'` — bypassing `ConfigService`/`EnvironmentVariables` entirely for the actual `app.enableCors(...)` call.

Per issue #9000, both `AUTH_POST_LOGOUT_REDIRECT_URI` and `CORS_ORIGIN` should default to `AUTH_CALLBACK_BASE_URL` when not explicitly set, while remaining independently overridable.

## Goals / Non-Goals

**Goals:**

- `AUTH_POST_LOGOUT_REDIRECT_URI`, when unset, resolves to the value of `AUTH_CALLBACK_BASE_URL`.
- `CORS_ORIGIN`, when unset, resolves to the value of `AUTH_CALLBACK_BASE_URL` (replacing today's unrelated `http://localhost:4207` static default).
- Either variable, when explicitly set (including to an empty-equivalent override use case is out of scope — `@IsOptional`/`@IsUrl`/`@IsString` semantics are unchanged), continues to take its own explicit value.
- Exactly one code path reads and validates each of these variables; `main.ts`'s CORS setup stops reading `CORS_ORIGIN` from raw `process.env`.
- `AUTH_CALLBACK_BASE_URL` remains required and validated first, since both defaults derive from it.

**Non-Goals:**

- Supporting deployments without an IdP configured at all (mentioned in the issue as lower priority) — not addressed here.
- Changing how per-provider `AUTH_{PROVIDER}_*` variables are validated or defaulted.
- Changing the `postLogoutRedirectUri` propagation from `EnvironmentVariables` into each `ProviderConfig` (still one value applied to every provider, per the existing `auth-provider-env-config` requirement) — only where that value comes from when unset.

## Decisions

### Where the default is applied: backfill the raw config object in `validate()`, not a class-level `@Transform`

The initial design considered a `@Transform(({ obj }) => ...)` on each field reading `obj.AUTH_CALLBACK_BASE_URL` directly, mirroring the `{ obj, key }` idiom already used in this file for `AUTH_COOKIE_SECURE` (`environment.config.ts:178-186`) and `AUTH_LEGACY_COOKIE_NAMES` (`:167-176`). **This does not work and was disproven while implementing it**: `class-transformer` only invokes a property's `@Transform` callback when that property's key is present in the source plain object; for a key entirely absent from `process.env`/the config record (the common case this change targets — an operator who never sets `CORS_ORIGIN` at all), the transform never runs, and the field falls back to its static class-property initializer instead (which cannot reference a sibling field's value). This was caught immediately by a failing test (`config.CORS_ORIGIN` came back `undefined` instead of the `AUTH_CALLBACK_BASE_URL` fixture value) and is why `AUTH_COOKIE_SECURE`'s own default is carried by its static `= true` initializer, not its `@Transform`, even though it has both.

**Chosen approach**: `apps/chat-api/src/config/validation.ts#validate()` backfills the raw config object before calling `plainToInstance`, via a small helper applied to both keys:

```ts
const withCallbackBaseUrlFallback = (
  config: Record<string, unknown>,
  key: string,
): Record<string, unknown> => {
  const raw = config[key];
  if (raw != null && raw !== '') return config;
  return { ...config, [key]: config['AUTH_CALLBACK_BASE_URL'] };
};

export const validate = (rawConfig: Record<string, unknown>) => {
  const config = withCallbackBaseUrlFallback(
    withCallbackBaseUrlFallback(rawConfig, 'CORS_ORIGIN'),
    'AUTH_POST_LOGOUT_REDIRECT_URI',
  );
  const validatedConfig = plainToInstance(EnvironmentVariables, config, { ... });
  // ...single validateSync pass over the backfilled config, unchanged otherwise
```

Because the backfill happens on the plain object before `plainToInstance` runs, the derived value for `AUTH_POST_LOGOUT_REDIRECT_URI` is validated by its own `@IsUrl({ require_tld: false })` decorator in the same, single `validateSync` pass as everything else — no second validation pass is needed, and `AUTH_CALLBACK_BASE_URL` itself is validated by its own decorators in that same pass too (a malformed value fails via its own `@IsNotEmpty`/`@IsUrl` error, independent of whichever field(s) it was copied into). `CORS_ORIGIN`'s static default (`= 'http://localhost:4207'`) and `AUTH_POST_LOGOUT_REDIRECT_URI`'s decorators are otherwise unchanged.

**Alternative (the original plan, rejected after failing in practice):** a `@Transform` on each field. Rejected because it silently does not apply when the env var is entirely unset, which is precisely the primary case this change exists to handle.

### `resolvePostLogoutRedirectUri` / `requireField` in `provider-builders.ts` stay unchanged

Once `AUTH_POST_LOGOUT_REDIRECT_URI` is always backfilled from the now-mandatory `AUTH_CALLBACK_BASE_URL`, `env.AUTH_POST_LOGOUT_REDIRECT_URI` can no longer be empty by the time `resolvePostLogoutRedirectUri` runs, so its `requireField` throw becomes unreachable in practice. It is left in place as a defensive invariant check (consistent with every other `requireField` call in that file) rather than removed, since removing it would require also changing the field's type from `string | undefined` to `string`, which is a larger, purely stylistic refactor with no behavioral benefit.

### `main.ts` reads `CORS_ORIGIN` via `ConfigService`

`main.ts:169-171` changes from `process.env.CORS_ORIGIN || 'http://localhost:4207'` to `configService.get('CORS_ORIGIN', { infer: true })`. `configService` is already constructed and in scope in `main.ts` (used a few lines later for `CSP_MODE`, `CSP_REPORT_URI`, etc.), so this is a one-line change that makes CORS setup observe the same validated/defaulted value as `auth.controller.ts` and `csrf.guard.ts`, instead of a second, independently-defaulted read of the raw environment.

## Risks / Trade-offs

- **[Risk]** A deployment that today relies on the boot-time failure for a forgotten `AUTH_POST_LOGOUT_REDIRECT_URI` to catch a misconfiguration will no longer fail boot — it silently gets `AUTH_CALLBACK_BASE_URL` instead. → **Mitigation**: this is the explicitly requested behavior (issue #9000); for a standard single-origin deployment the derived value is correct. Call out the behavior change prominently in `apps/chat-api/README.md` and `.env.template` so operators know overriding is still available and expected for split-origin deployments.
- **[Risk]** A deployment that today relies on `CORS_ORIGIN`'s old hardcoded `http://localhost:4207` default (i.e. never set `CORS_ORIGIN` and never intended it to match `AUTH_CALLBACK_BASE_URL`) will see its effective CORS origin change. → **Mitigation**: `http://localhost:4207` was already documented as the frontend dev-server default and is very unlikely to be an intentional production value; any production deployment should already be setting `CORS_ORIGIN` explicitly. Document the new default clearly and treat this as the intended fix for the drift the issue describes.
- **[Trade-off]** Reading `obj.AUTH_CALLBACK_BASE_URL` inside another field's `@Transform` couples the two fields' validation order implicitly (the derived value is validated by the derived field's own decorators, e.g. `@IsUrl` on `AUTH_POST_LOGOUT_REDIRECT_URI`, but a malformed `AUTH_CALLBACK_BASE_URL` will be independently caught by its own `@IsNotEmpty`/`@IsUrl` decorators too — both fields report separately in the same `validateSync` pass, which is acceptable and arguably clearer than a single combined error).

## Migration Plan

No data migration. This is a boot-time config-validation behavior change with no schema or persisted-state impact. Rollout is a normal deploy; rollback is a normal revert. Deployments that want to preserve today's exact values simply set `AUTH_POST_LOGOUT_REDIRECT_URI` and `CORS_ORIGIN` explicitly (as most production deployments already do).

## Open Questions

None — the defaulting mechanism, its scope, and the doc-update surface are all resolved above.
