# catalog-create-options Specification

## Purpose
Specifies the entries `CatalogView`'s Create dropdown offers (Custom App, Skill) and their associated navigation/edit affordances.

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

### Requirement: Skill create option in catalog
The system SHALL add a "Skill" option to the `CatalogView` create button, unconditionally (no `OverlayFeature` gate), alongside the existing Prompt/Toolset/Custom App/Quick App entries. The "Skill" option SHALL be a nested submenu with two children: "Write instructions", which navigates to `ROUTES.SkillEditor` with a `returnUrl` query param pointing back to `ROUTES.Catalog` (unchanged from the prior direct-action behavior), and "Upload", which opens a native file picker restricted to a single ZIP archive and imports it as a new Skill (see `skill-archive-import`).

The submenu SHALL be operable by keyboard (arrow-key navigation into and within the submenu, `Enter`/`Space` to activate a child, `Escape` to close) and SHALL NOT require hover to open or navigate on touch/mobile viewports. Both the "Skill" parent item and its "Write instructions"/"Upload" children SHALL meet the existing 44×44 px minimum touch-target size used elsewhere in the Catalog's interactive controls.

#### Scenario: Skill option is always present
- **WHEN** `CatalogView`'s Create dropdown is opened
- **THEN** the dropdown includes a "Skill" entry regardless of any `OverlayFeature` flag state

#### Scenario: Skill option opens a submenu with two actions
- **WHEN** a user opens or focuses the "Skill" entry in the Create dropdown
- **THEN** a submenu appears with exactly two entries, labeled "Write instructions" and "Upload"

#### Scenario: Clicking "Write instructions" navigates to the editor in create mode
- **WHEN** a user selects "Write instructions" from the Skill submenu
- **THEN** the app navigates to `/skill-editor?returnUrl=%2Fcatalog` (or the catalog's current equivalent return path) and the Skill Editor renders in create mode with `SKILL.md` selected by default

#### Scenario: Clicking "Upload" opens a file picker for a ZIP archive
- **WHEN** a user selects "Upload" from the Skill submenu
- **THEN** a native file picker opens restricted to a single ZIP archive, and selecting a file begins the archive import flow described in `skill-archive-import`

#### Scenario: Submenu is keyboard-navigable
- **WHEN** a keyboard user tabs to the "Skill" entry and presses the key that opens its submenu
- **THEN** focus moves into the submenu, arrow keys move between "Write instructions" and "Upload", and `Enter`/`Space` activates the focused child

#### Scenario: Submenu is usable on touch/mobile without hover
- **WHEN** a touch user taps the "Skill" entry on a mobile viewport
- **THEN** the submenu opens and both children are tappable, with no interaction that depends on a hover-only affordance
