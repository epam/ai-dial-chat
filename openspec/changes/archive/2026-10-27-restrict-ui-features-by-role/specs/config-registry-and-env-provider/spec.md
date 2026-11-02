## ADDED Requirements

### Requirement: Session roles are read through the provider's rolesClaim

The auth domain (`apps/chat-api/src/auth/`) SHALL provide `UserRolesService`, registered in and exported from `AuthModule`. It SHALL be the only place in `apps/chat-api` that turns a `SessionUser` into a list of role names. `UserRolesService.getRoles(user: SessionUser | undefined): string[]` SHALL:

1. Return `[]` for an `undefined` user, or for a user whose `providerId` the `ProviderRegistryService` does not know.
2. Use the provider's `rolesClaim`, or `roles` when the provider has none.
3. Read `user.claims[rolesClaim]` as a flat key first. This is how the OIDC callback (`AuthController.callback`) stores the value. When that key is absent, it SHALL resolve `rolesClaim` as a dot-separated path into `user.claims`. This is how a header-token session (`apps/chat-api/src/auth/strategies/header-token.strategy.ts`) keeps the full verified payload.
4. Convert the value into a list. An array is converted with `map(String)`, preserving the existing `AdminRoleService` coercion, and a string becomes a one-element list. Anything else yields `[]`.

The dot-path resolver that `AuthController` uses today SHALL move to a shared `claims.util.ts` helper in the auth utilities. `AuthController` and `UserRolesService` SHALL both import it, so the two cannot interpret a path differently. `AdminRoleService.isAdmin` SHALL get its roles from `UserRolesService.getRoles`. Its admin rule itself SHALL stay unchanged: the provider's `adminRoles` must intersect the user's roles.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Default dial_roles claim is honored

- **WHEN** the provider's `rolesClaim` is `dial_roles` and a cookie session holds `claims.dial_roles = ["R"]`
- **THEN** `getRoles` returns `["R"]`

#### Scenario: Header-token session with a dotted claim

- **WHEN** the provider's `rolesClaim` is `realm_access.roles` and a header-token session holds `claims.realm_access.roles = ["R"]`
- **THEN** `getRoles` returns `["R"]`

#### Scenario: Flat key wins over the nested path

- **WHEN** `rolesClaim` is `realm_access.roles` and `claims` holds both the flat key `"realm_access.roles": ["A"]` and a nested `realm_access.roles = ["B"]`
- **THEN** `getRoles` returns `["A"]`

#### Scenario: Unknown provider or no session yields no roles

- **WHEN** `getRoles` receives `undefined`, or a user whose `providerId` is not registered
- **THEN** it returns `[]`

#### Scenario: Admin detection shares the lookup

- **WHEN** a provider's `adminRoles` is `["admin"]`, its `rolesClaim` is `realm_access.roles`, and a header-token user holds `realm_access.roles = ["admin"]`
- **THEN** `AdminRoleService.isAdmin` returns `true`

#### Scenario: Existing admin role-array coercion is retained

- **WHEN** the configured claim contains `["R", 7]`
- **THEN** the shared reader returns `["R", "7"]`, as the existing admin helper does

## MODIFIED Requirements

### Requirement: AppConfigEvalContext carries resolution context

The system SHALL define `AppConfigEvalContext` in `apps/chat-api/src/app-config/app-config.types.ts`:

```typescript
interface AppConfigEvalContext {
  appId: string;
  userId?: string;
  roles?: string[];
}
```

`AppConfigController` (`apps/chat-api/src/app-config/app-config.controller.ts`) builds the context from the validated `appId` query parameter and the optional session (`OptionalSessionGuard`). `userId` is the session user's `sub`. `roles` is `UserRolesService.getRoles(sessionUser)` (see "Session roles are read through the provider's rolesClaim"), which honors the provider's `rolesClaim`. It is not taken from a hardcoded `claims['roles']`. With no session, `userId` and `roles` are left unset. The context carries no environment field: no provider reads one, and the controller does not read `process.env`. Context fields MUST NOT be serialized into the client response. Providers receive the full context and MAY ignore user-specific fields. `EnvConfigProvider` reads only `roles`, for definitions that declare `allowedRolesEnvVar`. `AppConfigService` also reads `roles` to compute `catalogCreationPermissions` (see `catalog-creation-role-restrictions`).

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Context is built from appId

- **WHEN** the controller receives `?appId=chat-ui`
- **THEN** an `AppConfigEvalContext` with `appId='chat-ui'` is constructed and passed to `AppConfigService`. When a session is present, the context also carries the session user's `userId` and the roles returned by `UserRolesService.getRoles`

#### Scenario: Roles follow the provider's rolesClaim

- **WHEN** the session's provider has `rolesClaim='dial_roles'`, the session holds `claims.dial_roles = ["R"]`, and `ASR_ENABLED_ROLES=R` is set with an ASR model configured
- **THEN** the context's `roles` is `["R"]` and `features.asrEnabled` is `true` for that user

#### Scenario: Context does not appear in response

- **WHEN** the client-config response is serialized
- **THEN** it MUST NOT contain `userId` or `roles` fields

### Requirement: Client-visible registry keys stay in sync with the client-config mapping

Every `CONFIG_DEFINITIONS` entry with `visibility: 'client'` and `type: 'config'` SHALL
fall into exactly one of two groups. Either it has exactly one entry in the
client-config mapping table, or it is `app.version`, which `AppConfigService` resolves
through its documented special path. Every mapping-table entry SHALL name a key that
exists in `CONFIG_DEFINITIONS` with `visibility: 'client'` and `type: 'config'`. No two
mapping entries SHALL write the same response field. The mapped fields, together with
`appVersion`, `aiTextRefinementAvailable`, and `catalogCreationPermissions`, SHALL cover every
`ClientConfigDto` field. `AppConfigService` computes `catalogCreationPermissions` itself, from
the startup-normalized `CATALOG_CREATION_ROLES` map and the request's roles. It is not
a registry key, because `CATALOG_CREATION_ROLES` is server-only and is never sent to
the browser.

The mapping table is `CLIENT_CONFIG_MAPPINGS` in `apps/chat-api/src/app-config/client-config.mapper.ts`. A unit test in `apps/chat-api/src/app-config/tests/` (`client-config.mapper.spec.ts`) SHALL enforce these properties
against the real `CONFIG_DEFINITIONS`, so a new unmapped client key fails the test
suite during development. `ConfigDefinition.key` SHALL stay typed as `string`, and
`CONFIG_DEFINITIONS` SHALL stay annotated as `ConfigDefinition[]`. This requirement
does not require a type-level rewrite of the registry. Server-visible keys, such as
`utility.modelId`, and `type: 'feature'` keys SHALL have no mapping entry.

This requirement SHALL NOT change the contents or order of `CONFIG_DEFINITIONS`,
provider priority, or provider fallback behavior.

#### Scenario: A new client key without a mapping is caught

- **WHEN** a developer adds a `visibility: 'client'`, `type: 'config'` definition to `CONFIG_DEFINITIONS` without adding a mapping entry
- **THEN** the registry-coverage test fails and names the unmapped key

#### Scenario: A stale mapping is caught

- **WHEN** a mapping entry names a key that is absent from `CONFIG_DEFINITIONS`, or that is server-visible or a feature
- **THEN** the registry-coverage test fails and names the stale key

#### Scenario: Duplicate field ownership is caught

- **WHEN** two mapping entries write the same `ClientConfigDto` field
- **THEN** the registry-coverage test fails and names the field

#### Scenario: app.version is the only unmapped client config key

- **WHEN** the coverage test lists client-visible `type: 'config'` keys without a mapping entry
- **THEN** the only key listed is `app.version`

#### Scenario: Server-only keys stay out of the mapping

- **WHEN** the mapping table is inspected
- **THEN** it has no entry for `utility.modelId` or for any `features.*` key

#### Scenario: catalogCreationPermissions is assembled by the service

- **WHEN** the mapping table and `CONFIG_DEFINITIONS` are inspected
- **THEN** neither contains a `catalogCreationPermissions` entry or a `CATALOG_CREATION_ROLES` key, and the client-config response still carries `config.catalogCreationPermissions`
