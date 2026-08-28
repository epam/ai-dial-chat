# catalog-create-options Specification

## Purpose
Specifies the Custom App, Skill, and Prompt entries in `CatalogView`'s Create dropdown and their associated navigation and edit affordances. The full ordered menu, including the Quick App and Toolset entries and every gate, is specified by `catalog-create-app`.

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

`mapDeploymentToCatalogItem` takes its configuration as a single options object (not positional arguments), one field of which is `isCustomAppsEditable`, defaulting to `false`; when `true`, schema-less application items are marked `isEditable`.

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

The submenu SHALL be operable by keyboard (arrow-key navigation into and within the submenu, `Enter`/`Space` to activate a child, `Escape` to close) and SHALL NOT require hover to open or navigate on touch/mobile viewports. The parent item and both children SHALL meet the touch-target size the shared `Dropdown` applies to every menu row — the menu is rendered by the ui-kit component, so this capability inherits that sizing rather than setting its own.

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

---

### Requirement: Prompt create option in catalog

The system SHALL add a "Prompt" option to the `CatalogView` create button when `OverlayFeature.Prompts` is enabled. The option SHALL be absent when the feature is disabled. Its label comes from `CatalogI18nKeys.CreatePrompt` (`catalog.create.prompt`), which shares the `catalog.create.*` prefix with every other create-menu label.

Clicking it SHALL navigate to `ROUTES.PromptEditor` in create mode with the shared `EditorQuery.ReturnUrl` parameter set to `ROUTES.Catalog`, so cancelling or saving returns the user to the catalog. It carries no `id` param — an `id` is what distinguishes edit mode.

The entry SHALL be appended last, after the Quick App, Toolset, Custom App, and Skill entries, preserving their relative order. No existing create option's visibility rule changes.

#### Scenario: Option visible when feature enabled

- **WHEN** `OverlayFeature.Prompts` is enabled
- **THEN** the Create dropdown includes a "Prompt" entry

#### Scenario: Option hidden when feature disabled

- **WHEN** `OverlayFeature.Prompts` is not enabled
- **THEN** the Create dropdown does NOT include a "Prompt" entry

#### Scenario: Clicking option navigates to the editor in create mode

- **WHEN** the user clicks "Prompt"
- **THEN** the app navigates to `/prompt-editor?returnUrl=/catalog`
- **AND** the editor renders an empty create form with no `id` param present

#### Scenario: Existing create options are unchanged

- **WHEN** `OverlayFeature.Prompts` is enabled alongside `CustomApps` and `Toolsets`
- **THEN** the Quick App, Toolset, Custom App, and Skill entries appear with their existing labels, order, and navigation targets, and the Prompt entry follows them

#### Scenario: Create button is still hidden in selector mode

- **WHEN** `CatalogView` renders with `isSelectorMode` true and `OverlayFeature.Prompts` enabled
- **THEN** no Create button is rendered at all, so no Prompt entry is reachable

---

### Requirement: Edit action for owned prompts opens the prompt editor

`CatalogView`'s `handleEdit` SHALL branch on `CatalogEntityType.Prompt` first, navigating to `ROUTES.PromptEditor` with the shared `EditorQuery.Id` set to the prompt's `id` and `EditorQuery.ReturnUrl` set to `ROUTES.Catalog`. The branch order is Prompt, then Skill, then Toolset, then the deployment fallback — each of the first three keyed on `item.type` and returning early, so a prompt never reaches the deployment lookup.

Prompt and Skill share the same `EditorQuery` parameter names, differing only in the route they navigate to.

The Edit action's visibility is governed by the lib's existing `!!onEdit && !!item.isEditable` rule with no change. `mapPromptToCatalogItem` derives `isEditable` from the permission-aware listing: personal prompts and shared prompts with `canEdit: true` may expose Edit, while read-only shared and organisation prompts do not. A shared prompt's qualified id SHALL be preserved in the editor URL.

#### Scenario: Editing an owned prompt opens it in the editor

- **WHEN** the user opens their own prompt's details panel and activates Edit
- **THEN** the app navigates to `/prompt-editor` with the prompt's path as `id` and the catalog as `returnUrl`
- **AND** the editor loads that prompt in edit mode

#### Scenario: Read-only shared prompt has no Edit action

- **WHEN** the user opens the details panel for a prompt shared with them with `canEdit: false`
- **THEN** no Edit action is present in the Manage menu

#### Scenario: Writable shared prompt opens with its owner bucket

- **WHEN** the user activates Edit for `prompts/owner-bucket/Work/summarize` with `canEdit: true`
- **THEN** the app navigates to `/prompt-editor?id=prompts%2Fowner-bucket%2FWork%2Fsummarize&returnUrl=/catalog`
- **AND** the editor preserves `owner-bucket` when loading and updating the prompt

#### Scenario: Organisation prompt has no Edit action

- **WHEN** the user opens the details panel for an organisation prompt, even if upstream metadata reports `WRITE`
- **THEN** no Edit action is present in the Manage menu

#### Scenario: Skill edit routing sits between the prompt and toolset branches

- **WHEN** the user activates Edit on a skill
- **THEN** it navigates to `ROUTES.SkillEditor` with the same `EditorQuery.Id` / `EditorQuery.ReturnUrl` pair the prompt branch uses

#### Scenario: Toolset and application edit routing is unchanged

- **WHEN** the user activates Edit on a toolset, a quick app, or a schema-less custom app
- **THEN** it navigates to the same editor and query params as before this change
