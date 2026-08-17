## ADDED Requirements

### Requirement: The details panel offers a host-driven Download action

`libs/catalog` SHALL add two optional props to `CatalogProps` and `DetailsPanelProps`:

- `onDownload?: (item: CatalogItem) => Promise<void> | void` — called when the "Download" entry in the Manage menu is activated.
- `isDownloadVisible?: (item: CatalogItem) => boolean` — narrows which items offer the action, defaulting to `true` (visible) whenever `onDownload` is supplied.

`Header.tsx` SHALL render the entry as `shouldShowDownloadAction = !!onDownload && (isDownloadVisible?.(item) ?? true)`, positioned after Edit and before Publish, ahead of every destructive entry. `ItemDetailsTexts` SHALL gain `downloadActionLabel?: string` (default `'Download'`).

The call is fire-and-forget: the panel does not await the result, shows no pending state, and stays on its details content with no confirmation step. Progress and failure feedback belong to the host, which is the only side that knows what is being written.

The lib MUST NOT learn the file format, build the payload, or name the file. It reports the click and nothing else — a lib that serialized a prompt would embed a host-owned wire contract.

#### Scenario: Download entry appears when the host supplies the callback

- **WHEN** the details panel opens for an item with `onDownload` supplied and no `isDownloadVisible` predicate
- **THEN** the Manage menu contains a "Download" entry
- **AND** activating it calls `onDownload` with that item

#### Scenario: Download entry is absent without the callback

- **WHEN** the details panel opens for an item and `onDownload` is not supplied
- **THEN** the Manage menu contains no "Download" entry

#### Scenario: The predicate can hide the entry

- **WHEN** `onDownload` is supplied and `isDownloadVisible` returns `false` for the item
- **THEN** no "Download" entry is rendered

#### Scenario: Downloading does not disturb the panel

- **WHEN** the user activates "Download"
- **THEN** the tab row stays rendered, no confirmation step opens, and no Back button appears

#### Scenario: The label is overridable

- **WHEN** `texts.downloadActionLabel` is `'Export'`
- **THEN** the menu entry reads `Export`

#### Scenario: The props are optional and additive

- **WHEN** an existing consumer of `Catalog` passes neither prop
- **THEN** it compiles unchanged and its Manage menu is identical to before this change

---

### Requirement: A prompt downloads as a version 5 JSON envelope

`apps/chat/src/utils/export-prompt.ts` SHALL own the file's shape, mirroring the conversation export envelope so both downloads share one format family:

```ts
export interface PromptExportFormat {
  version: 5;
  prompts: ExportedPrompt[];
  folders: ExportFolder[];
}
```

`ExportedPrompt` carries `id`, `name`, `description`, `content`, and an optional `folderId`. `ExportFolder` is reused from `@epam/ai-dial-chat-shared` rather than redeclared.

`buildPromptExportEnvelope(prompt: PromptResponseDto)` SHALL:

- substitute `''` for a missing `description`, so the field is always present
- omit `folderId` entirely for a root-level prompt rather than emitting `''`
- expand `folderId` into the full parent-linked folder chain, outermost first, each folder's `id` being its own full path so a re-import can rebuild the nesting without inventing identifiers
- carry neither `createdAt`/`updatedAt` nor `author` into the file — they describe the source resource, not the exported prompt, and would be wrong the moment the file is imported elsewhere
- preserve `{{variable}}` placeholders in the body verbatim

`serializePromptExport` SHALL produce a pretty-printed `application/json` blob. `buildPromptExportFileName(promptName, appName, date)` SHALL return `{YYYY-MM-DD}_{appName}_prompt_{safeName}.json`, replacing every character outside `[a-zA-Z0-9._-]` with `_` so the name stays a single file-name segment. `EXPORT_APP_NAME` SHALL move to `export-conversation.ts` and be shared by both download paths rather than duplicated as a literal.

#### Scenario: A nested prompt carries its folder chain

- **WHEN** a prompt with `folderId: 'Work/AI'` is downloaded
- **THEN** `folders` is `[{ id: 'Work', name: 'Work' }, { id: 'Work/AI', name: 'AI', folderId: 'Work' }]`
- **AND** `prompts[0].folderId` is `'Work/AI'`

#### Scenario: A root-level prompt carries no folder

- **WHEN** a prompt with `folderId: ''` is downloaded
- **THEN** `folders` is `[]` and `prompts[0]` has no `folderId` key

#### Scenario: Timestamps and author stay out of the file

- **WHEN** a prompt whose DTO carries `author`, `createdAt`, and `updatedAt` is downloaded
- **THEN** `prompts[0]` has exactly the keys `id`, `name`, `description`, `content`, and `folderId`

#### Scenario: Placeholders survive the round trip

- **WHEN** a prompt whose body is `Hi {{name}}, see {{ topic }}` is downloaded
- **THEN** the serialized `content` is byte-identical to the body

#### Scenario: The file name is a single safe segment

- **WHEN** a prompt named `Summarize long emails` is downloaded on 2026-08-12
- **THEN** the file name is `2026-08-12_ai_dial_prompt_Summarize_long_emails.json`

---

### Requirement: `CatalogView` wires download for prompts only

`CatalogView` SHALL pass `onDownload={handleDownload}` and `isDownloadVisible={(item) => item.type === CatalogEntityType.Prompt}` to `Catalog`. Every other entity type is backed by configuration the catalog does not export, so offering the action there would promise a file that cannot be produced.

`handleDownload` SHALL re-fetch the body rather than reading `item.details.promptContent`: the listing seeds that field, so a prompt edited in another tab would otherwise be written to disk stale. It resolves through `getPublicPrompt(item.id)` when `isOrganisationPromptItem(item)`, `getPrompt(item.id)` for a personal prompt, and parses a shared prompt's qualified id before calling `getPrompt(path, ownerBucket)` — the same dispatch the details fetch and use-in-chat paths use.

`isOrganisationPromptItem` SHALL be extracted to `apps/chat/src/utils/map-prompt-to-catalog-item.ts` and shared by all three call sites, replacing the inline `!item.isMyApp && !item.sharedWithMe` expression each had duplicated.

Failure SHALL surface an error notification carrying the request id from `getApiErrorDetails`, using the new `CatalogI18nKeys.DetailsPromptDownloadError` key, and SHALL write no file. Success is confirmed by the browser's own download UI, so no success notification is shown. The action label reuses the existing `ButtonsI18nKeys.Download`; no feature-scoped duplicate is declared.

Sharing an owner's prompt is not a precondition: download is a read, so it is offered for personal, shared-with-me, and organisation prompts alike.

#### Scenario: A personal prompt downloads through the personal endpoint

- **WHEN** the user activates Download on their own prompt
- **THEN** `getPrompt(item.id)` is called and a blob download is triggered exactly once
- **AND** the file name ends in `_prompt_{name}.json`

#### Scenario: An organisation prompt downloads through the public endpoint

- **WHEN** the user activates Download on an organisation prompt
- **THEN** `getPublicPrompt(item.id)` is called and `getPrompt` is not

#### Scenario: A shared prompt downloads from its owner bucket

- **WHEN** the user activates Download on `prompts/owner-bucket/Work/summarize`
- **THEN** `getPrompt('Work/summarize', 'owner-bucket')` is called

#### Scenario: The written body is the freshly fetched one

- **WHEN** the listing seeded one body and `getPrompt` resolves a different one
- **THEN** the file contains the fetched body, not the seeded one

#### Scenario: No download action on a non-prompt item

- **WHEN** the catalog contains a Model item and a Prompt item
- **THEN** only the Prompt item offers the Download action

#### Scenario: A failed download reports the request id and writes nothing

- **WHEN** `getPrompt` rejects
- **THEN** an error notification with `CatalogI18nKeys.DetailsPromptDownloadError` and the resolved trace id is shown
- **AND** no blob download is triggered

---

### Requirement: Non-functional contract for prompt download

- **Memoisation**: `handleDownload` and `isDownloadVisible` MUST be `useCallback`'d, so the details panel's props stay referentially stable across unrelated re-renders.
- **i18n**: one new key, `catalog.details.promptDownloadError`. The action label reuses `ButtonsI18nKeys.Download`, whose English value `'Download'` already exists in `en.json`.
- **Accessibility**: the menu entry is a normal Manage-menu item and inherits its keyboard model; its `IconDownload` is `aria-hidden`, since the entry already carries a text label.
- **RTL / direction impact**: none — the entry introduces no physical-direction class and its icon is not directional.
- **Authorization**: no new client-side check. The prompt endpoints already scope reads to what the caller may see; an organisation prompt is readable by every user.
- **Observability**: none beyond the shared API client's per-request logging. The prompt body MUST NOT be logged.

#### Scenario: Download props do not invalidate the details fetch

- **WHEN** `CatalogView` re-renders because an unrelated notification is shown
- **THEN** `handleDownload` and `isDownloadVisible` keep their identity and the panel does not re-issue a details fetch

#### Scenario: No raw translation key literal is passed to `t()`

- **WHEN** the download code calls `t()`
- **THEN** the key comes from a `translation-keys.ts` enum member, never a string literal
