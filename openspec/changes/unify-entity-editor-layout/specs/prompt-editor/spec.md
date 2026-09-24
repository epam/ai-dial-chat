## MODIFIED Requirements

### Requirement: The editor's UI lives in `@epam/ai-dial-prompt-editor`

`PromptEditor` SHALL use `EntityEditor` from `@epam/ai-dial-builder-form` as its outer shell, the same shell every entity editor uses. `@epam/ai-dial-builder-form` SHALL be a peer dependency of `libs/prompt-editor/package.json`.

`EntityEditor` SHALL receive the following:

- `onBack`: the back navigation callback.
- `labels.backAriaLabel`: forwarded from `PromptEditorProps.labels.backButtonAriaLabel` (English default `'Back'`).
- `title`: the resolved create/edit title string.
- `metadata`: the shared `MetadataForm` with `fields={[MetadataField.Name, MetadataField.Description]}`, placed in the "Metadata" section of the 360 px left column. It shows the prompt's Name* and Description with their existing ids, placeholders and error strings.
- `setup`: the Instructions `MarkdownEditor`, including its label, lazy `Suspense` fallback, character-counter announcements and error, placed in the "Setup" section of the right column.
- `onCancel`, `onSubmit` and `isSubmitting` (forwarded from `isSaving`).
- `submitLabel`: `labels.createLabel` in create mode and `labels.saveLabel` in edit mode. The host resolves both through i18n (`buttons.create` / `buttons.save`).

`labels.metadataSectionTitle` and `labels.setupSectionTitle` SHALL be optional, with English defaults `'Metadata'` and `'Setup'`.

Division of responsibility remains unchanged:

- The lib owns field values, character-counter announcements and a11y wiring.
- The app owns validation (`validatePrompt*` in `libs/chat-hooks/src/prompt/prompt.ts`), API calls, notifications, routing and i18n.

#### Scenario: Header row rendered by the shared shell
- **WHEN** `PromptEditor` renders
- **THEN** the header row (back arrow, title, Cancel, primary button) is rendered by `EntityEditor` from `@epam/ai-dial-builder-form`

#### Scenario: Metadata left, Instructions right
- **WHEN** `PromptEditor` renders at desktop width
- **THEN** a "Metadata" section containing Name and Description renders in the left column, a "Setup" section containing Instructions renders in the right column, and no avatar, version, locales or tags controls exist

#### Scenario: Sections stack on mobile
- **WHEN** `PromptEditor` renders at mobile width
- **THEN** Metadata renders above Setup and the actions render in the bottom bar

#### Scenario: Primary label follows the mode
- **WHEN** the host opens the editor without a prompt id
- **THEN** the primary button reads "Create"; with a prompt id it reads "Save"

#### Scenario: backButtonAriaLabel labels the back button
- **WHEN** the host passes `labels.backButtonAriaLabel = 'Back to prompts'`
- **THEN** the back-arrow button in the header has accessible name `'Back to prompts'`
