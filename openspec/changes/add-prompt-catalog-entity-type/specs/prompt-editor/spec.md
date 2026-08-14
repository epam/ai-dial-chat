## ADDED Requirements

### Requirement: The editor's UI lives in `@epam/ai-dial-prompt-editor`

**Revised (see design.md D16):** `PromptEditor` no longer renders a folder picker or owns folder sub-form state — the approved Figma design (`513:49196`) has no folder control on the create/edit screen. `PromptFolderField` remains exported from the same lib as a standalone widget a host may compose in separately; the requirement below describes `PromptEditor` only.

A new lib, `libs/prompt-editor`, SHALL own the prompt form: name, description, and content (labelled **Instructions**) as a single flat column, with no "Details"/"Configuration" section split. `apps/chat/src/pages/PromptEditor/PromptEditor.tsx` SHALL become a container that supplies data and behaviour and renders nothing itself.

The lib SHALL export `PromptEditor`, `PromptFolderField`, and every type reachable through their props (`PromptEditorProps`, `PromptEditorValues`, `PromptEditorErrors`, `PromptEditorFolder`, `PromptEditorLabels`, `PromptEditorStyles`, `PromptEditorTypography`, `PromptFolderActions`, `PromptFolderFieldProps`, `FolderFormMode`). `PromptEditorFolder` and `PromptFolderActions` remain reachable only through `PromptFolderFieldProps`, not through `PromptEditorProps`.

Division of responsibility:

| Concern | Owner |
| --- | --- |
| Field values, character-counter announcements, a11y wiring | lib (`PromptEditor`) |
| Folder sub-form state (when a host composes `PromptFolderField` itself) | lib (`PromptFolderField`) |
| Validation against the DIAL storage contract, API calls, notifications, routing, feature gate, i18n | app container |

The lib SHALL NOT validate field values, import i18n, call an API, or read a route. Specifically:

- Inline messages arrive as plain strings through `errors`; the lib renders them and never derives them.
- `onSubmit` fires with the current values unconditionally — an empty form still submits, because "empty is invalid" is a contract fact the host owns.
- Length limits arrive as `descriptionMaxLength` / `contentMaxLength` numbers, used only to decide when to announce the characters remaining.

`initialValues` SHALL re-seed the fields whenever its object identity changes, so a host that loads asynchronously can hand over a prompt once the fetch settles.

Every user-visible string SHALL be an optional label with an English default, per the no-i18n-in-libs rule, and the lib SHALL NOT hardcode typography classes — `styles.typography` carries `titleClassName` (default `'dial-h1-text'`), `contentLabelClassName` (default `'dial-tiny-semi-text'`, matching `Input`/`Textarea`'s own label style), and `helperTextClassName` (default `'dial-small-text'`).

The flat column SHALL be capped at `max-w-[1180px]` and horizontally centered (`mx-auto`), matching the convention already used for centered page-level content in `Catalog.tsx` and `ScheduledTasks.tsx`, so it does not stretch edge-to-edge on a wide viewport now that no fixed-width side column bounds it.

#### Scenario: The lib does not validate

- **WHEN** the form is submitted with every field empty
- **THEN** `onSubmit` is called with empty values and the lib renders no error of its own

#### Scenario: Host errors render inline

- **WHEN** the host passes `errors: { name: 'Name is required' }`
- **THEN** that message renders under the name field

#### Scenario: Asynchronously-loaded values seed the form

- **WHEN** the host re-renders with a new `initialValues` object after its fetch settles
- **THEN** the fields show the loaded values

#### Scenario: A load error replaces the form, not augments it

- **WHEN** `hasLoadError` is true
- **THEN** an `alert` region with the load-error message renders, no field is rendered, and the retry button appears only if `onRetry` was supplied

#### Scenario: Saving blocks resubmission and announces status

- **WHEN** `isSaving` is true and the save button is activated
- **THEN** `onSubmit` is not called and a `status` region announces the saving label

#### Scenario: The folder sub-form is a named region (applies to `PromptFolderField` in isolation)

- **WHEN** a host composes `PromptFolderField` and its create-folder sub-form is open
- **THEN** it is exposed as a `group` named by the create-folder label, so its Save and Cancel controls are distinguishable from an outer form's identically-labelled pair
- **NOTE**: `PromptEditor` itself does not render `PromptFolderField`, so this scenario is not exercised from the editor screen

---

### Requirement: `PromptEditor` is a lazy-loaded, feature-gated route

`apps/chat/src/types/routes.ts` SHALL add `PromptEditor = '/prompt-editor'` to `ROUTES`. `apps/chat/src/app/app.tsx` SHALL register it with `React.lazy` and a `Suspense` fallback, alongside `ToolsetEditorPage`.

`apps/chat/src/types/prompt-editor.ts` SHALL define a `PromptEditorQuery` string enum with `Id = 'id'` and `ReturnUrl = 'returnUrl'`, mirroring `ToolsetEditorQuery`.

Mode resolution: `?id=<promptPath>` opens edit mode; an absent `id` opens create mode. On save or cancel the page navigates to `returnUrl` when present, otherwise `ROUTES.Catalog`.

When `OverlayFeature.Prompts` is disabled the route SHALL redirect to `ROUTES.Catalog` without issuing any prompt request.

#### Scenario: Create mode opens with an empty form

- **WHEN** the user navigates to `/prompt-editor?returnUrl=/catalog`
- **THEN** the page renders empty name, description, and content fields

#### Scenario: Edit mode loads the prompt

- **WHEN** the user navigates to `/prompt-editor?id=Work%2FAI%2Fsummarize&returnUrl=/catalog`
- **THEN** `getPrompt('Work/AI/summarize')` is called and the form is populated with the prompt's name, description, and content (the prompt's stored folder is not shown or editable on this screen — see design.md D16)

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

**Revised (see design.md D16):** `createPrompt` no longer sends a `folderId` — new prompts land at root, since the screen has no folder control to derive one from. `updatePrompt` was already folder-agnostic and is unchanged.

Create SHALL call `createPrompt({ name, description, content })`. Update SHALL call `updatePrompt(path, { name, description, content })` with only the changed fields.

On success the page SHALL call `refetchPrompts()`, show a success notification, and navigate back only after the refetch settles.

#### Scenario: Creating a root-level prompt

- **WHEN** the user fills name `summarize`, content `Summarize:`, and saves
- **THEN** `createPrompt({ name: 'summarize', content: 'Summarize:' })` is dispatched
- **AND** on 201 the prompt appears in the catalog's Prompts tab under the Personal folder

#### Scenario: Updating content only

- **WHEN** the user edits only the content field and saves
- **THEN** `updatePrompt(path, { content: <new value> })` is dispatched without `name` or `description`

#### Scenario: Renaming a prompt

- **WHEN** the user changes the name and saves
- **THEN** `updatePrompt(path, { name: <new name> })` is dispatched and the prompt's `id` changes to the new path

#### Scenario: Duplicate name shows an inline field error

- **WHEN** the save request responds `409`
- **THEN** an inline error is shown on the name field, the form stays open with the user's input intact, and no navigation occurs

#### Scenario: Save failure keeps the form open

- **WHEN** the save request responds `502`
- **THEN** an error notification with the request id is shown, the form retains every entered value, and the user can retry

---

### Requirement: The editor screen does not move or manage prompt folders

**Superseded (see design.md D16).** The two requirements this change originally shipped here — "The editor moves prompts between folders" and "The editor manages prompt folders" — described folder move/create/rename/delete dispatched from `PromptEditor`'s own folder picker. The approved Figma layout has no folder control on this screen, so none of that is reachable from `/prompt-editor` any more: `apps/chat/src/pages/PromptEditor/PromptEditor.tsx` does not call `movePrompt`, `createPromptFolder`, `renamePromptFolder`, or `deletePromptFolder`.

The create/rename/delete behavior itself still exists, unchanged, in `PromptFolderField` (`libs/prompt-editor`) — see that component's own tests (`PromptFolderField.spec.tsx`, 13 passing) — for a host that composes the widget into a different screen. Nothing currently does.

#### Scenario: The editor screen has no folder affordance

- **WHEN** the user opens `/prompt-editor` in create or edit mode
- **THEN** no folder picker, folder create/rename/delete control, or move-related error is rendered anywhere on the page

#### Scenario: A prompt's folder is unaffected by editing it

- **WHEN** the user edits and saves a prompt that lives in `Work/AI`
- **THEN** `updatePrompt` is dispatched with only the changed fields, no `movePrompt` call is made, and the prompt's `id` (and therefore its folder) is unchanged unless the name itself changed

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

**Revised (see design.md D16):** the folder-picker-specific bullets below (folder empty state, folder tree RTL/a11y, folder-derived memoisation) described the editor's now-removed folder field; they still apply to `PromptFolderField` in isolation, not to the `/prompt-editor` screen.

- **State ownership**: form state SHALL be local to `PromptEditor` (`useState`). No new context is introduced.
- **Loading / empty / error states**: edit mode shows a loading state while `getPrompt` is pending, an error state with retry on failure, and a disabled submit with a pending indicator while a save is in flight.
- **i18n**: keys under `promptEditor.*` — page titles for create and edit, field labels and placeholders for name/description/content, the three validation messages, the character-counter template, and the save/delete success and failure notifications. Save/Cancel/Delete/Edit labels reuse existing `ButtonsI18nKeys` members rather than adding duplicates. Every key is declared in `translation-keys.ts` and `en.json` in the same change. The `promptEditor.folder*`, `promptEditor.moveError`, and `promptEditor.folderError` keys the first pass added were removed once the folder field and move flow left the screen.
- **RTL / direction impact**: the form and character counters use logical properties (`ps-*`, `pe-*`, `text-start`, `border-s-*`); the back/breadcrumb chevron gets `rtl:scale-x-[-1]`.
- **Accessibility**: every field has a programmatically associated label; inline errors are associated via `aria-describedby` and announced; the pending save state is announced through a `role="status"` region.
- **Feature flag**: gated by `OverlayFeature.Prompts` at the route level.
- **Memoisation**: mutation handlers are `useCallback`'d.
- **Observability**: none beyond the shared API client's per-request logging. No new metrics.
- **Authorization**: the editor is reachable by any authenticated user and operates only on the caller's own prompt bucket, enforced backend-side. Organisation prompts are never editable — an organisation prompt's details panel offers no Edit action.
- **Rate limiting / caching**: no client cache. `POST /api/v1/prompts` carries the backend's existing per-route throttle (30/min); the form disables submit while a save is in flight so a user cannot trip it by double-submitting.

#### Scenario: Double-submit is impossible

- **WHEN** the user activates Save twice in quick succession
- **THEN** the second activation is ignored because the control is disabled while the first request is pending, and exactly one request is dispatched

#### Scenario: Inline errors are announced

- **WHEN** submission is blocked by a validation error
- **THEN** focus moves to the first invalid field and its error text is associated with the input via `aria-describedby`
