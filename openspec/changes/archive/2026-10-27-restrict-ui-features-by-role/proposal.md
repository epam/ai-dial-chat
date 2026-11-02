## Why

Operators need to restrict creation of particular catalog entity types and individual application schemas by role, while keeping existing entities visible, usable, and editable. UI feature flags are too broad: disabling `custom-apps` also disables editing, and disabling `prompts`, `toolsets`, or `skills` removes entities from the catalog.

## Problem

There is no independent creation policy for the catalog. `schema-apps` controls all runner create entries together, so it cannot distinguish one application schema from another. The role lookup used by client-config also ignores the provider's configured `rolesClaim`, including the default `dial_roles`.

## Solution

Introduce a server-only `CATALOG_CREATION_ROLES` policy with separate `types` and `schemas` maps. Return the current user's resolved creation permissions in client-config and apply them only to create entry points and create-mode editors. Keep `ENABLED_UI_FEATURES`, its response value, defaults, aliases, and override precedence unchanged.

```json
{
  "types": {
    "custom-app": ["developers"],
    "schema-app": ["app-authors"],
    "toolset": ["integrators"],
    "prompt": ["prompt-authors"],
    "skill": ["skill-authors"]
  },
  "schemas": {
    "schema-A": ["team-A"],
    "schema-B": ["team-B", "admins"]
  }
}
```

These are illustrative roles and schema ids, not deployment defaults. Missing rules impose no additional restriction. Any listed role satisfies a rule; a schema-based create must satisfy both its `schema-app` type rule and its exact schema rule when configured. No role implicitly overrides a rule, including an admin role.

Alternatives considered:

1. **Keep global UI flags only.** Lowest complexity and no migration, but cannot express per-schema creation and changes browsing/editing when used as a role gate.
2. **Filter the global UI-feature set by role.** Reuses toggles but has the same correctness problem and unnecessarily changes `ENABLED_UI_FEATURES` semantics. Rejected.
3. **Independent creation permissions in client-config.** Selected. Adds a small typed response and a host-owned policy adapter, preserves existing global flags, and fits the existing per-user cache. It controls UI workflows; DIAL Core remains responsible for API authorization.

## What Changes

- Add `CATALOG_CREATION_ROLES` with boot-time shape validation, fixed type keys (`custom-app`, `schema-app`, `toolset`, `prompt`, `skill`), and exact opaque schema ids. No dependency on the UI-feature allowlist or its aliases.
- Add `config.catalogCreationPermissions` containing `allowedTypes` and `restrictedSchemaIds`. Do not add `restrictedUiFeatures` or `ENABLED_UI_FEATURES_ROLES`.
- Keep the full schema list for listing, editing, and preview; filter only create options, including header, mobile, and personal-empty-state actions.
- Guard direct create-mode routes and create submissions, including skill ZIP/manifest import. Existing edit operations do not consult the creation policy.
- Resolve roles once through a shared `UserRolesService` that respects provider configuration for cookie and header-token sessions. Reuse it in client-config, `FeatureGuard`, and `AdminRoleService`.
- Update migration and configuration docs, the generated client, and the host-agnostic catalog hook's optional creation-permission inputs.

## Non-goals

- Changing global feature availability, catalog item visibility, entity use, edit/delete/share/publish rules, or schema availability from DIAL Core.
- Adding BFF authorization to entity-write endpoints. Blocking UI routes is not an API security boundary.
- Restricting individual existing entity ids, adding an admin bypass, or adding a policy-management UI.
- Accepting `ENABLED_FEATURES_ROLES` or the unimplemented `ENABLED_UI_FEATURES_ROLES` as aliases.
- Cleaning up unrelated README duplication or other in-progress changes.

## Acceptance criteria

- A restricted user can still browse/use existing entities and edit entities they could edit before; only creation is affected.
- A type restriction hides all creation paths of that type, including both Skill actions. A schema restriction hides only that schema's runner entry.
- Type and schema rules compose with AND; roles within a rule compose with OR. Unlisted types and schemas remain unrestricted by this policy.
- Creating through a direct URL or an already-open upload dialog cannot bypass the UI policy. A denied create issues no create request; edit mode still works.
- Loading/error states do not expose create actions before permissions are known. An older backend's successful response without the new field preserves unrestricted creation under existing global gates.
- `enabledUiFeatures` and `UiFeaturesContext` yield the same values for every role as before this policy. Overlay and isolated-view overrides still replace global features but cannot grant a creation permission denied by this separate policy.
- Unit/integration tests cover role extraction, policy validation/evaluation, cache separation, desktop/mobile/RTL catalog entry points, direct create routes, and edit preservation. OpenAPI generation and repository validation pass.

## Capabilities

### New Capabilities

- `catalog-creation-role-restrictions`: configuration, type/schema rule evaluation, state ownership, and create-mode enforcement independent of UI flags.

### Modified Capabilities

- `config-registry-and-env-provider`: shared provider-aware role lookup and service-assembled `catalogCreationPermissions`.
- `client-config-endpoint`: additive typed creation-permission response; explicit preservation of `enabledUiFeatures`.
- `feature-flags-service`: `FeatureGuard` uses the shared role lookup.
- `catalog-create-app`: per-type/per-schema create gates, search, and tab-specific menus.
- `catalog-create-options`: Custom App, Prompt, and both Skill actions require creation permission; edit behavior is preserved.
- `skill-archive-import`: host checks skill creation permission before opening/selecting/submitting an import.

## Impact

- **Backend:** existing auth, config, and app-config domains. Follow `apps/chat-api/AGENTS.md`. Reference patterns: `apps/chat-api/src/app-config/app-config.service.ts:149` (per-user cache), `apps/chat-api/src/auth/admin-role.service.ts:7` (role coercion), and `apps/chat-api/src/app-config/enabled-ui-features.normalizer.ts` (pure configuration helper).
- **Frontend:** extend `AppConfigContext`; add an app-level permission hook and create-route boundary; wire `CatalogView`, application/prompt/skill editors, and skill import. Reference: `apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts:223` proves `custom-apps` also controls editability; `libs/chat-hooks/src/catalog/useCatalogEditNavigation/useCatalogEditNavigation.ts:135` owns the create menus.
- **Shared libs / global state:** public `chat-hooks` contract gains optional resolved booleans and a schema predicate, defaulting to existing behavior for other hosts. No library reads roles, env, app contexts, routes, or new API data. `AppConfigContext` owns the new state; no new provider. `libs/chat-api-client` changes only through generation.
- **i18n / accessibility:** add translated loading, unavailable, and denied messages for direct create pages. Catalog controls retain mobile, keyboard, and RTL parity.
- **Compatibility:** the new API field and optional hook inputs are additive. New frontend + old backend works after a successful response. Old frontends ignore creation permissions, so deploy both sides before relying on the policy. Role extraction correction separately changes existing role-gated capabilities/admin detection and must be called out in release notes.
- **Rollback:** remove `CATALOG_CREATION_ROLES` and restart to remove creation restrictions. This does not revert the role-lookup fix; that requires reverting the auth slice separately.
