## Context

Creation is orchestrated by `CatalogView` and `useCatalogEditNavigation`. `custom-apps` also influences item editability, while `prompts`, `toolsets`, and `skills` influence catalog contents. Reusing these flags as creation permissions would violate the requested preservation of browsing and editing.

Application schemas have stable `id` values. `getRunnerSchemas` deduplicates them and excludes `custom_app`; it is also used by edit flows. Both embedded-editor and schema-form applications use `/apps-editor?schema=<id>` and the same schema identity. Skill creation has two paths: the editor and ZIP/standalone-manifest import. The catalog has desktop, mobile, and tab-empty-state Create controls.

Client-config is already evaluated per user and cached by app id, user id, and sorted roles for 60 seconds. Its role extraction disagrees with the provider-aware admin check. Backend design follows `apps/chat-api/AGENTS.md`; frontend and library changes follow `apps/chat/AGENTS.md` and the root library-isolation rules.

## Goals / Non-Goals

**Goals:** independently restrict creation by entity type and exact application schema; preserve global UI flags and existing entity operations; cover all catalog create entry points and their editors; keep roles on the server.

**Non-goals:** BFF/Core mutation authorization, changes to editing or visibility, a generic UI-feature role map, and unrelated refactoring. Existing Core access controls remain authoritative against direct API calls.

## Decisions

### D1. A creation-specific policy, independent of UI toggles

Use `CATALOG_CREATION_ROLES`, a JSON object with optional `types` and `schemas` objects. Type keys are the string-enum values `custom-app`, `schema-app`, `toolset`, `prompt`, `skill`. `schema-app` covers all runner applications, regardless of embedded-editor versus schema-form rendering. Schema-less custom apps use only `custom-app`.

Rules contain arrays of roles. Compare roles case-sensitively after trimming configured entries. Drop blank role entries and deduplicate. A missing or empty role list is unrestricted; log an empty-list warning once at startup without role names. An absent/blank variable resolves to empty maps.

Reject invalid JSON, null/primitive/array objects, non-string role entries, unknown top-level fields, unknown type keys, and empty/whitespace-only schema keys at boot. Validate shape before trimming so bad values cannot be silently repaired. Use a fixed validation message without raw input or parser diagnostics. Schema keys are opaque: preserve the full value, including case, slashes, punctuation, and URI spelling; do not split, decode, trim, suffix-match, alias, or match display names. Do not fetch schemas at boot: a valid id absent from today's list remains configured and applies if it appears later. An exact-id typo therefore has no effect and is an operator configuration risk, not grounds for inventing an alias.

A pure helper under `apps/chat-api/src/app-config/` normalizes at service construction and evaluates per request. Unknown users have no roles. Any role satisfies one rule; creating a runner requires the type rule AND its schema rule. There is no implicit administrator bypass.

The alternative of extending `ENABLED_UI_FEATURES_ROLES` is rejected because it couples creation with browsing/editing. New positive UI flags for every schema would duplicate an unbounded runtime schema vocabulary in a static toggle enum.

### D2. One provider-aware role reader, preserving existing admin coercion

Add `UserRolesService.getRoles(user?: SessionUser): string[]` in the auth domain. Resolve the provider; unknown provider or no session returns `[]`. Read `claims[rolesClaim]` first, then the dotted path only when the flat key is absent; fallback claim name is `roles` when the provider does not specify one. Preserve the existing `AdminRoleService.toRoleList` conversion: arrays use `map(String)`, a string becomes a singleton, other values yield `[]`. Extract this helper and `resolveClaimPath` into auth `utils/claims.util.ts`, with tests under `utils/tests/`.

This resolves the earlier mismatch between a supposedly behavior-preserving extraction and dropping non-string array entries. It deliberately retains the current admin conversion. Moving other consumers to the shared reader also makes them use that conversion; document this along with the corrected claim source.

`AuthModule` exports the service; `AdminRoleService`, `AppConfigController`, and `FeatureGuard` consume it. Preserve `FeatureGuard`'s class/handler precedence and its existing single-or-array feature-key behavior. Cover module resolution in tests, not just a production bundle build.

### D3. Return resolved permissions through the existing endpoint

Add required `config.catalogCreationPermissions`:

```json
{
  "allowedTypes": ["custom-app", "schema-app", "toolset", "prompt", "skill"],
  "restrictedSchemaIds": []
}
```

`allowedTypes` contains only the type rules the user passes, in the fixed order above. `restrictedSchemaIds` contains configured schema rules the user fails, in configuration order. Its entries remain present even when the broad `schema-app` type is denied; the client composes both. The backend does not enumerate deployment schemas or expose role names.

`ClientConfigDto` refers to a concrete Swagger DTO with a typed enum array and a string array. This is a service-assembled field, excluded from `MappedClientConfig`, not a new registry value. Generate OpenAPI and the client; reuse `appConfigApi.getClientConfig` through `apps/chat/src/server-api/app-config.api.ts` without a new transport path.

Do not read, filter, or mutate `config.enabledUiFeatures`. No `restrictedUiFeatures` field and no new UI toggle are introduced. Keep the current cache key, TTL, public/optional-session endpoint, and private no-store header. Existing endpoint telemetry is sufficient; no role-map/request-value logs or new metrics.

### D4. AppConfigContext owns permissions; an app hook derives decisions

Extend `AppConfigContext` with the permission object and a client-only `catalogCreationStatus` using the existing `UserConfigStatus` enum. Track this status separately so a permission refetch does not change the loading semantics of unrelated feature consumers. Its initial value is `null` (unknown). A successful response omitting the entire field is an older-backend compatibility case and becomes all types allowed, no restricted schemas. A present malformed object marks creation permissions unavailable without discarding otherwise usable configuration; it must not be treated as unrestricted. Creation remains unavailable on initial load, refetch, authentication transition, or error; clear/invalidate stale creation permissions when the config load restarts, and cancel obsolete responses with the existing cancellation pattern. Bind accepted permission state to the current `(providerId, sub)` identity and include that identity in the config load dependency, not just `authStatus`: `UserContext` can adopt another authenticated user without a status transition. A mismatched identity must return unknown permissions immediately, before the reload effect runs. Preserve existing loading/error behavior of unrelated config consumers.

Add `useCatalogCreationPermissions` under app hooks. It derives stable `canCreateType(type)` and `canCreateSchema(schemaId)` callbacks from creation readiness and the resolved policy, without a new context or another request. The latter requires an allowed `schema-app` type and absence from the denied-schema set. The app composes these with existing feature checks; a role never turns on a disabled global flag.

Overlay/isolated-view overrides keep exactly their current effect on `UiFeaturesContext`. They are not policy overrides: even a host enabling a UI feature cannot re-enable a denied create action. This is enforced at the separate creation boundary, not by changing the effective UI-feature set.

### D5. Pass narrow creation decisions into the catalog hook

Extend `UseCatalogEditNavigationParams` with optional resolved inputs `canCreateCustomApp`, `canCreateToolset`, `canCreatePrompt`, `canCreateSkill`, and `canCreateSchema(schemaId)`. Defaults preserve the library's existing behavior for hosts omitting these inputs. `CatalogView` always supplies them from the app hook. Library code neither knows roles nor imports policy/DTO/app-context types.

Build one permission-filtered option collection for both `createOptions` and `createMenuByType`. Filter runner entries after `getRunnerSchemas`, retaining the full schema collection for edit routing. Keep `isCustomAppsEnabled` unchanged for editability. Both skill children share `canCreateSkill`; existing skill visibility remains separate (today its create option has no `OverlayFeature.Skills` gate).

Expose `hasCreateOptions`, computed after feature/permission gates but BEFORE text search. `CatalogView` uses `hideCreateButton={isSelectorMode || !hasCreateOptions}`. This hides header/mobile/empty-state creation when no action is permitted without removing the button when a search has no matches. Empty tab option arrays already suppress that tab's Create button. Search is offered only when at least one runner is permitted before text filtering; sections/dividers are rebuilt after all filtering. Preserve highlight rendering and keyboard behavior.

Update the hook README and test its optional-input compatibility. No lib acquires auth, env, route, API, or storage knowledge; no new library dependency or shared provider is needed.

### D6. Creation guards cover editors and archive import

Add an app-owned `RequireCatalogCreation` boundary with resolved type, schema id where applicable, and the existing editor's create/edit mode. Integrate before mounting create-mode editor bodies, avoiding conditional hooks. Use the editor's existing identity parameter: `appId` for schema apps, each definition's `idQueryParam` for custom apps, `ToolsetEditorQuery.Id` for toolsets, and `EditorQuery.Id` for prompts/skills. Preserve each editor's existing empty/invalid-id and failed-load behavior; never turn a failed edit load into creation.

The same checks protect create submissions in app adapters. Edit mode bypasses only the new creation policy, not existing auth, ownership, feature, or validation checks. Metadata-first Quick Apps are checked before the first create, then continue as editing after a successful create.

On schema creation, resolve the exact requested schema against the existing runner list before enabling a form. Do not fall back to a different schema or compare a localized display name. Loading schemas keeps creation pending; an unavailable/invalid schema cannot be created. Existing schema edit flows retain their current resolution behavior.

For skill import, guard `openDialog`, file selection, and the app-owned import callback before any request; close an idle dialog when permission is lost. Use current permission state for stale dialog/callback paths. Do not add auth logic to the reusable import controller. Requests already dispatched cannot be undone by a client policy change; do not claim server-side revocation.

Direct create pages show localized pending (`catalog.creation.loading`), error (`catalog.creation.unavailable`), or denied (`catalog.creation.denied`) states with an existing translated back-to-catalog action. Pending uses an aria-live status; failure/denial uses an alert. Existing edit routes render normally. Catalog browsing continues even while creation is unavailable. An empty permitted option collection produces no creation controls, without a new catalog error banner.

### D7. Migration is explicit and limited to creation

Document `CATALOG_CREATION_ROLES` as the creation-only replacement for applicable legacy use cases, not a direct rename or copy-as-is map. Example: a legacy `custom-applications` rule becomes `types.schema-app`; restricting schema-less applications additionally uses `types.custom-app`; selected runners use their exact ids under `schemas`. Legacy flags for unrelated UI surfaces have no mapping in this policy. Neither old variable name is accepted.

Unsetting the new variable and restarting removes type/schema restrictions after config reload. It does not revert the auth fix. Old frontends do not enforce the new field, so upgrade both backend and frontend before enabling the policy.

## Risks / Trade-offs

- [Creation rules could accidentally alter editability] → Separate inputs and tests for existing custom apps, schema apps, prompts, toolsets, and skills; never filter `useDeployments().schemas` or `useCatalogItems` by the policy.
- [Hidden menu entries leave other create paths] → Test header/mobile/tab empty states, direct routes, form submissions, and both archive/manifest import paths.
- [Client-config fails or becomes stale across users] → Disable creation while loading/error and invalidate stale permission state on refetch/auth transitions; successful old-backend responses alone use compatibility defaults.
- [Schema ids can contain punctuation or be unavailable at startup] → Opaque exact matching; configuration examples explain obtaining the id from schema data; no boot-time schema lookup or fuzzy matching.
- [Role lookup changes existing guards and admin detection] → Dedicated slice, tests for both session kinds and mixed role arrays, release-note disclosure; no promise that changes only grant access.
- [UI policy does not secure direct API calls] → Retain and document DIAL Core authorization; no changes to entity mutation endpoint contracts.
- [Additional public hook inputs] → Optional inputs with permissive library defaults, contract documentation and compatibility tests; the app supplies explicit current decisions.

## Migration Plan

1. Deploy the independent role-lookup fix with its behavior-change note.
2. Deploy client-config, generated client, and all creation UI consumers together; leave the policy unset initially.
3. Set `CATALOG_CREATION_ROLES` with type rules and exact schema ids, restart, and reload client config. Existing global UI configuration is unchanged.
4. Roll back creation restrictions by clearing the variable and restarting. Revert the auth slice separately if its behavior must also be rolled back.

## Open Questions

None block the specified scope. This is a UI creation policy; adding matching BFF mutation authorization would require a separate scope decision.
