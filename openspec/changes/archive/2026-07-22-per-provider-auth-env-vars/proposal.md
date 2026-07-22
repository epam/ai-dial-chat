## Why

`AUTH_PROVIDERS` currently requires operators to hand-author a JSON array of provider objects (id, issuer, clientId, clientSecret, scope, ...) as a single environment variable. This is error-prone (invalid JSON silently fails validation with a generic error), undocumented per-provider (no fixed set of supported providers, no defaults), and inconsistent with the reference DIAL Chat deployment convention (`apps/chat` README, `AUTH_{PROVIDER_TYPE}_{FIELD_NAME}` pattern, e.g. `AUTH_AUTH0_AUDIENCE`) that operators deploying DIAL are already familiar with. Moving to discrete, per-provider environment variables removes the JSON-authoring burden and lets each supported IdP declare only the fields it needs, with sane defaults (scope, admin roles, roles claim) baked into the code.

## What Changes

- Add discrete per-provider environment variables, one set per supported identity provider, following the `AUTH_{PROVIDER_TYPE}_{FIELD_NAME}` naming convention from the reference `apps/chat` README.
- Remove the legacy single `AUTH_PROVIDERS` JSON-array variable entirely: it is no longer read at boot, and provider registration always comes from the discrete `AUTH_{PROVIDER}_*` variables. (The temporary dual-path from the previous iteration of this change has been superseded by this final removal.)
- Support the same provider set as the reference app: Auth0, Azure AD, Azure B2C, GitLab, Google, Keycloak, PingID, Cognito, Okta.
- Each provider's `id` (used as the OIDC route segment, e.g. `/api/v1/auth/login/auth0`) is a fixed constant in code, never configurable via environment variable.
- Assemble the internal provider configuration array at boot by reading only the environment variables for providers that are actually configured (presence of that provider's required fields), applying provider-specific field defaults (default `scope`, default display `label`) where the reference app defines one.
- Add one new app-wide environment variable for the post-logout redirect target (used for every configured provider), replacing the current per-provider `postLogoutRedirectUri` JSON field.
- Add app-wide `ADMIN_ROLE_NAMES` and `DIAL_ROLES_FIELD` environment variables as fallback defaults, overridable per provider (mirroring the reference app's `AUTH_{PROVIDER}_ADMIN_ROLE_NAMES` / `AUTH_{PROVIDER}_DIAL_ROLES_FIELD`).
- Derive each provider's OIDC issuer URL from that provider's own host/tenant-style variable(s) instead of accepting a raw `issuer` string directly (except where the reference app itself expects a full issuer, e.g. Okta, or an explicit override, e.g. Azure B2C).
- Update `apps/chat-api/README.md` and `docs/environment-variables-migration-guide.md` to document the new variables and the `AUTH_PROVIDERS` → per-provider migration mapping, dropping the legacy-mode precedence callout.

## Capabilities

### New Capabilities

- `auth-provider-env-config`: Backend assembly of the OIDC provider registry from discrete, per-provider environment variables (naming convention, supported provider set, field defaults, issuer derivation, fixed provider ids), replacing the single `AUTH_PROVIDERS` JSON variable.

### Modified Capabilities

(none — no existing spec currently documents `AUTH_PROVIDERS` env-var behavior; `spa-auth-session` only consumes the resulting `/api/v1/auth/providers` HTTP response shape, which is unchanged)

## Impact

- `apps/chat-api/src/config/environment.config.ts`: remove `AUTH_PROVIDERS`; add per-provider env vars and shared `ADMIN_ROLE_NAMES` / `DIAL_ROLES_FIELD` / post-logout redirect vars.
- `apps/chat-api/src/auth/providers/provider.types.ts`: `ProviderConfig` shape stays as the internal representation passed to `openid-client`, but is no longer built directly from parsed JSON.
- `apps/chat-api/src/auth/providers/provider-registry.service.ts`: replace JSON parsing with assembly from the discrete env vars, one builder per supported provider type.
- `apps/chat-api/src/auth/providers/provider-registry.service.spec.ts`: rewrite fixtures to set discrete env vars per provider instead of a JSON blob.
- `apps/chat-api/src/config/validation.spec.ts`, `apps/chat-api/src/config/tests/validation.spec.ts`: update/add coverage for the new env vars.
- `apps/chat-api/README.md`, `docs/environment-variables-migration-guide.md`: documentation updates.
- Deployment configs / `.env` files that currently set `AUTH_PROVIDERS` keep working unchanged for now (legacy path takes precedence); migrating them to the discrete variables is recommended but not required by this change.
