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

- **WHEN** the controller receives `?appId=ai-dial-chat`
- **THEN** an `AppConfigEvalContext` with `appId='ai-dial-chat'` is constructed and passed to `AppConfigService`. When a session is present, the context also carries the session user's `userId` and the roles returned by `UserRolesService.getRoles`

#### Scenario: Roles follow the provider's rolesClaim

- **WHEN** the session's provider has `rolesClaim='dial_roles'`, the session holds `claims.dial_roles = ["R"]`, and `ASR_ENABLED_ROLES=R` is set with an ASR model configured
- **THEN** the context's `roles` is `["R"]` and `features.asrEnabled` is `true` for that user

#### Scenario: Context does not appear in response

- **WHEN** the client-config response is serialized
- **THEN** it MUST NOT contain `userId` or `roles` fields

#### Scenario: Caller cannot inject a managed view

- **WHEN** a caller passes a context with its own `managed` member to `AppConfigService.isEnabled`
- **THEN** the service replaces it with its own capture before resolution
