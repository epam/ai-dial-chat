## MODIFIED Requirements

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
