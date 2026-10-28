## MODIFIED Requirements

### Requirement: FeatureGuard protects routes behind a feature flag

The system SHALL provide `FeatureGuard` in `apps/chat-api/src/app-config/feature-flags/feature.guard.ts` implementing `CanActivate`. When `featureFlagsService.isEnabled(key, context)` returns `false`, the guard MUST throw `ForbiddenException`. When `true`, the guard passes. For an array of feature keys, the guard SHALL preserve its existing OR behavior: allow when any requested key is enabled, otherwise throw `ForbiddenException`.

The guard SHALL build its `AppConfigEvalContext` with `appId: 'chat-ui'`, `userId` set to the request user's `sub`, and `roles` set to `UserRolesService.getRoles(request.user)` (see `config-registry-and-env-provider`). The roles therefore follow the session provider's `rolesClaim`, exactly as client-config does. The guard SHALL NOT keep its own claim-reading helper. Nest instantiates a `@UseGuards(FeatureGuard)` guard in each consumer module's injector, so `AppConfigModule` SHALL re-export `AuthModule` (which exports `UserRolesService`) alongside `FeatureGuard`; every module importing `AppConfigModule` can then resolve the guard's dependencies.

`@RequireFeature(key: FeatureKey | FeatureKey[])` decorator SHALL set metadata consumed by `FeatureGuard` via `Reflector.getAllAndOverride(FEATURE_KEY_METADATA, [handler, class])`, so the decorator works on a handler or on the controller class, and a handler-level `@RequireFeature` overrides the class-level one. `ScheduledTasksController` relies on the class-level form for `FeatureKey.ScheduledTasksEnabled`.

#### Scenario: A class-level RequireFeature gates every handler

- **WHEN** a controller class carries `@UseGuards(FeatureGuard)` and `@RequireFeature(FeatureKey.ScheduledTasksEnabled)`, a handler has no decorator of its own, and the feature is disabled
- **THEN** `FeatureGuard` throws `ForbiddenException` for that handler

Feature guards MUST NOT replace authorization checks. Routes protected by `@RequireFeature` MUST also carry appropriate auth guards. Role checks and feature checks remain separate concerns.

**Authorization:** Guards using `@RequireFeature` apply feature gating only; session/role guards are orthogonal.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Guard allows request when feature is enabled

- **WHEN** `FeatureKey.AsrEnabled` is enabled and a request hits a route decorated with `@RequireFeature(FeatureKey.AsrEnabled)`
- **THEN** the guard returns `true` and the request proceeds

#### Scenario: Guard blocks request when feature is disabled

- **WHEN** `FeatureKey.AsrEnabled` is disabled and a request hits a route decorated with `@RequireFeature(FeatureKey.AsrEnabled)`
- **THEN** the guard throws `ForbiddenException` with status 403

#### Scenario: Missing RequireFeature metadata passes through

- **WHEN** a route has no `@RequireFeature` decorator
- **THEN** `FeatureGuard` returns `true` (no-op when no feature key is set)

#### Scenario: Role-restricted feature honors a non-default rolesClaim

- **WHEN** `SCHEDULED_TASKS_ENABLED=true` and `SCHEDULED_TASKS_ENABLED_ROLES=R` are set, the session provider's `rolesClaim` is `dial_roles`, and the session holds `claims.dial_roles = ["R"]`
- **THEN** a request to a `ScheduledTasksController` route passes `FeatureGuard`

#### Scenario: Same user without the role is still blocked

- **WHEN** the same configuration applies and the session holds `claims.dial_roles = ["other"]`
- **THEN** `FeatureGuard` throws `ForbiddenException`

#### Scenario: Array feature gates retain their existing OR semantics

- **WHEN** a handler requires an array of two feature keys and only the second is enabled for the provider-resolved roles
- **THEN** the guard allows the request
