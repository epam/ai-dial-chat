## ADDED Requirements

### Requirement: Prompt create option in catalog

The system SHALL add a "Prompt" option to the `CatalogView` create button when `OverlayFeature.Prompts` is enabled. The option SHALL be absent when the feature is disabled. Its label comes from `CatalogI18nKeys.CreatePrompt` (`catalog.createPrompt`, English `'Prompt'`).

Clicking it SHALL navigate to `ROUTES.PromptEditor` in create mode with `PromptEditorQuery.ReturnUrl` set to `ROUTES.Catalog`, so cancelling or saving returns the user to the catalog. It carries no `id` param — an `id` is what distinguishes edit mode.

The entry SHALL be appended after the existing Quick App, Toolset, and Custom App entries, preserving their relative order. No existing create option's visibility rule changes.

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
- **THEN** the Quick App, Toolset, and Custom App entries appear with their existing labels, order, and navigation targets, and the Prompt entry follows them

#### Scenario: Create button is still hidden in selector mode

- **WHEN** `CatalogView` renders with `isSelectorMode` true and `OverlayFeature.Prompts` enabled
- **THEN** no Create button is rendered at all, so no Prompt entry is reachable

---

### Requirement: Edit action for owned prompts opens the prompt editor

`CatalogView`'s `handleEdit` SHALL branch on `CatalogEntityType.Prompt` before its toolset and deployment branches, navigating to `ROUTES.PromptEditor` with `PromptEditorQuery.Id` set to the prompt's `id` and `PromptEditorQuery.ReturnUrl` set to `ROUTES.Catalog`.

The Edit action's visibility is governed by the lib's existing `!!onEdit && !!item.isEditable` rule with no change. `mapPromptToCatalogItem` derives `isEditable` from the permission-aware listing: personal prompts and shared prompts with `canEdit: true` may expose Edit, while read-only shared and organisation prompts do not. A shared prompt's qualified id SHALL be preserved in the editor URL.

#### Scenario: Editing an owned prompt opens it in the editor

- **WHEN** the user opens their own prompt's details panel and activates Edit
- **THEN** the app navigates to `/prompt-editor?id=<prompt path>&returnUrl=/catalog`
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

#### Scenario: Toolset and application edit routing is unchanged

- **WHEN** the user activates Edit on a toolset, a quick app, or a schema-less custom app
- **THEN** it navigates to the same editor and query params as before this change
