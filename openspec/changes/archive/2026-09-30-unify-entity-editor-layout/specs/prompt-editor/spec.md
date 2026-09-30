## MODIFIED Requirements

### Requirement: The editor's UI lives in `@epam/ai-dial-prompt-editor`

`PromptEditor` SHALL use `EntityEditor` from `@epam/ai-dial-builder-form` as its outer shell, the same shell every entity editor uses. `@epam/ai-dial-builder-form` SHALL be a peer dependency of `libs/prompt-editor/package.json`.

The prompt keeps its single-column arrangement on that shell. `EntityEditor` SHALL receive the following:

- `onBack`: the back navigation callback.
- `labels.backAriaLabel`: forwarded from `PromptEditorProps.labels.backButtonAriaLabel` (English default `'Back to prompts'`).
- `title`: the resolved create/edit title string.
- `metadataTitle={null}`, so the column has no section heading.
- `metadata`: one centred column (max 1180 px) holding the shared `MetadataForm` with `fields={[MetadataField.Name, MetadataField.Description]}`, then the Instructions `MarkdownEditor` with its label, lazy `Suspense` fallback, character-counter announcements and error. The Instructions editor fills the height left below the fields.
- No `setup`, so the column takes the full width.
- `onCancel`, `onSubmit` and `isSubmitting` (forwarded from `isSaving`).
- `submitLabel`: `labels.createLabel` in create mode and `labels.saveLabel` in edit mode. The host resolves both through i18n (`buttons.create` / `buttons.save`).

`PROMPT_EDITOR_CLASS.form` SHALL stamp the column.

Division of responsibility remains unchanged:

- The lib owns field values, character-counter announcements and a11y wiring.
- The app owns validation (`validatePrompt*` in `libs/chat-hooks/src/prompt/prompt.ts`), API calls, notifications, routing and i18n.

#### Scenario: Header row rendered by the shared shell
- **WHEN** `PromptEditor` renders
- **THEN** the header row (back arrow, title, Cancel, primary button) is rendered by `EntityEditor` from `@epam/ai-dial-builder-form`

#### Scenario: One column without section headings
- **WHEN** `PromptEditor` renders
- **THEN** Name, Description and Instructions render in one column, no "Metadata" or "Setup" heading renders, and no avatar, version, locales or tags controls exist

#### Scenario: Primary label follows the mode
- **WHEN** the host opens the editor without a prompt id
- **THEN** the primary button reads "Create"; with a prompt id it reads "Save"

#### Scenario: backButtonAriaLabel labels the back button
- **WHEN** the host passes `labels.backButtonAriaLabel = 'Back to prompts'`
- **THEN** the back-arrow button in the header has accessible name `'Back to prompts'`
