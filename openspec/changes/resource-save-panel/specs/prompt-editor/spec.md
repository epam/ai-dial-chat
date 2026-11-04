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
