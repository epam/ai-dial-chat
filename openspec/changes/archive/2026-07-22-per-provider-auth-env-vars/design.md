## Context

`apps/chat-api` currently authenticates via a single `AUTH_PROVIDERS` environment variable holding a JSON array, parsed and validated in `ProviderRegistryService.onModuleInit()` (`apps/chat-api/src/auth/providers/provider-registry.service.ts`) against the `ProviderConfig` class (`apps/chat-api/src/auth/providers/provider.types.ts`: `id`, `issuer`, `clientId`, `clientSecret`, `scope`, `label?`, `audience?`, `rolesClaim?`, `adminRoles?`, `postLogoutRedirectUri`). Each entry is used to run `Issuer.discover(issuer)` and register an `openid-client` `Client`.

The reference DIAL Chat frontend (`apps/chat`, see its README §"Environment Variables for the Configuration of Auth Providers") uses a different, well-known convention: one discrete environment variable per provider field (`AUTH_{PROVIDER_TYPE}_{FIELD_NAME}`, e.g. `AUTH_AUTH0_CLIENT_ID`, `AUTH_AUTH0_HOST`, `AUTH_AUTH0_AUDIENCE`), for a fixed set of supported providers: Auth0, Azure AD, Azure B2C, GitLab, Google, Keycloak, PingID, Cognito, Okta. Operators deploying DIAL are already familiar with this convention. This change ports that convention to `apps/chat-api`'s BFF-style provider registry, replacing the JSON blob.

## Goals / Non-Goals

**Goals:**

- Support the same 9 providers as the reference app, each with its own fixed, hardcoded `id` (route segment for `/api/v1/auth/login/<id>`), never settable via environment variable.
- Build the internal `ProviderConfig[]` used by `ProviderRegistryService` from discrete per-provider environment variables at boot, skipping providers whose variables are entirely absent.
- Reuse the reference app's per-provider default `scope` values and field names (`CLIENT_ID`, `SECRET`/`CLIENT_SECRET`, `HOST`/`TENANT_ID`/`ISSUER`, `NAME`, `SCOPE`, `ADMIN_ROLE_NAMES`, `DIAL_ROLES_FIELD`) so operators can reuse existing `.env` files with minimal changes.
- Add one new app-wide variable for the post-logout redirect target and app-wide fallback `ADMIN_ROLE_NAMES` / `DIAL_ROLES_FIELD`, mirroring the reference app's own app-wide fallbacks.
- Fail boot loudly (same posture as today) if a provider has some but not all of its required fields set.

**Non-Goals:**

- Multiple configurations of the same provider type (indexed `AUTH_AUTH0_1_*`, `AUTH_AUTH0_2_*`, ...). Only a single instance per provider type is supported; the array is simply the subset of the 9 fixed providers that are configured.
- Dual-path backward compatibility with the old `AUTH_PROVIDERS` JSON variable. It is removed outright; deployments must migrate their `.env`/secret configuration.
- Changing how access tokens vs. id tokens are used downstream (`AUTH_IDTOKEN_PROVIDERS` in the reference app has no equivalent here today and stays out of scope — `auth.controller.ts` already reads both `access_token` and `id_token` from the token set independent of provider type).
- Changing the `/api/v1/auth/providers` HTTP response shape consumed by the SPA (`spa-auth-session` spec) — `ProviderRegistryService.listProviders()` keeps returning `{ id, label }[]`.

## Decisions

### 1. Fixed provider ids and a builder-per-provider assembly function

Each provider gets a hardcoded id constant (`auth0`, `azure-ad`, `azure-b2c`, `gitlab`, `google`, `keycloak`, `ping-id`, `cognito`, `okta`) and a small builder function `buildAuth0Config(config): ProviderConfig | undefined`, one per provider, colocated in a new `apps/chat-api/src/auth/providers/provider-builders.ts`. `ProviderRegistryService.onModuleInit()` calls all 9 builders, filters out `undefined` (provider not configured), and keeps the existing `validateSync(ProviderConfig)` pass on each assembled entry as defense-in-depth (catches a builder producing a malformed shape), then proceeds with OIDC discovery exactly as today.

Rejected: encoding provider selection generically (e.g. iterating a `PROVIDER_TYPES` array and reading fields by string-interpolated env var name). Reference: reading `process.env['AUTH_' + type + '_CLIENT_ID']` loses type-safety and defeats `class-validator`'s decorator-based checks on `EnvironmentVariables`. A named field per provider on `EnvironmentVariables`, read by named builder functions, keeps everything typed end-to-end.

### 2. `EnvironmentVariables` gets discrete optional per-provider fields

Every per-provider field (`AUTH_AUTH0_CLIENT_ID`, `AUTH_AUTH0_SECRET`, `AUTH_AUTH0_HOST`, `AUTH_AUTH0_AUDIENCE`, `AUTH_AUTH0_NAME`, `AUTH_AUTH0_SCOPE`, `AUTH_AUTH0_ADMIN_ROLE_NAMES`, `AUTH_AUTH0_DIAL_ROLES_FIELD`, and the equivalents for the other 8 providers) is declared as `@IsOptional() @IsString() FIELD?: string` (comma-separated role-name fields use the existing `ASR_ENABLED_ROLES`-style `@Transform` into `string[]`). None are `@IsNotEmpty()` at the `EnvironmentVariables` level, because "required" here is conditional on the provider being configured at all — that cross-field rule is enforced in `ProviderRegistryService`, not via `class-validator` on the flat env schema (`class-validator` has no clean way to express "B is required only if A is present" across ~70 independent optional string fields without heavy `@ValidateIf` boilerplate per field).

A provider is considered "configured" by its builder when its primary identifying field is present (`CLIENT_ID` for all providers). If `CLIENT_ID` is present but another required field for that provider (`SECRET`/`CLIENT_SECRET`, `HOST`/`TENANT_ID`/`ISSUER`) is missing, the builder throws a descriptive `Error` (`Auth0 is configured (AUTH_AUTH0_CLIENT_ID is set) but AUTH_AUTH0_SECRET is missing`), surfacing at boot the same way today's "AUTH_PROVIDERS is not valid JSON" does.

### 3. Issuer derivation is per-provider, matching the reference app's documented formulas

| Provider  | Issuer source                                                                                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth0     | `https://${AUTH_AUTH0_HOST}/`                                                                                                                                                        |
| Azure AD  | `https://login.microsoftonline.com/${AUTH_AZURE_AD_TENANT_ID}/v2.0`                                                                                                                  |
| Azure B2C | `AUTH_AZURE_B2C_ISSUER` if set, else `https://${TENANT_ID}.b2clogin.com/${TENANT_ID}.onmicrosoft.com/${USER_FLOW}/v2.0` (reference app's own documented fallback formula)            |
| GitLab    | `https://${AUTH_GITLAB_HOST}`                                                                                                                                                        |
| Google    | fixed constant `https://accounts.google.com` (no host var in the reference app; Google's OIDC issuer never varies per tenant)                                                       |
| Keycloak  | `https://${AUTH_KEYCLOAK_HOST}` (host is expected to already include the realm path, e.g. `keycloak.example.com/realms/dial`, matching reference app usage)                          |
| PingID    | `https://${AUTH_PING_ID_HOST}`                                                                                                                                                       |
| Cognito   | `https://${AUTH_COGNITO_HOST}` (host is the full Cognito user-pool issuer host, e.g. `cognito-idp.{region}.amazonaws.com/{userPoolId}`, matching reference app usage)                |
| Okta      | `AUTH_OKTA_ISSUER` directly (Okta is the only provider where the reference app takes a full issuer, not a host)                                                                      |

This mirrors the reference app's own field names 1:1, so an operator migrating a `.env` file changes only the variable prefix semantics (same values, still one URL/id per line), not the values themselves.

### 4. Defaults: scope, label, admin roles, roles claim

- Default `scope` per provider is hardcoded to match the reference app's table (e.g. Auth0/Google/Keycloak `openid email profile offline_access`, Azure AD `openid profile user.Read email offline_access`, Azure B2C `openid profile email offline_access`, GitLab `read_user`, PingID `offline_access`, Cognito/Okta `openid email profile`), used when `AUTH_{PROVIDER}_SCOPE` is not set.
- Default `label` per provider is a hardcoded human-readable display name (`Auth0`, `Azure AD`, `Azure B2C`, `GitLab`, `Google`, `Keycloak`, `PingID`, `Cognito`, `Okta`), used when `AUTH_{PROVIDER}_NAME` is not set. This replaces today's mechanical `id.charAt(0).toUpperCase() + id.slice(1)` fallback in `ProviderRegistryService.listProviders()`, which would otherwise render `Azure-ad` for the `azure-ad` id.
- `adminRoles`: `AUTH_{PROVIDER}_ADMIN_ROLE_NAMES` (comma-separated) if set, else the new app-wide `ADMIN_ROLE_NAMES` (comma-separated, default `admin` — matching the reference app's own app-wide default), else `undefined`. Google has no reference-app override variable, so it always falls back to the app-wide value.
- `rolesClaim`: `AUTH_{PROVIDER}_DIAL_ROLES_FIELD` if set, else the new app-wide `DIAL_ROLES_FIELD` (default `dial_roles`, matching the reference app's own app-wide default).

### 5. Post-logout redirect: one new app-wide variable

Add `AUTH_POST_LOGOUT_REDIRECT_URI` (required if at least one provider is configured) to `EnvironmentVariables`, replacing the current per-entry `postLogoutRedirectUri` JSON field. Every assembled `ProviderConfig.postLogoutRedirectUri` is set to this single value. Rejected: reusing `AUTH_CALLBACK_BASE_URL` (that variable is documented as the API's own OIDC redirect-URI base, a distinct concern from where the browser should land after IdP logout — typically the SPA origin, not the API origin).

### 6. `AUTH_PROVIDERS` removed outright (no dual path)

Final removal, superseding the earlier "temporary dual path" iteration of this design: `AUTH_PROVIDERS` is deleted from `EnvironmentVariables` entirely, and `ProviderRegistryService.onModuleInit()` always calls `buildProviderConfigs(env)` — there is no `JSON.parse(AUTH_PROVIDERS)` branch left anywhere in the service. Operators still running the legacy JSON variable must migrate to the discrete `AUTH_{PROVIDER}_*` variables before upgrading; there is no grace-period fallback. `ProviderConfig`'s existing `@IsNotEmpty()`/`@Matches()` field validators still apply per-entry via the shared `validateSync(providerConfig, …)` call in the single remaining path.

## Risks / Trade-offs

- [Risk] ~70 new near-identical optional string fields make `environment.config.ts` noisier → Mitigation: group them under a clearly commented `// Auth providers` section in file order matching the design table above; the per-provider builder functions (not the flat env schema) hold the actual business logic, keeping each concern in one place.
- [Risk] Operators with an existing `AUTH_PROVIDERS` JSON deployment must migrate before upgrading (breaking change, no grace period) → Mitigation: `docs/environment-variables-migration-guide.md` gets an explicit "migrating from AUTH_PROVIDERS" section mapping every old JSON field to its new env var name, and the change is called out prominently in the PR/release notes.
- [Risk] Host-based issuer derivation (Auth0, GitLab, Keycloak, PingID, Cognito) hardcodes a URL template; a provider whose issuer doesn't fit `https://${HOST}` (or `https://${HOST}/` for Auth0) can't be configured without an escape hatch → Mitigation: match the reference app exactly (same limitation exists there today, so this isn't a regression); Azure B2C and Okta already offer a direct `ISSUER` override for this reason.

## Migration Plan

1. Add the new per-provider and app-wide env vars to `EnvironmentVariables`.
2. Add `provider-builders.ts` with one builder per provider plus the default-scope/default-label constant maps.
3. Rewrite `ProviderRegistryService.onModuleInit()` to call the 9 builders instead of `JSON.parse(AUTH_PROVIDERS)`.
4. Remove `AUTH_PROVIDERS` from `EnvironmentVariables` and delete its parsing path.
5. Update `apps/chat-api/README.md` and `docs/environment-variables-migration-guide.md` (new variables, migration mapping table from old JSON fields).
6. Update `provider-registry.service.spec.ts` fixtures to set discrete env vars.

Rollback: revert the commit(s); there is no data migration involved (env vars only), so rollback is a plain revert plus restoring the previous `.env`/secret values.

## Open Questions

- None outstanding — provider set, naming, issuer derivation, and defaults are pinned to the reference app's documented behavior; single-instance-per-provider and full replacement of `AUTH_PROVIDERS` were confirmed with the requester.
