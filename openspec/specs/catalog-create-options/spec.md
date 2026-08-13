# catalog-create-options Specification

## Purpose

The create options offered in the catalog, including the Custom App entry and the feature flag that hides it.

## Requirements

### Requirement: Custom App create option in catalog
The system SHALL add a "Custom App" option to the `CatalogView` create button when `OverlayFeature.CustomApps` is enabled. The option SHALL be absent when the feature flag is disabled. The option is additionally suppressed by `OverlayFeature.HideCustomAppCreation`.

#### Scenario: Option visible when feature enabled
- **WHEN** `OverlayFeature.CustomApps` is enabled
- **THEN** the Create dropdown includes a "Custom App" entry

#### Scenario: Option hidden when feature disabled
- **WHEN** `OverlayFeature.CustomApps` is not enabled
- **THEN** the Create dropdown does NOT include a "Custom App" entry

#### Scenario: Clicking option navigates to editor
- **WHEN** user clicks "Custom App"
- **THEN** the app navigates to the Custom App Editor in creation mode

### Requirement: Edit button for schema-less custom apps
When `OverlayFeature.CustomApps` is enabled, `CatalogView` SHALL show the Edit button on catalog items that are owned by the user (`isMy` or `canEdit`), have `type = 'application'`, and have **no** `applicationTypeSchemaId`. Clicking Edit navigates to `CustomAppEditor` with the item's `id`.

The `mapDeploymentToCatalogItem` utility accepts a 6th param `isCustomAppsEditable`; when `true`, schema-less application items are marked `isEditable`.

#### Scenario: Edit button visible for schema-less app
- **WHEN** `OverlayFeature.CustomApps` is enabled and the user owns a schema-less application
- **THEN** the Edit button is shown for that item in the catalog

#### Scenario: Edit button absent when feature disabled
- **WHEN** `OverlayFeature.CustomApps` is disabled
- **THEN** schema-less applications do NOT show an Edit button

### Requirement: `OverlayFeature.HideCustomAppCreation`
The `HideCustomAppCreation = 'hide-custom-app-creation'` modifier flag SHALL suppress the "Custom App" entry in the catalog create menu when active, without disabling the Edit button. This allows operators to permit editing existing custom apps while preventing creation of new ones.

#### Scenario: Create entry is suppressed while Edit stays available

- **WHEN** `OverlayFeature.CustomApps` is enabled and `OverlayFeature.HideCustomAppCreation` is active
- **THEN** the catalog create menu offers no "Custom App" entry
- **AND** the Edit button still renders on schema-less custom apps the user can edit
