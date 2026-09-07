# prompt-editor Specification

## Purpose

The prompt create/edit screen: the `@epam/ai-dial-prompt-editor` lib that owns the flat name/description/Instructions form, the lazy-loaded feature-gated route, create and update behaviour, and client validation mirroring the backend DTO constraints.

## Requirements

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

---

### Requirement: `PromptEditor` is a lazy-loaded, feature-gated route

`apps/chat/src/types/routes.ts` SHALL add `PromptEditor = '/prompt-editor'` to `ROUTES`. `apps/chat/src/app/app.tsx` SHALL register it with `React.lazy` and a `Suspense` fallback, alongside `ToolsetEditorPage`.

`apps/chat/src/types/prompt-editor.ts` SHALL define a `PromptEditorQuery` string enum with `Id = 'id'` and `ReturnUrl = 'returnUrl'`, mirroring `ToolsetEditorQuery`.

Mode resolution: `?id=<full resource path>` opens edit mode, where `<full resource path>` is exactly the value `PromptResponseDto.id` returns — `prompts/{bucket}/{path}` whether the prompt is the caller's own or shared with them; an absent `id` opens create mode. There is no separate personal-vs-shared id shape to distinguish: the same `id` query value is passed straight to `getPrompt` regardless of whose bucket it names. On save or cancel the page navigates to `returnUrl` when present, otherwise `ROUTES.Catalog`.

When `OverlayFeature.Prompts` is disabled the route SHALL redirect to `ROUTES.Catalog` without issuing any prompt request.

#### Scenario: Create mode opens with an empty form

- **WHEN** the user navigates to `/prompt-editor?returnUrl=/catalog`
- **THEN** the page renders empty name, description, and content fields

#### Scenario: Edit mode loads the prompt by its full id

- **WHEN** the user navigates to `/prompt-editor?id=prompts%2Fmy-bucket%2FWork%2FAI%2Fsummarize&returnUrl=/catalog`
- **THEN** `getPrompt('prompts/my-bucket/Work/AI/summarize')` is called and the form is populated with the prompt's name, description, and content (the prompt's stored folder is not shown or editable on this screen — see design.md D16)

#### Scenario: Shared edit mode loads the same way, by the prompt's own full id

- **WHEN** the user navigates to `/prompt-editor?id=prompts%2Fowner-bucket%2FWork%2FAI%2Fsummarize`
- **THEN** `getPrompt('prompts/owner-bucket/Work/AI/summarize')` is called — the identical call shape used for a personal prompt, with no separate owner-bucket argument
- **AND** no folder selector is rendered, consistently with the flattened editor layout

#### Scenario: Editing a non-existent prompt shows an error state

- **WHEN** `getPrompt` rejects with a 404
- **THEN** the page renders an error state with a retry affordance and a link back to the catalog, and does not render an empty create form

#### Scenario: Route is inaccessible when the feature is off

- **WHEN** `OverlayFeature.Prompts` is disabled and the user navigates directly to `/prompt-editor`
- **THEN** the app redirects to `/catalog` and no `/api/v1/prompts` request is issued

#### Scenario: Cancel returns to the caller

- **WHEN** the user cancels with `?returnUrl=/catalog` present
- **THEN** the app navigates to `/catalog` and no mutation is dispatched

---

### Requirement: The editor creates and updates prompts

**Revised (see design.md D16):** `createPrompt` SHALL no longer send a `folderId` — new prompts land at root, since the screen has no folder control to derive one from. `updatePrompt` was already folder-agnostic and is unchanged.

Create SHALL call `createPrompt({ name, description, content })`. An update — personal or shared — SHALL call `updatePrompt(id, { name, description, content })`, where `id` is the prompt's full resource path exactly as loaded; there is no separate owner-bucket argument to thread through. The update payload carries the form's current name, description, and content values.

On success the page SHALL call `refetchPrompts()`, show a success notification, and navigate back only after the refetch settles.

#### Scenario: Creating a root-level prompt

- **WHEN** the user fills name `summarize`, content `Summarize:`, and saves
- **THEN** `createPrompt({ name: 'summarize', content: 'Summarize:' })` is dispatched
- **AND** on 201 the prompt appears in the catalog's Prompts tab under the Personal folder

#### Scenario: Updating content only

- **WHEN** the user edits only the content field and saves
- **THEN** `updatePrompt(id, { name: <current name>, description: <current description>, content: <new value> })` is dispatched
- **AND** no `movePrompt` call is made

#### Scenario: Renaming a prompt

- **WHEN** the user changes the name and saves
- **THEN** `updatePrompt(id, { name: <new name> })` is dispatched and the prompt's `id` changes to reflect the new path within the same bucket

#### Scenario: Saving a writable shared prompt uses the same call shape as a personal one

- **WHEN** the user saves changes to `prompts/owner-bucket/Work/AI/summarize`
- **THEN** `updatePrompt('prompts/owner-bucket/Work/AI/summarize', <body>)` is dispatched — identical in shape to the personal-prompt update call, with no separate owner-bucket argument

#### Scenario: Duplicate name shows an inline field error

- **WHEN** the save request responds `409`
- **THEN** an inline error is shown on the name field, the form stays open with the user's input intact, and no navigation occurs

#### Scenario: Save failure keeps the form open

- **WHEN** the save request responds `502`
- **THEN** an error notification with the request id is shown, the form retains every entered value, and the user can retry

---

### Requirement: The editor screen does not move or manage prompt folders

**Superseded (see design.md D16).** `PromptEditor` SHALL expose no folder-management affordance. The two requirements this change originally shipped here — "The editor moves prompts between folders" and "The editor manages prompt folders" — described folder move/create/rename/delete dispatched from `PromptEditor`'s own folder picker. The approved Figma layout has no folder control on this screen, so none of that is reachable from `/prompt-editor` any more: `apps/chat/src/pages/PromptEditor/PromptEditor.tsx` does not call `movePrompt`, `createPromptFolder`, `renamePromptFolder`, or `deletePromptFolder`.

The create/rename/delete behavior itself still exists, unchanged, in `PromptFolderField` (`libs/prompt-editor`) — see that component's own tests (`PromptFolderField.spec.tsx`, 13 passing) — for a host that composes the widget into a different screen. Nothing currently does.

#### Scenario: The editor screen has no folder affordance

- **WHEN** the user opens `/prompt-editor` in create or edit mode
- **THEN** no folder picker, folder create/rename/delete control, or move-related error is rendered anywhere on the page

#### Scenario: A prompt's folder is unaffected by editing it

- **WHEN** the user edits and saves a prompt that lives in `Work/AI`
- **THEN** `updatePrompt` is dispatched with the current form fields, no `movePrompt` call is made, and the prompt's `id` (and therefore its folder) is unchanged unless the name itself changed

---

### Requirement: Client validation mirrors the backend DTO constraints exactly

The form SHALL block submission and show inline errors for:

| Field | Rule | Source |
| --- | --- | --- |
| name | required, 1–256 characters, no `/` | `CreatePromptDto.name` |
| description | ≤ 2000 characters | `CreatePromptDto.description` |
| content | required, ≤ 50 000 characters | `CreatePromptDto.content` |

**Revised (see design.md D16):** the `folder name` row (`CreatePromptFolderDto.name`) applied to the editor's now-removed folder picker and is no longer part of this screen's contract; it still applies to `PromptFolderField` when a host composes it elsewhere.

Uniqueness is NOT validated client-side — it cannot be — so `409` responses always surface as inline field errors.

The content and description fields SHALL show a character counter. Per the a11y rules, the counter is announced only within the last 10 characters of the limit, not on every keystroke.

#### Scenario: Name containing a slash is rejected before dispatch

- **WHEN** the user types `Work/summarize` into the name field and submits
- **THEN** an inline error explains that the name may not contain `/`, and no request is dispatched

#### Scenario: Content over the limit is rejected before dispatch

- **WHEN** the content field holds 50 001 characters and the user submits
- **THEN** an inline error naming the 50 000-character limit is shown and no request is dispatched

#### Scenario: Empty name blocks submission

- **WHEN** the name field is empty and the user submits
- **THEN** an inline required-field error is shown and no request is dispatched

#### Scenario: Character counter announcement is bounded

- **WHEN** the user types the 49 995th character of the content field
- **THEN** the remaining-characters counter is announced through an `aria-live` region
- **AND** typing the 100th character produces no announcement

---

### Requirement: Non-functional contract for the prompt editor

**Revised (see design.md D16):** the non-functional contract SHALL apply to the flattened prompt editor as described below. The folder-picker-specific bullets (folder empty state, folder tree RTL/a11y, folder-derived memoisation) described the editor's now-removed folder field; they still apply to `PromptFolderField` in isolation, not to the `/prompt-editor` screen.

- **State ownership**: form state SHALL be local to `PromptEditor` (`useState`). No new context is introduced.
- **Loading / empty / error states**: edit mode shows a loading state while `getPrompt` is pending, an error state with retry on failure, and a disabled submit with a pending indicator while a save is in flight.
- **i18n**: keys under `promptEditor.*` — page titles for create and edit, field labels and placeholders for name/description/content, the three validation messages, the character-counter template, and the save/delete success and failure notifications. Save/Cancel/Delete/Edit labels reuse existing `ButtonsI18nKeys` members rather than adding duplicates. Every key is declared in `translation-keys.ts` and `en.json` in the same change. The `promptEditor.folder*`, `promptEditor.moveError`, and `promptEditor.folderError` keys the first pass added were removed once the folder field and move flow left the screen.
- **RTL / direction impact**: the form and character counters use logical properties (`ps-*`, `pe-*`, `text-start`, `border-s-*`); the back/breadcrumb chevron gets `rtl:scale-x-[-1]`.
- **Accessibility**: every field has a programmatically associated label; inline errors are associated via `aria-describedby` and announced; the pending save state is announced through a `role="status"` region.
- **Feature flag**: gated by `OverlayFeature.Prompts` at the route level.
- **Memoisation**: mutation handlers are `useCallback`'d.
- **Observability**: none beyond the shared API client's per-request logging. No new metrics.
- **Authorization**: the editor is reachable by any authenticated user. Personal prompts use the caller's bucket; a writable shared prompt uses the owner bucket carried by its qualified resource id and relies on DIAL Core to enforce `WRITE`. Organisation prompts are always read-only and their details panel offers no Edit action regardless of returned metadata.
- **Rate limiting / caching**: no client cache. `POST /api/v1/prompts` carries the backend's existing per-route throttle (30/min); the form disables submit while a save is in flight so a user cannot trip it by double-submitting.

#### Scenario: Double-submit is impossible

- **WHEN** the user activates Save twice in quick succession
- **THEN** the second activation is ignored because the control is disabled while the first request is pending, and exactly one request is dispatched

#### Scenario: Inline errors are announced

- **WHEN** submission is blocked by a validation error
- **THEN** focus moves to the first invalid field and its error text is associated with the input via `aria-describedby`
