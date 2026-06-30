## ADDED Requirements

### Requirement: CatalogView create options navigate to apps-editor

`apps/chat/src/components/CatalogView/CatalogView.tsx` SHALL wire the two `createOptions` entries to navigate to the `/apps-editor` route.

Schema resolution: use `useDeployments().schemas` to find the matching `ApplicationSchemaSummaryDto`:
- **Quick App**: `schemas.find(s => s.id?.endsWith('quickapps2') || s.displayName === 'Quick app 2.0')`
- **Toolset** *(temporary — TODO: replace with a proper identifier once toolset schema has a stable id/displayName)*: `schemas.find(s => s.id?.includes('toolset'))`

Navigation URL for each option:
```
/apps-editor?step=general&schema=<schemaId>&returnUrl=/catalog&isCreating=1
```

Where `<schemaId>` is the full `schema.id` value (no stripping needed — the editor page stores it as-is in the URL and looks it up in `schemas` on mount).

A create option SHALL be **hidden** (excluded from the `createOptions` array) when no matching schema is found in `useDeployments().schemas`. If no schemas are available yet (still loading), the options are not shown.

The `createOptions` array SHALL be wrapped in `useMemo` with `[schemas, navigate, t]` as dependencies.

**i18n impact**: Existing keys `catalog.create.quickApp` and `catalog.create.toolset` are already defined. No new keys needed.

**RTL / UI impact**: None — delegated to `@epam/ai-dial-catalog`'s `CreateButton`.

**Feature flag**: None — visibility is controlled solely by schema availability.

**Memoisation**: `createOptions` SHALL be wrapped in `useMemo`. Each `onClick` handler SHALL be wrapped in `useCallback` (or inlined using `useCallback` dependencies).

**Accessibility**: The `CreateButton` from `@epam/ai-dial-catalog` handles its own ARIA. No additional attributes required in `CatalogView`.

#### Scenario: Quick App option present when schema matched by id

- **WHEN** `useDeployments().schemas` contains `{ id: "https://mydial.epam.com/custom_application_schemas/quickapps2", ... }`
- **THEN** `createOptions` includes an entry with label `t("catalog.create.quickApp")`

#### Scenario: Quick App option present when schema matched by displayName

- **WHEN** `useDeployments().schemas` contains `{ id: "...", displayName: "Quick app 2.0", ... }`
- **THEN** `createOptions` includes an entry with label `t("catalog.create.quickApp")`

#### Scenario: Clicking Create Quick App navigates to apps-editor

- **WHEN** the user clicks the "Create Quick App" option
- **THEN** the router navigates to `/apps-editor?step=general&schema=https%3A%2F%2F...quickapps2&returnUrl=%2Fcatalog&isCreating=1`

#### Scenario: Quick App option hidden when no matching schema

- **WHEN** `useDeployments().schemas` contains no entry whose `id` ends with `quickapps2` and no entry with `displayName === 'Quick app 2.0'`
- **THEN** `createOptions` does NOT include a Quick App entry

#### Scenario: Toolset option hidden when no matching schema

- **WHEN** `useDeployments().schemas` contains no entry whose `id` includes `toolset`
- **THEN** `createOptions` does NOT include a Toolset entry

#### Scenario: Both options hidden while schemas are still loading

- **WHEN** `useDeployments().isLoading` is true and `schemas` is empty
- **THEN** `createOptions` is an empty array

#### Scenario: Clicking Create Toolset navigates to apps-editor with toolset schema

- **WHEN** a toolset schema is available and the user clicks "Create Toolset"
- **THEN** the router navigates to `/apps-editor?step=general&schema=<toolsetSchemaId>&returnUrl=%2Fcatalog&isCreating=1`
