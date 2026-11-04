## REMOVED Requirements

### Requirement: The editor screen does not move or manage prompt folders
**Reason**: The approved "Publish/Save" design adds a destination-folder choice to every resource editor's Save, prompts included. The Save panel replaces the "no folder affordance" rule.
**Migration**: Folder choice now lives in the Save panel (`resource-save-panel` capability). The editor page itself still renders no inline folder picker. `PromptFolderField` in `libs/prompt-editor` remains unused by `/prompt-editor`.

## ADDED Requirements

### Requirement: The editor moves a prompt through the Save panel
In edit mode, `PromptEditor` (`apps/chat/src/pages/PromptEditor/PromptEditor.tsx`) SHALL open the Save panel on Save. The panel has no Version section (prompts are unversioned). On confirm:

- it SHALL dispatch `updatePrompt` with the current form fields;
- when the chosen Personal folder differs from the saved prompt's folder, it SHALL then call the existing `movePrompt` (`POST /api/v1/prompts/move`) with the id returned by the update;
- when an Organization folder is chosen, it SHALL publish the updated prompt there instead of moving it.

The page body SHALL still render no inline folder picker, and no folder create, rename or delete control.

#### Scenario: Editing without changing the folder
- **WHEN** the user edits a prompt in `Work/AI` and confirms the Save panel with destination "Personal › Work › AI"
- **THEN** `updatePrompt` is dispatched and no `movePrompt` call is made

#### Scenario: Moving a prompt on save
- **WHEN** the user edits a prompt in `Work/AI` and confirms the panel with destination "Personal › Archive"
- **THEN** `updatePrompt` is dispatched, then `movePrompt` moves the prompt to `Archive`

#### Scenario: Page body has no folder affordance
- **WHEN** the user opens `/prompt-editor` in create or edit mode
- **THEN** no folder picker or folder create/rename/delete control is rendered on the page itself

## MODIFIED Requirements

### Requirement: The editor creates and updates prompts

Create SHALL open the Save panel (see the `resource-save-panel` capability). On the panel's Save, the prompt SHALL be created through `promptsApi.createPrompt({ createPromptDto: { name, description, content, folderId } })` (`createPromptCreateAdapter` in `@epam/ai-dial-chat-hooks`), where `folderId` is the chosen Personal folder as a plain path and is omitted for the root; an Organization destination creates it at the root and then publishes it there. An update of the user's own prompt also goes through the panel (see "The editor moves a prompt through the Save panel"). An update of a writable shared prompt SHALL call `updatePrompt(id, { name, description, content })` directly, where `id` is the prompt's full resource path exactly as loaded; there is no separate owner-bucket argument to thread through.

On success the page SHALL call `refetchPrompts()` and navigate back only after the refetch settles; the panel shows the success notification (`EntityOperation.Created` / `EntityOperation.Edited`). A failed create or panel save is shown inside the panel, and the form keeps every value. A failed in-place update of a shared prompt shows an inline name error on `409`, and otherwise `showErrorNotification` with `promptEditor.saveError`.

#### Scenario: Creating a prompt in a folder

- **WHEN** the user fills name `summarize`, content `Summarize:`, clicks Create and confirms the panel with Personal `Work`
- **THEN** `createPrompt({ createPromptDto: { name: 'summarize', content: 'Summarize:', folderId: 'Work' } })` is dispatched
- **AND** the prompt appears in the catalog's Prompts tab under `Work`

#### Scenario: Creating a root-level prompt

- **WHEN** the user creates a prompt and confirms the panel with the Personal root
- **THEN** the create request carries no `folderId`

#### Scenario: Saving a writable shared prompt uses the same call shape as a personal one

- **WHEN** the user saves changes to `prompts/owner-bucket/Work/AI/summarize`
- **THEN** `updatePrompt('prompts/owner-bucket/Work/AI/summarize', <body>)` is dispatched directly, with no Save panel and no separate owner-bucket argument

#### Scenario: A failed create keeps the form

- **WHEN** the create request fails during the panel's Save
- **THEN** the panel shows the error, no navigation occurs, and the form retains every entered value
