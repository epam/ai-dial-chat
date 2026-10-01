## MODIFIED Requirements

### Requirement: Skill create option in catalog
The system SHALL add a "Skill" option to the `CatalogView` create button, unconditionally (no `OverlayFeature` gate), alongside the runner, Prompt, Toolset and Custom App entries. The "Skill" option SHALL be a nested submenu with two children: "Write instructions", which navigates to `ROUTES.SkillEditor` with no query parameters (the Skill Editor returns to `ROUTES.Catalog` on its own), and "Upload", which opens a native file picker restricted to a single ZIP archive and imports it as a new Skill (see `skill-archive-import`).

The submenu SHALL be operable by keyboard (arrow-key navigation into and within the submenu, `Enter`/`Space` to activate a child, `Escape` to close) and SHALL NOT require hover to open or navigate on touch/mobile viewports. The parent item and both children SHALL meet the touch-target size the shared `Dropdown` applies to every menu row — the menu is rendered by the ui-kit component, so this capability inherits that sizing rather than setting its own.

#### Scenario: Skill option is always present
- **WHEN** `CatalogView`'s Create dropdown is opened
- **THEN** the dropdown includes a "Skill" entry regardless of any `OverlayFeature` flag state

#### Scenario: Skill option opens a submenu with two actions
- **WHEN** a user opens or focuses the "Skill" entry in the Create dropdown
- **THEN** a submenu appears with exactly two entries, labeled "Write instructions" and "Upload"

#### Scenario: Clicking "Write instructions" navigates to the editor in create mode
- **WHEN** a user selects "Write instructions" from the Skill submenu
- **THEN** the app navigates to `/skill-editor` with no query string and the Skill Editor renders in create mode with `SKILL.md` selected by default

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

Clicking it SHALL navigate to `ROUTES.PromptEditor` in create mode with no query parameters — the Prompt Editor returns to `ROUTES.Catalog` on cancel or save. It carries no `id` param — an `id` is what distinguishes edit mode.

The entry SHALL take its place in the alphabetical order the whole menu is sorted in (see `catalog-create-app`), not a fixed last position. No existing create option's visibility rule changes.

#### Scenario: Option visible when feature enabled

- **WHEN** `OverlayFeature.Prompts` is enabled
- **THEN** the Create dropdown includes a "Prompt" entry

#### Scenario: Option hidden when feature disabled

- **WHEN** `OverlayFeature.Prompts` is not enabled
- **THEN** the Create dropdown does NOT include a "Prompt" entry

#### Scenario: Clicking option navigates to the editor in create mode

- **WHEN** the user clicks "Prompt"
- **THEN** the app navigates to `/prompt-editor` with no query string
- **AND** the editor renders an empty create form

#### Scenario: Prompt is placed alphabetically

- **WHEN** `OverlayFeature.Prompts` is enabled alongside `CustomApps` and `Toolsets`
- **THEN** the Prompt entry sits where its label sorts among the runner, Toolset, Custom App, and Skill entries, whose labels and navigation targets are unchanged

#### Scenario: Create button is still hidden in selector mode

- **WHEN** `CatalogView` renders with `isSelectorMode` true and `OverlayFeature.Prompts` enabled
- **THEN** no Create button is rendered at all, so no Prompt entry is reachable

---

### Requirement: Edit action for owned prompts opens the prompt editor

`useCatalogEditNavigation`'s `handleEdit` SHALL branch on `CatalogEntityType.Prompt` first, navigating to `ROUTES.PromptEditor` with the shared `EditorQuery.Id` set to the prompt's `id` and no `returnUrl`. The branch order is Prompt, then Skill, then Toolset, then the deployment fallback — each of the first three keyed on `item.type` and returning early, so a prompt never reaches the deployment lookup.

Prompt and Skill share the same `EditorQuery.Id` parameter name, differing only in the route they navigate to.

The Edit action's visibility is governed by the lib's existing `!!onEdit && !!item.isEditable` rule with no change. `mapPromptToCatalogItem` derives `isEditable` from the permission-aware listing: personal prompts and shared prompts with `canEdit: true` may expose Edit, while read-only shared and organisation prompts do not. A shared prompt's qualified id SHALL be preserved in the editor URL.

#### Scenario: Editing an owned prompt opens it in the editor

- **WHEN** the user opens their own prompt's details panel and activates Edit
- **THEN** the app navigates to `/prompt-editor` with the prompt's path as `id`
- **AND** the editor loads that prompt in edit mode

#### Scenario: Read-only shared prompt has no Edit action

- **WHEN** the user opens the details panel for a prompt shared with them with `canEdit: false`
- **THEN** no Edit action is present in the Manage menu

#### Scenario: Writable shared prompt opens with its owner bucket

- **WHEN** the user activates Edit for `prompts/owner-bucket/Work/summarize` with `canEdit: true`
- **THEN** the app navigates to `/prompt-editor?id=prompts%2Fowner-bucket%2FWork%2Fsummarize`
- **AND** the editor preserves `owner-bucket` when loading and updating the prompt

#### Scenario: Organisation prompt has no Edit action

- **WHEN** the user opens the details panel for an organisation prompt, even if upstream metadata reports `WRITE`
- **THEN** no Edit action is present in the Manage menu

#### Scenario: Skill edit routing sits between the prompt and toolset branches

- **WHEN** the user activates Edit on a skill
- **THEN** it navigates to `ROUTES.SkillEditor` with the same `EditorQuery.Id` parameter the prompt branch uses

#### Scenario: Toolset and application edit routing follows its own spec

- **WHEN** the user activates Edit on a toolset, a runner app, or a schema-less custom app
- **THEN** it navigates as `catalog-quickapp-edit-action` specifies
