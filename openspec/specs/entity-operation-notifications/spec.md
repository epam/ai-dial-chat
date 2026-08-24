# entity-operation-notifications Specification

## Purpose
Defines the success notification every user-initiated entity operation raises in `apps/chat`: which operations must confirm themselves, the one title/body sentence pattern per (entity, operation) pair, the i18n key layout, the variant and dismissal rules, and the single app-level helper (`useOperationNotification`) that owns the mapping so no call site chooses its own wording.
## Requirements
### Requirement: Every completed entity operation raises exactly one success notification

A user-initiated operation that mutates or exports an entity SHALL raise exactly one success notification when it completes successfully. The operation matrix below is exhaustive for this capability; a `—` means the operation does not exist in the product today and no notification is expected until it does.

| Entity | Created | Edited / saved | Deleted | Downloaded | Publish requested | Unpublish requested | Other |
|---|---|---|---|---|---|---|---|
| Prompt (`PromptEditor`, catalog details) | required | required | required | required | required | **new** | — |
| Quick app (`AppsEditor`) | required | required | required (catalog) | — | required (catalog) | **new** (catalog) | — |
| Custom app (`CustomAppEditor`) | required | required | required (catalog) | — | required (catalog) | **new** (catalog) | — |
| Toolset (`ToolsetEditor`) | required | required | required (catalog) | — | required (catalog) | **new** (catalog) | — |
| Model / Skill (catalog details) | — | — | required | — | required | **new** | — |
| Conversation | not notified (see exclusions) | required (rename), required (duplicate) | required | required (export) | required | **new** | import, delete-all, unshare, revoke: required |
| File | — | required (rename) | required | required (single, and a plural count for a multi-item selection) | — | — | upload, copy, move: required |
| Folder | required | required (rename) | required | required (archive) | — | — | copy, move: required |

`required` = already implemented. `**new**` = added by this change.

The `Unpublished` column is replaced by `Unpublish requested`. Unpublishing submits an admin-approval request to DIAL Core rather than removing the published copy (see `catalog-unpublish-api`), so no notification in this capability may state that an entity has been unpublished.

Exclusions, which SHALL NOT raise a success notification:

- Creating a conversation — a new chat is started constantly and a toast per creation is noise.
- Selecting, opening, or navigating to an entity.
- Any operation that fails, partially fails, or is cancelled by the user; those keep their existing error/warning notifications unchanged.
- Scheduled task operations, which keep their current notification behaviour.

#### Scenario: Downloading a prompt confirms the download

- **WHEN** a user downloads a prompt from the catalog details panel and the file is written to disk
- **THEN** a success notification titled `"Prompt downloaded successfully"` is shown with the body naming the prompt

#### Scenario: Saving a toolset confirms before navigating away

- **WHEN** a user clicks Save & Exit in the toolset editor and the create or update request succeeds
- **THEN** a success notification is shown and the editor navigates to the return URL — the notification is not lost by the navigation

#### Scenario: Duplicating a conversation confirms the copy

- **WHEN** a user duplicates a conversation and the duplicate is created
- **THEN** a success notification titled `"Conversation duplicated successfully"` is shown

#### Scenario: Creating a folder confirms the creation

- **WHEN** a user confirms a valid new folder name in the file manager and the create request succeeds
- **THEN** a success notification titled `"Folder created successfully"` is shown

#### Scenario: Unpublishing a catalog entity confirms a submitted request

- **WHEN** a user confirms unpublish for a toolset and the request is accepted
- **THEN** a success notification titled `"Toolset unpublish requested"` is shown, naming the toolset and the folder

#### Scenario: Unpublishing a conversation confirms a submitted request

- **WHEN** a user confirms unpublish for a conversation and the request is accepted
- **THEN** a success notification titled `"Conversation unpublish requested"` is shown, naming the conversation and the folder

#### Scenario: Starting a new conversation stays silent

- **WHEN** a user starts a new conversation
- **THEN** no success notification is shown

#### Scenario: A failed operation raises no success notification

- **WHEN** any operation in the matrix rejects
- **THEN** only the existing error notification is shown, with its `requestId` behaviour unchanged, and no success notification is raised

### Requirement: A completed operation always uses the Success variant

Every notification reporting a **completed** operation SHALL use `NotificationVariant.Success` via `showSuccessNotification` — the green check treatment — regardless of whether the operation added or removed something. Removal, revocation, and un-favouriting are successful outcomes of what the user asked for, not neutral information.

Two notifications that currently use `NotificationVariant.Info` therefore become Success:

- Removing a conversation from My List (`ConversationPanelI18nKeys.UnshareSuccess*`, `ConversationPanelView`).
- Removing an item from favourites (`FavoritesI18nKeys.Removed*`, `CatalogView.onToggleFavorite`) — the added/removed branch collapses to one `showSuccessNotification` call with different copy.

`Info` and `Warning` remain correct for notifications that report something the user did **not** ask for, and those SHALL NOT be converted: unsupported files skipped when attaching (`DialFileManagerModal`), and attachments skipped during conversation export/import (`useConversationExport`, `useConversationImport`) — a partial outcome, not a completed operation.

#### Scenario: Removing from favourites shows a success notification

- **WHEN** a user removes a catalog item from favourites and the request succeeds
- **THEN** the notification uses the Success variant, not Info

#### Scenario: Removing a shared conversation shows a success notification

- **WHEN** a user removes a conversation from My List and the discard succeeds
- **THEN** the notification uses the Success variant, not Info

#### Scenario: Skipped-item advisories stay Info or Warning

- **WHEN** unsupported files are skipped while attaching, or attachments are skipped during export/import
- **THEN** those notifications keep their existing Info / Warning variant

### Requirement: Success notification copy follows one pattern per (entity, operation) pair

Every success notification SHALL consist of a title of the form `<Entity> <operation> successfully` and a one-sentence body that names the entity in double quotes, and — for publish and unpublish — the target folder in double quotes. The two request-shaped operations are the exception to the `successfully` title form: they end in `requested`, because nothing has completed yet.

The strings SHALL be declared as one complete sentence per `(entity, operation)` pair. A sentence SHALL NOT be composed at runtime from an entity noun plus an operation fragment: gendered and cased locales (Arabic, which the app must support, as well as Russian and German) cannot form a correct sentence from interpolated nouns.

English copy per operation, where `<Entity>` / `<entity>` is the entity label from the table that follows:

| Operation | Title | Body |
|---|---|---|
| Created | `<Entity> created successfully` | `You can now see <entity> "{{name}}" in the catalog and My collection.` (catalog entities) / `<Entity> "{{name}}" is created.` (file, folder) |
| Edited | `<Entity> edited successfully` | `Changes for <entity> "{{name}}" are saved.` |
| Renamed | `<Entity> renamed successfully` | `<Entity> "{{name}}" is renamed.` |
| Duplicated | `<Entity> duplicated successfully` | `A copy of <entity> "{{name}}" is created.` |
| Deleted | `<Entity> deleted successfully` | `<Entity> "{{name}}" is not available anymore.` |
| Downloaded | `<Entity> downloaded successfully` | `<Entity> "{{name}}" is saved on your device.` |
| Publish requested | `<Entity> publish requested` | `Publish request for <entity> "{{name}}" was submitted to folder "{{folder}}". It will appear there once an admin approves it.` |
| Unpublish requested | `<Entity> unpublish requested` | `Unpublish request for <entity> "{{name}}" was submitted for folder "{{folder}}". It will be removed once an admin approves it.` |

Entity labels: `Prompt`, `Quick app`, `Custom app`, `Agent`, `Toolset`, `Model`, `Skill`, `Conversation`, `File`, `Folder`.

An application is named by its concrete kind, not by the generic `Agent`: the editors know which one they are (`AppsEditor` → `Quick app`, `CustomAppEditor` → `Custom app`), and catalog-level operations resolve it from the item's deployment — a deployment carrying an `applicationTypeSchemaId` is a quick app, one without is a custom app. `Agent` is used only as the fallback when the item's deployment cannot be resolved from the loaded list, so the copy never guesses a kind.

Batch operations (export all, import, multi-item delete/copy/move/rename) keep their existing plural copy and their existing keys; only their titles are realigned to the `<Entity> <operation> successfully` form.

A pair whose copy has to count items declares `_one` / `_other` variants and receives `count`, which the helper interpolates into **both** the title and the body. The multi-item file download is the one such pair today: `File downloaded successfully` / `File "X" is saved on your device.` for a single file, `Files downloaded successfully` / `{{count}} files are saved on your device.` for a selection.

#### Scenario: Created copy names the entity and where to find it

- **WHEN** a prompt is created in the prompt editor
- **THEN** the notification title is `"Prompt created successfully"` and the body is `You can now see prompt "<name>" in the catalog and My collection.`

#### Scenario: Edited copy states the changes are saved

- **WHEN** an existing prompt is saved in the prompt editor
- **THEN** the notification title is `"Prompt edited successfully"` and the body is `Changes for prompt "<name>" are saved.`

#### Scenario: Unpublish copy names the folder and the approval step

- **WHEN** a conversation's unpublish request is accepted for folder `Organization/Shared chats`
- **THEN** the body is `Unpublish request for conversation "<name>" was submitted for folder "Shared chats". It will be removed once an admin approves it.`

#### Scenario: Copy is not assembled from fragments at runtime

- **WHEN** any success notification in this capability is rendered
- **THEN** its title and body each resolve from a single i18n key holding a complete sentence, with only `name` and `folder` interpolated

### Requirement: Publish notifications state that approval is pending

Both publish flows (`publishCatalogEntity` and `publishConversation`) and both unpublish flows (`unpublishCatalogEntity` and `unpublishConversation`) create an admin-pending DIAL Core publication rather than changing what is visible. Their success notifications SHALL therefore use the `Publish requested` / `Unpublish requested` copy and SHALL NOT claim that the entity is published, visible, unpublished, or removed.

This replaces the current catalog copy (`catalog.publishSuccessTitle` = `"Published"`, `catalog.publishSuccess` = `"\"{{name}}\" published to {{folder}}"`), which overstates the outcome. The conversation publish notification already carries approval-aware copy and keeps that meaning, gaining only the unified title.

The same rule binds the surfaces, not just the copy: an unpublish success SHALL NOT remove the folder from the entity's publish history, SHALL NOT hide the entity from any published list, and SHALL NOT refresh a list on the assumption that something disappeared.

#### Scenario: Catalog publish reports a submitted request

- **WHEN** a user publishes a catalog entity to a folder and the request is accepted
- **THEN** the notification title is `"<Entity> publish requested"` and the body states the request was submitted to the named folder and appears once an admin approves it

#### Scenario: Conversation publish keeps approval wording

- **WHEN** a user publishes a conversation and the request is accepted
- **THEN** the notification keeps its pending-approval meaning and does not state that the conversation is now published

#### Scenario: Unpublish reports a submitted request and changes nothing visible

- **WHEN** a user unpublishes a catalog entity and the request is accepted
- **THEN** the notification title is `"<Entity> unpublish requested"`, the folder still appears in the entity's publish history, and no list is refreshed

### Requirement: One app-level helper owns the (entity, operation) → i18n key mapping

`apps/chat` SHALL expose a single hook — `useOperationNotification` (`apps/chat/src/hooks/useOperationNotification.ts`) — that call sites use to raise these notifications, so no call site chooses its own key pair or wording:

```ts
const { notifyOperationSuccess } = useOperationNotification();

notifyOperationSuccess(NotifiableEntity.Prompt, EntityOperation.Downloaded, {
  name: item.name,
});
```

- The hook SHALL resolve the title and body keys from one exported map keyed by `(NotifiableEntity, EntityOperation)`, translate them with the interpolation params it is given, and call `showSuccessNotification` from `useNotification`.
- It SHALL NOT set `requestId` — trace ids belong to error notifications only (see `notification-request-id`).
- `NotifiableEntity` and `EntityOperation` SHALL be string enums in `apps/chat/src/types/` (per the repo's enum rule), and a `resolveNotifiableEntity(type: CatalogEntityType)` helper SHALL map catalog item types onto `NotifiableEntity`.
- `EntityOperation` SHALL include `UnpublishRequested = 'unpublishRequested'`, and the map SHALL carry one entry per entity the matrix marks as unpublishable — the catalog entities and `Conversation`. It SHALL NOT carry an entry for `File` or `Folder`, which have no unpublish action.
- A pair absent from the map SHALL be a TypeScript error, not a silent no-op, so the matrix above is enforced at compile time.
- `notifyOperationSuccess` SHALL be wrapped in `useCallback` and depend only on `t` and `showSuccessNotification`, both of which are already referentially stable, so it is safe to list in caller dependency arrays.

#### Scenario: Call site passes intent, not strings

- **WHEN** a call site raises an operation notification
- **THEN** it passes an entity, an operation, and interpolation params, and neither a translation key nor literal copy

#### Scenario: Unmapped pair fails the build

- **WHEN** a developer calls `notifyOperationSuccess` with an `(entity, operation)` pair that has no entry in the map
- **THEN** the call does not typecheck

#### Scenario: Unpublishing a file does not typecheck

- **WHEN** a developer calls `notifyOperationSuccess(NotifiableEntity.File, EntityOperation.UnpublishRequested, …)`
- **THEN** the call does not typecheck, because no such pair exists in the map

### Requirement: Success notifications are non-blocking, dismissible, and survive navigation

Operation success notifications SHALL use the existing notification infrastructure unchanged: `NotificationVariant.Success` via `showSuccessNotification`, rendered by the app-level `NotificationContainer` portal, auto-dismissed after the existing 5s delay, and manually closable.

Because `NotificationProvider` and `NotificationContainer` are mounted above `Routes` in `apps/chat/src/main.tsx`, an editor MAY notify and navigate in the same tick; the notification SHALL survive the route change. No call site SHALL delay navigation, close a panel later, or await a notification.

#### Scenario: Notification outlives the editor that raised it

- **WHEN** the toolset, custom app, or quick app editor notifies on save and immediately navigates to the return URL
- **THEN** the notification remains visible on the destination route until it auto-dismisses or the user closes it

#### Scenario: No new notification chrome

- **WHEN** an operation success notification is shown
- **THEN** it renders through the existing `Notification` component with no `Request ID` row and no change to placement, stacking, or timing

### Requirement: i18n keys

All new strings SHALL live in one `entityNotifications` namespace in `apps/chat/src/i18n/locales/en.json`, with a matching `EntityNotificationsI18nKeys` string enum in `apps/chat/src/constants/translation-keys.ts` (raw key literals passed to `t()` are forbidden). Keys are named `entityNotifications.<entity>.<operation>Title` and `entityNotifications.<entity>.<operation>`, e.g.:

| Key | English |
|---|---|
| `entityNotifications.prompt.createdTitle` | `"Prompt created successfully"` |
| `entityNotifications.prompt.created` | `"You can now see prompt \"{{name}}\" in the catalog and My collection."` |
| `entityNotifications.prompt.editedTitle` | `"Prompt edited successfully"` |
| `entityNotifications.prompt.edited` | `"Changes for prompt \"{{name}}\" are saved."` |
| `entityNotifications.prompt.deletedTitle` | `"Prompt deleted successfully"` |
| `entityNotifications.prompt.deleted` | `"Prompt \"{{name}}\" is not available anymore."` |
| `entityNotifications.prompt.downloadedTitle` | `"Prompt downloaded successfully"` |
| `entityNotifications.prompt.downloaded` | `"Prompt \"{{name}}\" is saved on your device."` |
| `entityNotifications.prompt.publishRequestedTitle` | `"Prompt publish requested"` |
| `entityNotifications.prompt.publishRequested` | `"Publish request for prompt \"{{name}}\" was submitted to folder \"{{folder}}\". It will appear there once an admin approves it."` |
| `entityNotifications.prompt.unpublishRequestedTitle` | `"Prompt unpublish requested"` |
| `entityNotifications.prompt.unpublishRequested` | `"Unpublish request for prompt \"{{name}}\" was submitted for folder \"{{folder}}\". It will be removed once an admin approves it."` |
| `entityNotifications.agent.*`, `entityNotifications.toolset.*`, `entityNotifications.model.*`, `entityNotifications.skill.*`, `entityNotifications.conversation.*`, `entityNotifications.file.*`, `entityNotifications.folder.*` | same operation suffixes, one sentence per pair, only for pairs the matrix marks as existing |

Superseded keys SHALL be removed rather than left orphaned: `promptEditor.saveSuccessTitle`, `promptEditor.createSuccess`, `promptEditor.updateSuccess`, `catalog.publishSuccessTitle`, `catalog.publishSuccess`, `catalog.details.delete.successTitle`, `catalog.details.delete.success`. Keys whose copy is only realigned keep their names (`conversationPanel.*`, `conversationExport.*`, `conversationImport.*`, `dialFileManager.*`, `conversationPublish.successMessage`).

The `unpublishRequested` pair SHALL exist only for entities the matrix marks as unpublishable; no `entityNotifications.file.unpublishRequested` or `entityNotifications.folder.unpublishRequested` key may be added.

Strings that label the unpublish UI itself — the menu entry, confirmation copy, consequence bullets, folder-group label, status text — SHALL NOT live in `entityNotifications`. They belong to their own feature namespaces (`catalog.details.unpublish.*`, `conversationUnpublish.*`) with the shared verb reused from `ButtonsI18nKeys.Unpublish` rather than re-declared per surface.

#### Scenario: Every new key is reachable through the enum

- **WHEN** a call site or the key map references a new string
- **THEN** it does so through `EntityNotificationsI18nKeys`, and no raw key literal appears in TypeScript

#### Scenario: No orphaned keys remain

- **WHEN** this change is implemented
- **THEN** every superseded key listed above is deleted from `en.json` and from `translation-keys.ts`, and no key in `entityNotifications` is unreferenced

#### Scenario: The Unpublish verb is declared once

- **WHEN** the catalog menu entry, the conversation menu entry, and both confirm buttons render their label
- **THEN** all four resolve `ButtonsI18nKeys.Unpublish`, and no feature namespace re-declares the bare word

### Requirement: RTL, accessibility, telemetry, and feature gating

- **RTL / direction**: none beyond what exists. The notification container and `Notification` component already use logical layout; the copy carries no directional glyphs. Interpolated names are wrapped in ordinary double quotes and SHALL NOT be forced to `dir="ltr"` — unlike a hex request id, an entity name is user content in the user's own script.
- **Accessibility**: no new ARIA surface. Notifications are announced by the existing container; the title and body are plain text, and the close control keeps its existing translated `aria-label`.
- **Telemetry**: none. No new metrics or analytics events.
- **Feature gating**: none. These notifications are not behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`; they follow whichever operations the user can already perform.
- **Library isolation**: no new library knowledge. `libs/catalog` and the file-manager lib keep receiving operation callbacks (`onDownload`, `onDelete`, `onNotification`, …); every key, sentence, and notification decision stays in `apps/chat`.

#### Scenario: Entity names render in the ambient direction

- **GIVEN** the UI language is Arabic
- **WHEN** an operation notification names an entity
- **THEN** the sentence lays out right-to-left and the interpolated name is not wrapped in a forced-LTR span

#### Scenario: No library gains notification copy

- **WHEN** this change is implemented
- **THEN** no file under `libs/` gains a translated notification string, an i18n import, or a decision about which notification to raise

