## ADDED Requirements

### Requirement: The editor's UI lives in `@epam/ai-dial-prompt-editor`

A new lib, `libs/prompt-editor`, SHALL own the prompt form and its folder picker. `apps/chat/src/pages/PromptEditor/PromptEditor.tsx` SHALL become a container that supplies data and behaviour and renders nothing itself.

The lib SHALL export `PromptEditor`, `PromptFolderField`, and every type reachable through their props (`PromptEditorProps`, `PromptEditorValues`, `PromptEditorErrors`, `PromptEditorFolder`, `PromptEditorLabels`, `PromptEditorStyles`, `PromptEditorTypography`, `PromptFolderActions`, `PromptFolderFieldProps`, `FolderFormMode`).

Division of responsibility:

| Concern | Owner |
| --- | --- |
| Field values, folder sub-form state, character-counter announcements, a11y wiring | lib |
| Validation against the DIAL storage contract, API calls, notifications, routing, feature gate, i18n | app container |

The lib SHALL NOT validate field values, import i18n, call an API, or read a route. Specifically:

- Inline messages arrive as plain strings through `errors`; the lib renders them and never derives them.
- `onSubmit` fires with the current values unconditionally — an empty form still submits, because "empty is invalid" is a contract fact the host owns.
- Folder mutations are delegated through `folderActions`. `onCreateFolder` and `onRenameFolder` MAY resolve with the resulting folder path; when they do, the picker selects it. A rejection leaves the sub-form open with the entered name.
- `onValidateFolderName` is a pure callback the lib calls before dispatching a mutation; returning a message blocks the dispatch and shows it inline.
- Length limits arrive as `descriptionMaxLength` / `contentMaxLength` numbers, used only to decide when to announce the characters remaining.

`initialValues` SHALL re-seed the fields whenever its object identity changes, so a host that loads asynchronously can hand over a prompt once the fetch settles.

Every user-visible string SHALL be an optional label with an English default, per the no-i18n-in-libs rule, and the lib SHALL NOT hardcode typography classes — `styles.typography` carries `titleClassName` (default `'dial-h1-text'`) and `helperTextClassName` (default `'dial-small-text'`).

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

#### Scenario: The folder sub-form is a named region

- **WHEN** the create-folder sub-form is open
- **THEN** it is exposed as a `group` named by the create-folder label, so its Save and Cancel controls are distinguishable from the outer form's identically-labelled pair

---

### Requirement: `PromptEditor` is a lazy-loaded, feature-gated route

`apps/chat/src/types/routes.ts` SHALL add `PromptEditor = '/prompt-editor'` to `ROUTES`. `apps/chat/src/app/app.tsx` SHALL register it with `React.lazy` and a `Suspense` fallback, alongside `ToolsetEditorPage`.

`apps/chat/src/types/prompt-editor.ts` SHALL define a `PromptEditorQuery` string enum with `Id = 'id'` and `ReturnUrl = 'returnUrl'`, mirroring `ToolsetEditorQuery`.

Mode resolution: `?id=<promptPath>` opens edit mode; an absent `id` opens create mode. On save or cancel the page navigates to `returnUrl` when present, otherwise `ROUTES.Catalog`.

When `OverlayFeature.Prompts` is disabled the route SHALL redirect to `ROUTES.Catalog` without issuing any prompt request.

#### Scenario: Create mode opens with an empty form

- **WHEN** the user navigates to `/prompt-editor?returnUrl=/catalog`
- **THEN** the page renders empty name, description, and content fields with the folder picker at root

#### Scenario: Edit mode loads the prompt

- **WHEN** the user navigates to `/prompt-editor?id=Work%2FAI%2Fsummarize&returnUrl=/catalog`
- **THEN** `getPrompt('Work/AI/summarize')` is called and the form is populated with the prompt's name, description, content, and folder

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

Create SHALL call `createPrompt({ name, description, content, folderId })` with `folderId` set to the picker's selected folder path (`''` for root). Update SHALL call `updatePrompt(path, { name, description, content })` with only the changed fields.

`updatePrompt` cannot change a prompt's folder — moving is a separate operation (below). In edit mode, changing the folder selection SHALL dispatch `movePrompt` in addition to `updatePrompt`.

On success the page SHALL call `refetchPrompts()`, show a success notification, and navigate back only after the refetch settles.

#### Scenario: Creating a root-level prompt

- **WHEN** the user fills name `summarize`, content `Summarize:`, leaves the folder at root, and saves
- **THEN** `createPrompt({ name: 'summarize', content: 'Summarize:', folderId: '' })` is dispatched
- **AND** on 201 the prompt appears in the catalog's Prompts tab under the Personal folder

#### Scenario: Creating a prompt inside a folder

- **WHEN** the user selects folder `Work/AI` and saves a prompt named `summarize`
- **THEN** `createPrompt` is dispatched with `folderId: 'Work/AI'` and the created prompt's `id` is `Work/AI/summarize`

#### Scenario: Updating content only

- **WHEN** the user edits only the content field and saves
- **THEN** `updatePrompt(path, { content: <new value> })` is dispatched without `name` or `description`
- **AND** no `movePrompt` call is made

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

### Requirement: The editor moves prompts between folders

Changing the folder selection in edit mode SHALL dispatch `movePrompt(path, { targetFolderId })`, with `''` as the target for root. When both the folder and the content/name changed, the update SHALL be applied before the move so the move operates on the current path, and a failure of either step SHALL leave the form open with an error rather than reporting partial success.

#### Scenario: Moving a prompt into a subfolder

- **WHEN** the user opens `summarize` (at root) in edit mode, selects folder `Work/AI`, and saves
- **THEN** `movePrompt('summarize', { targetFolderId: 'Work/AI' })` is dispatched and the prompt's `id` becomes `Work/AI/summarize`

#### Scenario: Moving a prompt to root

- **WHEN** the user opens `Work/AI/summarize` and selects the root folder
- **THEN** `movePrompt('Work/AI/summarize', { targetFolderId: '' })` is dispatched with an empty-string target

#### Scenario: Move conflict shows an inline error

- **WHEN** `movePrompt` responds `409` because a prompt of the same name already exists in the target folder
- **THEN** an inline error is shown on the folder field and the prompt stays in its original folder

#### Scenario: Rename plus move ordering

- **WHEN** the user changes both the name and the folder in one save
- **THEN** `updatePrompt` is dispatched first, and `movePrompt` is dispatched against the post-rename path

#### Scenario: Partial failure is reported, not hidden

- **WHEN** `updatePrompt` succeeds and the subsequent `movePrompt` fails
- **THEN** an error notification states that the move failed, the form stays open, and the already-applied rename is reflected in the form's state after refetch

---

### Requirement: The editor manages prompt folders

The folder picker SHALL expose controls to create, rename, and delete folders, calling `createPromptFolder({ name, parentId })`, `renamePromptFolder(path, { name })`, and `deletePromptFolder(path)`. It renders the folder list from `usePrompts().folders`, and refetches after every folder mutation.

Folder deletion is destructive — it removes every prompt beneath the folder — so it SHALL require an explicit confirmation naming the folder and stating that its contents will be deleted.

#### Scenario: Creating a root folder

- **WHEN** the user creates a folder named `Work` with no parent selected
- **THEN** `createPromptFolder({ name: 'Work' })` is dispatched and `Work` appears in the picker after refetch

#### Scenario: Creating a nested folder

- **WHEN** the user selects `Work` and creates a folder named `AI`
- **THEN** `createPromptFolder({ name: 'AI', parentId: 'Work' })` is dispatched and `Work/AI` appears in the picker

#### Scenario: Duplicate folder shows an inline error

- **WHEN** folder creation responds `409`
- **THEN** an inline error is shown on the folder-name input and no folder is added to the picker

#### Scenario: Renaming a folder updates descendant paths in the picker

- **WHEN** the user renames `Work/AI` to `Machine Learning`
- **THEN** `renamePromptFolder('Work/AI', { name: 'Machine Learning' })` is dispatched, and after refetch the picker shows `Work/Machine Learning` and every prompt formerly under `Work/AI`

#### Scenario: Deleting a folder requires confirmation

- **WHEN** the user activates delete on folder `Work/AI`
- **THEN** a confirmation naming `Work/AI` and stating that its prompts will be deleted is shown
- **AND** `deletePromptFolder` is dispatched only after the user confirms

#### Scenario: Cancelling folder deletion dispatches nothing

- **WHEN** the user dismisses the folder-delete confirmation
- **THEN** no request is dispatched and the folder remains

#### Scenario: Deleting the folder the open prompt lives in

- **WHEN** the user deletes the folder currently selected for the prompt being edited
- **THEN** the selection falls back to root and the form reflects that before the next save

---

### Requirement: Client validation mirrors the backend DTO constraints exactly

The form SHALL block submission and show inline errors for:

| Field | Rule | Source |
| --- | --- | --- |
| name | required, 1–256 characters, no `/` | `CreatePromptDto.name` |
| description | ≤ 2000 characters | `CreatePromptDto.description` |
| content | required, ≤ 50 000 characters | `CreatePromptDto.content` |
| folder name | required, 1–256 characters, no `/` | `CreatePromptFolderDto.name` |

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

- **State ownership**: form state SHALL be local to `PromptEditor` (`useState`); the prompt and folder lists come from `usePrompts()`. No new context is introduced.
- **Loading / empty / error states**: edit mode shows a loading state while `getPrompt` is pending, an error state with retry on failure, and a disabled submit with a pending indicator while a save is in flight. The folder picker shows an explicit empty state when the user has no folders — not a blank list.
- **i18n**: new keys under `promptEditor.*` — page titles for create and edit, field labels and placeholders for name/description/content/folder, the four validation messages, the character-counter template, the folder create/rename/delete labels, the folder-delete confirmation title and message, and the save/delete success and failure notifications. Save/Cancel/Delete/Edit labels reuse existing `ButtonsI18nKeys` members rather than adding duplicates. Every key is declared in `translation-keys.ts` and `en.json` in the same change.
- **RTL / direction impact**: the form, folder tree indentation, and character counters use logical properties (`ps-*`, `pe-*`, `text-start`, `border-s-*`); the back/breadcrumb chevron gets `rtl:scale-x-[-1]`; the folder, plus, and trash icons are symmetric and are not mirrored.
- **Accessibility**: every field has a programmatically associated label; inline errors are associated via `aria-describedby` and announced; the folder tree exposes `aria-expanded` on expandable nodes; the destructive folder-delete confirmation moves focus to its confirm control and returns focus to the trigger on dismiss; the pending save state is announced through a `role="status"` region.
- **Feature flag**: gated by `OverlayFeature.Prompts` at the route level.
- **Memoisation**: mutation handlers are `useCallback`'d; the derived folder tree is `useMemo`'d on `folders`.
- **Observability**: none beyond the shared API client's per-request logging. No new metrics.
- **Authorization**: the editor is reachable by any authenticated user and operates only on the caller's own prompt bucket, enforced backend-side. Organisation prompts are never editable — an organisation prompt's details panel offers no Edit action.
- **Rate limiting / caching**: no client cache. `POST /api/v1/prompts` and `POST /api/v1/prompts/folders` carry the backend's existing per-route throttles (30/min and 20/min); the form disables submit while a save is in flight so a user cannot trip them by double-submitting.

#### Scenario: Double-submit is impossible

- **WHEN** the user activates Save twice in quick succession
- **THEN** the second activation is ignored because the control is disabled while the first request is pending, and exactly one request is dispatched

#### Scenario: Folder picker empty state

- **WHEN** the user has no prompt folders
- **THEN** the picker renders an explicit empty state with a create-folder affordance, not a blank area

#### Scenario: Inline errors are announced

- **WHEN** submission is blocked by a validation error
- **THEN** focus moves to the first invalid field and its error text is associated with the input via `aria-describedby`
