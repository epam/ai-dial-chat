## Context

Success feedback is scattered across ~15 call sites, each of which picks its own i18n keys and phrasing, and several of which do not notify at all. The plumbing itself is already in place and was just cleaned up: `NotificationProvider` + `NotificationContainer` are mounted above `Routes` in `apps/chat/src/main.tsx`, and `useNotification()` exposes variant-scoped helpers (`showSuccessNotification`, `showErrorNotification`, …). So this change is not about notification infrastructure — it is about **who decides which sentence a completed operation shows**, and making that decision impossible to get wrong at a call site.

Current state per operation is inventoried in `specs/entity-operation-notifications/spec.md`. Two structural facts shape the design:

- Notification copy for an operation is entity-specific (`"Prompt deleted successfully"` vs `"Toolset deleted successfully"`), but the operation itself is often generic — `CatalogView.handleDelete` deletes prompts, toolsets, and applications through one handler, and `useDialFileMutations` renames files and folders through one call.
- The operations live in `apps/chat` while the UI that triggers them lives in `libs/catalog` and the ui-kit file manager. Those libs already receive `onDelete` / `onDownload` / `onNotification` callbacks; none of them may learn a translated string or a notification decision (AGENTS.md §Library isolation).

## Goals / Non-Goals

**Goals:**

- Every user-initiated entity operation confirms itself exactly once, with one consistent sentence shape.
- One module owns the `(entity, operation) → i18n keys` mapping, so coverage is auditable in one place and a missing pair is a compile error.
- Copy is translator-safe for Arabic and other gendered/cased locales.
- Zero new knowledge inside `libs/*`.

**Non-Goals:**

- Implementing the unpublish operation (no endpoint, no UI action exists).
- Touching error/warning notifications, `requestId` handling, notification placement, stacking, or timing.
- A notification queue, dedupe, or rate limiter — the existing container already stacks and auto-dismisses.
- Scheduled tasks and conversation creation (explicitly excluded).

## Decisions

### 1. A hook with an `(entity, operation)` key map, not per-call-site strings

`useOperationNotification` (`apps/chat/src/hooks/useOperationNotification.ts`) exposes `notifyOperationSuccess(entity, operation, params)`. It resolves the title/body keys from one exported `Record<NotifiableEntity, Partial<Record<EntityOperation, OperationNotificationKeys>>>`, translates them, and calls `showSuccessNotification`.

```ts
const { notifyOperationSuccess } = useOperationNotification();
notifyOperationSuccess(NotifiableEntity.Prompt, EntityOperation.Downloaded, { name: item.name });
```

*Why:* the failure mode being designed away is a call site inventing its own wording or forgetting to notify. A hook that takes intent instead of strings makes the map the single audit surface — a reviewer checks one table against the spec matrix instead of reading 15 files. Typing the map so a missing pair fails `tsc` turns spec coverage into a build check.

*Alternatives considered:*

- **Keep calling `showSuccessNotification` with keys at each site.** Rejected: that is today's state, and it is exactly what drifted.
- **Wire notifications inside a generic "operation runner" that also performs the mutation.** Rejected: the mutations are heterogeneous (some navigate, some refetch, some are wrapped in the publish panel's own flow); a runner would need an escape hatch per site and would blur error handling that currently lives close to `getApiErrorDetails`.
- **Emit a domain event and notify from one listener.** Rejected: an event bus is new architecture for a problem that is one function call wide, and it would make the notification untraceable from the call site.

### 2. Entity resolution from `CatalogEntityType` in the app, once

`resolveCatalogItemEntity(type, deployment?)` lives next to the map. Generic catalog handlers (`handleDelete`, `onPublishSuccess`) call it with the item type and the item's deployment; the file manager resolves `File` vs `Folder` from `nodeType`.

*Why:* it keeps the "which noun" decision in one function rather than repeated ternaries, and it is the only place that needs updating when a new `CatalogEntityType` appears. An application is named by its concrete kind — a deployment with an `applicationTypeSchemaId` is a **quick app**, one without is a **custom app** — because "Agent created successfully" tells the user less than the kind they just built. The generic `Agent` copy survives only as the fallback for an item whose deployment is not in the loaded list, so the resolver never guesses.

### 3. Complete sentences per pair — no runtime composition

Each `(entity, operation)` pair owns two full-sentence keys (`…Title`, `…`), with only `name` and `folder` interpolated. No `"{{entity}} created successfully"`.

*Plural pairs* declare `_one`/`_other` variants and take `count`, interpolated into both title and body — used today by the multi-item file download, where the confirmation counts items instead of naming an archive the user never picked.

*Why:* Arabic support is mandated repo-wide. Interpolating a noun into a sentence frame produces wrong agreement in Arabic, Russian, German and many others; translators cannot fix it because the frame is shared. The cost is more keys (~40), which is mechanical, versus copy that cannot be translated correctly, which is not fixable later without redoing this work.

*Alternative considered:* a shared frame plus an entity-noun key, i.e. ~12 keys instead of ~40. Rejected for the reason above; the key count is not the expensive part of this change.

### 4. One `entityNotifications` namespace; superseded keys are deleted

New keys live in `entityNotifications.<entity>.<operation>[Title]`, surfaced through an `EntityNotificationsI18nKeys` enum. Keys the change supersedes (`promptEditor.saveSuccessTitle`, `promptEditor.createSuccess`, `promptEditor.updateSuccess`, `catalog.publishSuccess*`, `catalog.details.delete.success*`) are removed in the same commit. Batch/plural copy (`conversationExport.*`, `conversationImport.*`, `dialFileManager.item(s)…`, `conversationPublish.successMessage`) keeps its keys — only titles are realigned — because that copy is genuinely per-flow (counts, name lists) and not a per-entity sentence.

*Why:* a per-entity sentence cannot live in a feature namespace without inventing `successTitlePrompt` / `successTitleToolset` suffixes there; and leaving the old keys behind guarantees they get reused by the next feature.

### 5. Publish notifications state that approval is pending

Both `publishCatalogEntity` and `publishConversation` create an admin-pending DIAL Core publication (`catalog-publish-api`, `conversation-publish-flow`). The unified copy therefore reads `"<Entity> publish requested"` + `"Publish request for <entity> \"X\" was submitted to folder \"F\". It will appear there once an admin approves it."`.

*Why:* the current catalog copy (`"Published"` / `"published to {{folder}}"`) tells the user the entity is live when it is queued for approval — the conversation flow already spells this out and has a spec requirement demanding it. Unifying toward the *inaccurate* variant would spread a bug; unifying toward the accurate one fixes it.

*Trade-off:* this deviates from the mockup, which shows `"Prompt published successfully"` / `"is published to folder"`. Raised with the requester and confirmed: keep the accurate wording, leave the publish case as implemented.

### 6. Notify and navigate in the same tick

The three editors (`ToolsetEditor`, `CustomAppEditor`, `AppsEditor`) notify and then navigate immediately. No `setTimeout`, no awaiting dismissal.

*Why:* `NotificationProvider` and `NotificationContainer` sit above `Routes`, so notification state is not unmounted by the route change. Delaying navigation to "let the toast show" would be a regression in perceived speed for no benefit.

### 7. What stays out of `libs/*`

`libs/catalog` keeps receiving `onDelete` / `onDownload` / `onPublishSuccess` and the ui-kit file manager keeps receiving `onNotification`; the hook is called on the app side of those callbacks. `useDialFileMutations` (already in `apps/chat/src/hooks/files/`) is the app-side adapter for file operations, so its new success notifications need no new lib prop at all.

## Risks / Trade-offs

- **Notification fatigue** — a multi-step flow (save, refetch, navigate) could stack several toasts → the matrix allows exactly one notification per user action; batch operations notify once for the batch, never per item, and implicit saves (draft creation, preview-triggered save) are explicitly silent.
- **~40 new keys with only `en.json` populated** → the repo ships `en.json` as the source locale and other locales inherit missing keys via i18next fallback; the keys are added in one namespace so a translator gets one contiguous block.
- **Copy realignment breaks existing test assertions** → the affected specs assert on notification payloads; every touched spec is updated in the same slice as its call site, and `nx test chat` is the gate.
- **Deviating from the mockup on publish copy** → recorded as an open question; reverting to the mockup wording is a two-key change in one map entry if design insists.
- **`resolveNotifiableEntity` silently defaulting** for a future `CatalogEntityType` → the mapping is exhaustive over the enum (no `default` branch), so adding a type is a compile error rather than a wrong noun.
- **`Agent` may be the wrong product noun** for quick/custom apps ("App"?) → single-constant change; raised as an open question.

## Migration Plan

Frontend-only, no data or API migration. Order of work: the hook + enums + keys first (self-contained, testable in isolation), then one slice per surface (catalog, prompt editor, entity editors, conversations, file manager), each with its spec updated and `nx test chat` / `nx lint chat` green. Rollback is reverting the commit; nothing persists state and no endpoint contract changes.

## Decisions taken during implementation

- **Every completed operation is Success-variant** (decided with the requester): removing a favourite and removing a conversation from My List moved from `Info` to `showSuccessNotification`. `Info`/`Warning` stay only for outcomes the user did not ask for — unsupported files skipped while attaching, attachments skipped during export/import.
- **Create-vs-edit follows the editor's entry mode, not the request kind.** `ToolsetEditor` saves a toolset authored in the current session through `updateToolset` once its draft exists; keying the notification off that would have reported "edited" for a toolset the user just created, so it keys off `isEditMode`.
- **`triggerBrowserDownload` now returns the file name it saved under** so the file-manager confirmation names what is on disk (the `Content-Disposition` name) rather than what was requested.
- **Flow-specific titles were left alone** where the `<Entity> <operation> successfully` frame cannot express the outcome: catalog and conversation unshare/revoke ("Removed from My List", "Access revoked"), delete-all, export/import (one title key serves both the single and the all-conversations flow), and the file manager's `Item(s) …` plural copy, which covers mixed file+folder selections.
- **Conversation publish copy was merged into the shared namespace**: `conversationPublish.successMessage` is gone and both publish flows now resolve `entityNotifications.<entity>.publishRequested`, which carries the same pending-approval meaning plus the entity name and target folder.

## Resolved Questions

1. ~~Publish copy~~ — **closed with no change**: the pending-approval wording (`"<Entity> publish requested"` + "…once an admin approves it.") stands for both flows, matching what the backend actually does (Decision 5). Deliberately not aligned to the mockup's `"published successfully"`.
2. ~~Noun for quick and custom apps~~ — **resolved**: name the concrete kind. `Quick app …` / `Custom app …`; catalog-level operations resolve the kind from the deployment schema, with the generic `Agent` copy only when the deployment is unresolved.
3. ~~Created copy for catalog entities~~ — **skipped**: the mockup phrasing ("… in the catalog and My collection.") stays for every catalog entity.
4. ~~File download of a multi-item selection~~ — **resolved**: a `File`-scoped plural sentence naming the item count (`Files downloaded successfully` / `{{count}} files are saved on your device.`). A lone folder keeps the folder-scoped copy.
