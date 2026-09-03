## MODIFIED Requirements

### Requirement: The editor's UI lives in `@epam/ai-dial-prompt-editor`

`PromptEditor` SHALL use `EditorLayout` from `@epam/ai-dial-editor-builder` as its outer shell, replacing the previous `BuilderFormContainer` from `@epam/ai-dial-builder-form`. The dependency on `@epam/ai-dial-builder-form` SHALL be removed from `libs/prompt-editor/package.json`. The peer dependency `@epam/ai-dial-editor-builder` SHALL be added.

`EditorLayout` SHALL receive:
- `onBack` — the back/cancel navigation callback (previously `onBack` on `BuilderFormContainer`)
- `backAriaLabel` — forwarded from `PromptEditorProps.labels.backButtonAriaLabel` (English default `'Back'`)
- `title` — the resolved create/edit title string (previously the `title` field of `BuilderFormContainer`'s `labels`)
- `leftContent` — the flat single-column form body (name, description, content/instructions)
- `rightContent` absent (single-column mode)
- `actions` — the Cancel + Save buttons
- `isSaving` — forwarded from `isSaving` prop

`PromptEditorProps` changes:
- `labels.backButtonLabel` is renamed to `labels.backButtonAriaLabel` (used as the aria-label on `EditorLayout`'s back button)
- `onBack` prop remains; `onCancel` is passed to the Cancel button inside `actions`

Division of responsibility remains unchanged: field values, character-counter announcements, a11y wiring owned by the lib; validation, API calls, notifications, routing, i18n owned by the app.

#### Scenario: Header row rendered by EditorLayout
- **WHEN** `PromptEditor` renders
- **THEN** the header row (back arrow, title, Cancel, Save) is rendered by `EditorLayout` from `@epam/ai-dial-editor-builder`, not by `BuilderFormContainer`

#### Scenario: No BuilderFormContainer import
- **WHEN** `libs/prompt-editor/src/**` is searched for `@epam/ai-dial-builder-form` imports
- **THEN** none are found

#### Scenario: Single-column layout preserved
- **WHEN** `PromptEditor` renders at any viewport width
- **THEN** the form fields (Name, Description, Instructions) occupy the full available content width, with no sidebar panel beside them

#### Scenario: backButtonAriaLabel labels the back button
- **WHEN** the host passes `labels.backButtonAriaLabel = 'Back to prompts'`
- **THEN** the back-arrow button in the header has accessible name `'Back to prompts'`
