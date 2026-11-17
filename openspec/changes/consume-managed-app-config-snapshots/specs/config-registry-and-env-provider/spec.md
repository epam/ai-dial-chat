## MODIFIED Requirements

### Requirement: AppConfigEvalContext carries resolution context

The system SHALL define `AppConfigEvalContext` in `apps/chat-api/src/app-config/app-config.types.ts`:

```typescript
interface AppConfigEvalContext {
  appId: string;
  userId?: string;
  roles?: string[];
  /** Set only by AppConfigService: the managed snapshot captured for this evaluation. */
  managed?: ManagedResolutionView;
}
```

`AppConfigController` (`apps/chat-api/src/app-config/app-config.controller.ts`) builds the context from the validated `appId` query parameter and the optional session (`OptionalSessionGuard`). `userId` is the session user's `sub`. `roles` is `UserRolesService.getRoles(sessionUser)` (see "Session roles are read through the provider's rolesClaim"), which honors the provider's `rolesClaim`. It is not taken from a hardcoded `claims['roles']`. With no session, `userId` and `roles` are left unset. The context carries no environment field: no provider reads one, and the controller does not read `process.env`. Context fields MUST NOT be serialized into the client response. `managed` SHALL be set only by `AppConfigService`, once per evaluation, and any value supplied by a caller SHALL be replaced. It holds the mapped instance, the captured state, the captured snapshot when it is usable, and the evaluation instant. Providers receive the full context and MAY ignore user-specific fields. `AppConfigService` reads `roles` for the deployment role gate of definitions that declare `allowedRolesEnvVar` (see "Deployment role gates apply after value selection"), and to compute `catalogCreationPermissions` (see `catalog-creation-role-restrictions`).

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

#### Scenario: Caller cannot inject a managed view

- **WHEN** a caller passes a context with its own `managed` member to `AppConfigService.isEnabled`
- **THEN** the service replaces it with its own capture before resolution

### Requirement: Deployment role gates apply after value selection

The allowed-roles restriction of a feature (`allowedRolesEnvVar`) SHALL be applied once, after a value has been selected from the provider chain, for every resolution path of `AppConfigService` (`getClientConfig`, `isEnabled`, `resolveValue`). When the allowed-roles variable is non-empty and the caller has none of the listed roles, the effective value SHALL be `false`. When it is empty, including its typed default `[]` when the variable is absent, the selected value SHALL be returned unchanged. The gate SHALL be conjunctive: no provider can bypass it by returning `true`. For a feature listed in `MANAGED_CONFIG_ACTIVE_KEYS`, the deployment role gate SHALL be one of the conjunctive gates defined by `managed-config-activation` and SHALL still apply. For every combination of environment and roles supported today, effective feature values SHALL equal the values produced when the gate lived inside `EnvConfigProvider`.

**Feature flag:** Applies to `features.asrEnabled` (`ASR_ENABLED_ROLES`), `features.liveChatInteraction` (`LIVE_CHAT_INTERACTION_ENABLED_ROLES`), `features.scheduledTasksEnabled` (`SCHEDULED_TASKS_ENABLED_ROLES`) and `features.projectsEnabled` (`PROJECTS_ENABLED_ROLES`). **RTL impact:** None. **i18n impact:** None. **Cache:** As defined by `client-config-endpoint` ("GET /api/v1/client-config returns client-safe configuration").

#### Scenario: Restricted user is gated off

- **WHEN** `SCHEDULED_TASKS_ENABLED=true` and `SCHEDULED_TASKS_ENABLED_ROLES=beta` and the caller has roles `['staff']`
- **THEN** `isEnabled('features.scheduledTasksEnabled')` returns `false` and the client-config `features.scheduledTasksEnabled` is `false`

#### Scenario: Allowed user keeps the selected value

- **WHEN** the same environment applies and the caller has roles `['beta']`
- **THEN** both results are `true`

#### Scenario: Anonymous caller with a role restriction

- **WHEN** a role restriction is configured and the request has no session
- **THEN** the effective value is `false`

#### Scenario: No restriction configured

- **WHEN** `SCHEDULED_TASKS_ENABLED_ROLES` is absent
- **THEN** the selected value is returned for every caller

#### Scenario: Managed policy cannot bypass the deployment role gate

- **WHEN** `SCHEDULED_TASKS_ENABLED_ROLES=beta` and a managed policy would enable the feature for a caller with roles `['staff']`
- **THEN** the effective value is `false`

## ADDED Requirements

### Requirement: Managed source sits between explicit environment and the registry default

`CompositeConfigProvider` SHALL resolve in this order: `EnvConfigProvider`, a managed provider, then `StaticDefaultsProvider`. The managed provider SHALL return a value only when all of the following hold:

- `MANAGED_CONFIG_MODE` is `active`;
- the key is listed in `MANAGED_CONFIG_ACTIVE_KEYS`;
- the context's captured `managed` view is usable;
- the captured payload has a member for the key.

The value it returns SHALL be the member's value for a configuration key, or the member's `enabled` for a feature. Otherwise it SHALL return `undefined`. It SHALL NOT read the environment, call Core, or use any snapshot other than the captured one. Because `EnvConfigProvider` returns a value only for an explicitly present variable, the selected value is explicit environment → managed → registry default. The existing per-provider error handling SHALL apply: a managed provider error falls through to the registry default and is logged without values. Feature policy beyond the enabled bit is applied after selection (`managed-config-activation`).

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Managed value is selected when the environment is silent

- **WHEN** `usageLimits.warningThresholdPercent` is active, its variable is not explicit, and the captured fresh payload sets `80`
- **THEN** `CompositeConfigProvider.resolve` returns `80`

#### Scenario: Typed default does not shadow the managed value

- **WHEN** a feature variable holds only its typed class default and the captured payload sets `enabled: true`
- **THEN** the selected enabled bit is `true`

#### Scenario: Managed provider is silent outside active mode

- **WHEN** the mode is `shadow`
- **THEN** the managed provider returns `undefined` for every key
