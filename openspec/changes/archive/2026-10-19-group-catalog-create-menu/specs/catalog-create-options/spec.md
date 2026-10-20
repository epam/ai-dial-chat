## MODIFIED Requirements

### Requirement: Prompt create option in catalog

The system SHALL add a "Prompt" option to the `CatalogView` create button when `OverlayFeature.Prompts` is enabled. The option SHALL be absent when the feature is disabled. Its label comes from `CatalogI18nKeys.CreatePrompt` (`catalog.create.prompt`), which shares the `catalog.create.*` prefix with every other create-menu label.

Clicking it SHALL navigate to `ROUTES.PromptEditor` in create mode with no query parameters — the Prompt Editor returns to `ROUTES.Catalog` on cancel or save. It carries no `id` param — an `id` is what distinguishes edit mode.

The entry SHALL belong to the menu's entity section and take its place in that section's label order, ahead of the runner section (see `catalog-create-app`). It is not pinned to a fixed position. No existing create option's visibility rule changes.

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

#### Scenario: Prompt sits in the entity section

- **WHEN** `OverlayFeature.Prompts` is enabled alongside `CustomApps`, `Toolsets` and `SchemaApps` with at least one runner schema
- **THEN** the Prompt entry sits, by label, among the Toolset and Skill entries, before the "Runners" header, and no runner or Custom App entry precedes it

#### Scenario: Create button is still hidden in selector mode

- **WHEN** `CatalogView` renders with `isSelectorMode` true and `OverlayFeature.Prompts` enabled
- **THEN** no Create button is rendered at all, so no Prompt entry is reachable

## ADDED Requirements

### Requirement: The mobile Create sheet renders section dividers and headers

`CreateMenuSheet` (`libs/catalog/src/components/Catalog/CreateMenuSheet.tsx`) SHALL render the menu's sections as the desktop dropdown does:

- a `DropdownItemType.Divider` item renders as a non-interactive element with `role="separator"`;
- a `DropdownItemType.PlainText` item renders its label as a non-interactive caption that is neither a `menuitem` nor focusable;
- only `DropdownItemType.Item` entries (including a missing `type`) render as `MenuItem` with `role="menuitem"`.

Search highlighting SHALL leave the divider and the header untouched. A drilled-in page (such as Skill) shows only that group's children. The root page's sections are not repeated there.

**RTL**: the divider and caption use logical spacing (`px-*`, `ms-*`/`me-*`) only and carry no directional icon.

#### Scenario: Sheet shows both sections on a phone

- **WHEN** a user taps Create at a 375px-wide viewport while Toolset and at least one runner are offered
- **THEN** the sheet lists Toolset, then an element with `role="separator"`, then the "Runners" caption, then the runner options
- **AND** the "Runners" caption is not exposed as a `menuitem` and tapping it neither runs an action nor closes the sheet

#### Scenario: Sheet search hides an emptied section's header

- **WHEN** the user types a query in the sheet that matches only runner options
- **THEN** no `separator` and no "Runners" caption is shown
