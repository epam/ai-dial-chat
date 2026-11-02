## ADDED Requirements

### Requirement: Catalog creation policy is validated independently of UI flags

`EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts` SHALL declare optional, server-only `CATALOG_CREATION_ROLES`. It SHALL accept a JSON object with optional `types` and `schemas` objects. An absent or blank variable SHALL resolve to empty maps. `types` SHALL accept only `custom-app`, `schema-app`, `toolset`, `prompt`, and `skill`, representing creation categories, not UI-feature names or catalog item ids. `schemas` SHALL map full application schema ids to role arrays.

```json
{
  "types": { "schema-app": ["authors"], "custom-app": ["developers"], "skill": ["trainers"] },
  "schemas": { "https://example.test/schemas/runner-A": ["team-A", "admins"] }
}
```

The value and its maps MUST be plain objects. Every rule value MUST be a string array. Invalid JSON, null/primitive/array values, unknown top-level fields, unknown type keys, and blank schema keys SHALL fail boot through the existing environment validator. A fixed error message SHALL identify `CATALOG_CREATION_ROLES` and its expected shape without exposing raw input, role names, or parser errors. Validate types before normalizing roles; malformed entries MUST NOT be silently dropped.

Configured role entries SHALL be trimmed, blanks removed, and duplicates removed in first-occurrence order. A missing or empty rule SHALL impose no restriction; an explicitly empty normalized list SHALL produce one startup warning without role names. Normalize once on `AppConfigService` construction, not per request. Schema ids SHALL be preserved and matched exactly, case-sensitively, with no name/suffix matching, URL decoding, trimming, or aliases. Nonblank ids not currently returned by Core SHALL remain configured; boot SHALL NOT query Core to validate schema membership.

Neither legacy `ENABLED_FEATURES_ROLES` nor `ENABLED_UI_FEATURES_ROLES` SHALL be read. `ENABLED_UI_FEATURES` validation, aliases, defaulting, and effective values SHALL remain unchanged.

**State ownership:** validated policy in backend configuration, normalized policy on `AppConfigService`. **Feature flag:** independent policy; no new UI toggle. **i18n / RTL:** none at this layer. **Observability:** startup validation/empty-rule warnings only, no policy values or new telemetry.

#### Scenario: Missing policy is unrestricted
- **WHEN** the variable is absent, blank, or `{}`
- **THEN** every type and schema passes this policy

#### Scenario: Invalid structure fails boot without disclosing roles
- **WHEN** the value is malformed JSON, an array, or `{"types":{"skill":"secret-role"}}`
- **THEN** boot fails with the fixed expected-shape message and neither the raw value nor `secret-role` appears in it

#### Scenario: Unknown type is rejected
- **WHEN** `types` contains `skills` instead of `skill`, or `schema-apps` instead of `schema-app`
- **THEN** environment validation fails instead of silently leaving creation unrestricted

#### Scenario: Empty rule remains unrestricted
- **WHEN** `types.skill` is `["  "]`
- **THEN** skill creation is unrestricted and one feature/type-only warning is logged at startup, never repeated by requests

#### Scenario: Schema identity is opaque
- **WHEN** a rule names `https://example.test/schemas/Runner-A` and the available list contains that id plus `https://example.test/schemas/runner-a`
- **THEN** the rule applies only to the first id, regardless of the schemas' display names

#### Scenario: A temporarily absent schema retains its rule
- **WHEN** an exactly configured schema id is absent at startup and appears later
- **THEN** its configured role restriction applies when it appears without requiring policy normalization again

### Requirement: Type and schema permissions compose without granting other operations

`AppConfigService.getClientConfig` SHALL evaluate the normalized policy using `AppConfigEvalContext.roles`. No session or an unknown provider means no roles. A nonempty rule passes if any listed role exactly matches a user role. There SHALL be no implicit administrator bypass. A schema-app creation SHALL require both the `schema-app` type rule and the rule for the exact selected schema; a missing rule at either level passes. Schema-less custom apps, toolsets, prompts, and skills SHALL use their respective type rule only.

The resolved object SHALL contain `allowedTypes`, in fixed order `custom-app`, `schema-app`, `toolset`, `prompt`, `skill`, and `restrictedSchemaIds`, in policy key order, each id at most once. Schema denials SHALL be computed independently of broad type denial, without requiring the schema list. The result SHALL never contain role names or raw rule maps.

**Cache:** use the existing encoded app/user/sorted-role client-config cache key and 60-second TTL. TTL expiry or process restart clears the cached result; changing the boot-loaded policy requires restart. **Authorization:** this result controls client creation workflows only; entity mutation endpoint authorization remains unchanged.

#### Scenario: A schema-specific rule preserves other schemas
- **WHEN** only schema A requires `team-A` and the user lacks it
- **THEN** `schema-app` is in `allowedTypes`, `restrictedSchemaIds` contains A, and schema B remains permitted by this policy

#### Scenario: Type and schema rules both apply
- **WHEN** the type requires `authors`, schema A requires `team-A`, and the user holds only one of these roles
- **THEN** the client denies creation of A

#### Scenario: Any listed role satisfies one rule
- **WHEN** the type rule passes, schema A permits `["team-A", "admins"]`, and the user holds `admins`
- **THEN** creation of A passes this policy

#### Scenario: Anonymous users follow configured rules
- **WHEN** an anonymous user requests config and only `types.prompt` has a nonempty rule
- **THEN** `prompt` is absent from `allowedTypes`, while the other four types remain present

#### Scenario: An administrator has no implicit exception
- **WHEN** a user is an administrator but holds no role listed in a configured skill rule
- **THEN** `skill` is absent from `allowedTypes`

#### Scenario: Results are separated by user and role set
- **WHEN** requests with different user ids or role sets arrive within the cache TTL
- **THEN** each receives its own evaluated creation permissions

### Requirement: Creation permissions leave the global feature set and existing entities unchanged

The policy SHALL NOT filter `config.enabledUiFeatures`, `DEFAULT_ENABLED_UI_FEATURES`, `UiFeaturesContext`, deployment/schema lists, `useCatalogItems` output, or item editability. Browsing, searching, using in chat, editing, deleting, sharing, and publishing existing entities SHALL retain their existing permission and feature checks. Creation permission SHALL be an additional condition on existing create affordances, never an instruction to enable a disabled global flag.

Overlay and isolated-view overrides SHALL retain their global feature replacement semantics. They SHALL NOT override the separate creation policy. The same creation checks SHALL apply in embedded and normal views whenever those views expose a create flow.

#### Scenario: Custom app creation is denied while editing is preserved
- **WHEN** `custom-apps` is globally enabled, a user may edit an existing custom app, and `custom-app` creation is denied
- **THEN** its catalog item, use action, Edit button, and edit route keep their prior behavior, but the create entry is absent

#### Scenario: Prompt, toolset, and skill creation do not hide existing items
- **WHEN** those types are denied for creation and their existing visibility/use checks pass
- **THEN** their catalog tabs/items and use/edit actions remain available under the same existing rules

#### Scenario: A schema restriction does not remove the schema from edit resolution
- **WHEN** creation by schema A is denied and the user may edit an existing A application
- **THEN** A remains in the shared schema collection and its editor opens as before

#### Scenario: Global feature values are identical across roles
- **WHEN** two users with different creation permissions load the same global UI configuration
- **THEN** `enabledUiFeatures` and the effective global UI-feature set are identical for equal overrides, including the null/default baseline case

#### Scenario: An overlay override cannot grant creation
- **WHEN** a host enables `custom-apps` but the resolved creation policy denies `custom-app`
- **THEN** `useUiFeature(CustomApps)` remains true, existing editing stays governed by that flag, and creation remains denied

### Requirement: Creation decisions belong to the existing app config and an app-owned hook

`AppConfigContext` in `apps/chat/src/context/AppConfigContext.tsx` SHALL own `catalogCreationPermissions` and client-only `catalogCreationStatus` using the existing `UserConfigStatus` enum. This dedicated readiness status SHALL track the existing config request without changing the established loading semantics of unrelated config consumers. A new app-owned `useCatalogCreationPermissions` hook SHALL derive stable type/schema decisions from that state; no new context or network request SHALL be introduced. The initial permission state SHALL be unknown, not unrestricted.

While client config is loading, refetching, invalidated by an authentication transition, or failed, creation SHALL be unavailable. Old permissions MUST NOT authorize a different session or survive a failed refetch as usable create permissions. Bind accepted permission results to `(providerId, sub)` from `UserContext` and refetch when that identity changes, including authenticated-to-authenticated switches with an unchanged status. A result for another identity MUST be unusable immediately, before the refetch effect runs. Retain the existing response-cancellation mechanism. A successful older-backend response that omits the entire permission field SHALL resolve to all five types allowed and no restricted schemas. A present malformed permission object SHALL mark creation unavailable and SHALL NOT trigger that permissive compatibility fallback or discard unrelated valid config values.

**Memoization:** memoize type/schema sets and returned values, and use stable callbacks that update when readiness or permissions change. **Library boundary:** `CatalogView` passes only resolved booleans and a schema predicate into `useCatalogEditNavigation`; no role/env/client-config knowledge enters the library.

#### Scenario: Initial load does not flash create controls
- **WHEN** client config has not completed
- **THEN** catalog browsing can render but no creation action is offered

#### Scenario: A failed config request cannot grant creation
- **WHEN** initial loading or a later refetch fails
- **THEN** creation remains unavailable and no stale permission result authorizes it

#### Scenario: Successful old-backend response preserves compatibility
- **WHEN** a successful config response has no `catalogCreationPermissions` field
- **THEN** all five types and all schemas pass the new policy, subject to existing feature checks

#### Scenario: New session does not reuse old permissions
- **WHEN** the authenticated identity changes while auth status stays authenticated, or authentication changes and config is being reloaded
- **THEN** creation is unavailable until the new session's response is accepted, and an obsolete response cannot restore the previous session's permissions

### Requirement: Direct editor routes enforce creation permissions without blocking editing

The app SHALL apply the same type/schema decision before mounting create-mode bodies and before dispatching create operations from `apps/chat/src/pages/ApplicationEditor/ApplicationEditorPage.tsx`, `apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`, `apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx`, `apps/chat/src/pages/PromptEditor/PromptEditor.tsx`, and `apps/chat/src/pages/SkillEditor/SkillEditor.tsx`.

Use each editor's existing identity parameter and mode rules, including `appId` for schema applications and the existing id parameters for other editors. Edit mode SHALL bypass only the new creation gate and keep all existing authentication, ownership, validation, feature checks, and failed-edit-load behavior. A failed edit load MUST NOT fall through into creation. A metadata-first application SHALL check creation before its first POST and then continue in edit mode once persisted.

For schema creation, resolve the exact selected id from the existing runner schemas. Missing, unavailable, or non-runner ids MUST NOT open a create form, and no alternative schema SHALL be substituted. Schema-loading state SHALL remain pending. Both embedded-editor and schema-form kinds SHALL follow the same type/schema policy.

**UI / i18n:** an app-owned `RequireCatalogCreation` boundary SHALL show `catalog.creation.loading` while pending, `catalog.creation.unavailable` on config/schema resolution failure, or `catalog.creation.denied` for a denied rule, with an existing translated back-to-catalog action. It SHALL keep create form effects and submissions unmounted/blocked. **Accessibility:** pending uses a polite status region; failure/denial uses an alert; the back action is keyboard-accessible. **RTL:** logical spacing and mirrored directional icons; support mobile and desktop without adding a new breakpoint.

#### Scenario: Direct schema URL is denied
- **WHEN** the user opens `/apps-editor?schema=A` without an app id and lacks permission for A
- **THEN** the denied state appears and no application create request is sent

#### Scenario: Type-specific direct creation is denied
- **WHEN** a denied type's custom-app, toolset, prompt, or skill editor is opened in create mode
- **THEN** no create form can submit and the denied state is shown

#### Scenario: Existing item remains editable
- **WHEN** the same user opens a valid existing entity in edit mode and all prior edit checks pass
- **THEN** the editor loads and saves edits despite denied creation permission

#### Scenario: Permission changes while a form is open
- **WHEN** a config update removes creation permission before the form submits
- **THEN** the current decision prevents dispatching a create request

#### Scenario: Both schema editor kinds share the same restriction
- **WHEN** schema A has an embedded editor and schema B uses the schema form, and both are restricted
- **THEN** neither create route can create an application without its required permission

#### Scenario: A missing schema does not become an unrestricted fallback
- **WHEN** a create route omits its schema id or requests an id absent from the resolved runner list
- **THEN** the app shows the unavailable state and issues no create request
