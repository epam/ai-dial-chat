## Context

The conversation **export** feature (`2026-07-15-conversation-export`) produces a versioned v5 envelope `{ version: 5, history, folders }` as either a `.json` file (no attachments) or a `.dial` ZIP (`conversation.json` + `res/<path>` attachment bytes). This change adds the **import** counterpart and must also accept export files from the previous ("old") chat on the `development` branch.

Grounding facts confirmed in the codebase:

- **Export output shape** (`apps/chat/src/utils/zip-export.ts`, `export-conversation.ts`): `.json` = `{version:5, history: Conversation[], folders: []}`; `.dial` = ZIP with `conversation.json` (the envelope) + `res/<decoded-bucket-relative-path>` per attachment. `version: 5` is unchanged and shared with old chat (see Decision 11 for why a v6 bump was tried and reverted). `isValidArchivePath` validates archive paths by rejecting `.`/`..`/empty path segments (traversal/absolute-path defense); it does **not** use a character allowlist — real-world filenames routinely contain spaces, parentheses, and non-ASCII characters, and anything unsafe in the eventual upload URL is percent-encoded downstream by `buildImportUploadPath`/`buildUploadPath` (see Decision 12).
- **Attachment references** live at `message.custom_content.attachments[].url` (or `reference_url`), in DIAL id form `files/{bucket}/{path}`; parse via `isDialFileId` / `resolveDialFileBucketAndPath` (`apps/chat/src/utils/dial-file.ts`). The zip entry for such a ref is `res/<path>` where `path` is exactly what `resolveDialFileBucketAndPath` returns.
- **Upload:** `uploadFile(bucket, path, file, options?)` → `{ url: 'files/{bucket}/{path}' }` (`apps/chat/src/server-api/files.api.ts`). `build-upload-path.ts` builds `uploads/YYYY-MM/<encoded-name>` (month-level) with a `getSafeFileName` sanitizer.
- **Persist:** `saveConversation(subPath, conversation)` (`apps/chat/src/server-api/conversations.api.ts`) — already used by several frontend flows (`useConversationHandlers`, `ConversationRoute`, etc.) with `subPath` derived via `getConversationPath(id)` (strips the bucket); the backend `resolveConversationLocation` saves a slash-less subPath into the session bucket.
- **Conversation id/path format:** `{bucket}/{deploymentId}__{name}[__{uuid}]` (backend `createConversation`; `duplicateConversation` appends `__{randomUUID()}` on collision). Regenerating the trailing UUID guarantees a unique save path with no server-side conflict handling.
- **Queue UI:** `ImportExportQueue.tsx` is already presentational and prop-driven (`jobs: {id,label,status}[]`, `onClose/onDismiss/onRetry`). `useConversationExport.ts` is the template for the import hook (job queue, per-job `AbortController`, retry closures, bounded-concurrency `runWithConcurrency`).
- **Format comparison (old vs new):** the `.dial` JSON entry name cannot be disambiguated by version — old chat and this app both write `version: 5` — so entry-name detection stays structural (`conversation.json` new vs `conversations/conversations_history.json` old). The in-message attachment shape and the `res/<path-after-bucket>/<name>` layout are compatible across old/new. The **conversation content model** differs (old `message.like`/`model.id`/no `timestamp`/`replay`/`playback`/`system` role vs new `rating`/`deploymentId`/required `timestamp`,`lastActivityDate`,`assistantModelId`) but is imported as-is (cast to `Conversation`, no separate legacy type) — see Decision 5 and Decision 11.
- **Old chat's raw resource id prefix:** old chat's exported `id`/`folderId` carry the raw DIAL Core resource prefix `conversations/{bucket}/{path}`, not this app's app-level `{bucket}/{path}` id. `rebaseConversationId`/`getFolderBreadcrumb` strip a leading `conversations/` segment before parsing bucket/folder structure so both id shapes resolve to the same structure (see Decision 3).

## Goals / Non-Goals

**Goals:**

- Import a single export file (`.json` or `.dial`/`.zip`) into the current user's conversations.
- Accept the v5 envelope from both old-chat and new-chat exports; open both archive JSON-entry names.
- Re-upload archive attachments to `uploads/<YYYY-MM-DD>/` and rewrite the conversation's attachment URLs accordingly.
- Save every imported conversation as a brand-new conversation via a regenerated UUID — no conflict dialog.
- Reuse the export architecture (pure utils + hook + thin UI) and the existing `ImportExportQueue`; keep `libs/*` untouched.

**Non-Goals:**

- No v1–v4 envelope support (only `version: 5`; see Decision 11 for why a version bump was tried and reverted).
- **No conversation content-model normalization this iteration** — old-chat conversations are saved as-is; see Decision 5 and the deferred follow-up.
- No new backend endpoint, no OpenAPI/contract change, no feature flag.
- No bulk/multi-file import in a single picker action beyond the conversations inside one file's `history`.
- No conversation-folder tree reconstruction (folders array tolerated but not materialized).

## Decisions

### Decision 1 — Layered architecture mirroring export

Pure utils (no React/API): `zip-import.ts` (`parseDialArchive(file)` via `fflate` unzip) and `import-conversation.ts` (`parseImportEnvelope`, `regenerateConversationId`, `rewriteAttachmentUrls`, `buildImportUploadPath`). Orchestration hook `useConversationImport.ts` owns the job queue, reads the user bucket, uploads attachments with bounded concurrency, rewrites URLs, saves conversations, and maps errors to toasts + job status. Thin UI: an "Import" menu item + hidden `<input type="file">` wired in `ConversationPanelView`.

_Alternative considered:_ put logic in the component. Rejected — untestable and breaks the small-pure-function convention already established by export.

### Decision 2 — Reuse existing primitives; add no dependency

Reuse `fflate` (already added by export) for unzip, `uploadFile` for attachment upload, `saveConversation` for persistence, `isValidArchivePath` (exported from `zip-export.ts`), and `isDialFileId`/`resolveDialFileBucketAndPath`. Extract `runWithConcurrency` and the `YYYY-MM-DD` date formatter (currently private in export utils) into shared utils so export and import share one implementation instead of duplicating.

_Alternative considered:_ server-side `uploadArchive` (one-shot extraction). Rejected — it extracts the whole archive preserving internal structure (would produce `uploads/<date>/res/...` and also drop in `conversation.json`), which does not match the required flat `uploads/<date>/<name>` layout and gives no per-attachment URL mapping.

### Decision 3 — Fresh-UUID id regeneration (folder segments preserved) instead of a conflict dialog

Each imported conversation's id/path is rebased to the current user's bucket with a freshly generated trailing UUID, then saved via `saveConversation`. Because the path is unique, saving never overwrites and needs no replace/skip/postfix dialog. This matches the user's explicit choice and reuses the established `{bucket}/[<folder-segments>/]{deploymentId}__{name}__{uuid}` scheme and the frontend `saveConversation` pattern.

**Folder segments are preserved, not flattened.** A conversation id may contain folder path segments between the bucket and the name (`{bucket}/<folder>/<subfolder>/{deploymentId}__{name}[__{uuid}]`). Import keeps those segments (only the leading bucket is swapped and the trailing UUID regenerated), and sets `folderId = {userBucket}[/<folder-segments>]`. The frontend `saveConversation(subPath, …)` stores `subPath = <folder-segments>/{deploymentId}__{name}__{uuid}` under the session bucket, so the conversation lands in its original folder path. The new chat currently **displays** all conversations at the root (no folder UI yet — folders are coming soon), so preserving the segments is future-proof and harmless today; the queue-row breadcrumb is derived from these same segments.

_Alternative considered:_ a new backend import endpoint that reuses `duplicateConversation`'s unique-path logic. Rejected for now — frontend `saveConversation` is already an established pattern and needs no new API surface; the id-regeneration is a minimal, safe transformation (swap bucket + regenerate the trailing UUID), not a full re-derivation of the backend path scheme.

_Alternative considered:_ old-branch replace/skip/postfix dialog. Rejected — materially more UI/state, and fresh UUIDs make collisions impossible.

### Decision 4 — Tolerant archive parsing; structural (not version) disambiguation

`parseDialArchive` looks for the JSON entry as `conversation.json` first, then `conversations/conversations_history.json` (and, defensively, any root `*.json`). Attachments are read from `res/<path>` and matched to message references by decoding each `files/{bucket}/{path}` URL to its `<path>` — identical resolution for old and new archives. This entry-name detection never uses the version field — old chat and this app both write `version: 5`, so archive-layout disambiguation stays purely structural.

### Decision 5 — Import conversation content "as-is" (no normalization now)

Per the user, conversations are saved without content-model transformation in this iteration. The known old-chat content-model gap (`like`→`rating`, `model.id`→`deploymentId`, missing required `timestamp`/`lastActivityDate`/`assistantModelId`, `replay`/`playback`/`system`-role messages) is documented as a deferred follow-up: if testing shows real breakage, add a minimal `normalizeImportedConversation` mapping later. This keeps the first cut small and lets real old-chat files drive what normalization is actually needed.

_Alternative considered:_ build the full normalization layer up front. Deferred — larger surface and speculative; better informed by observed behavior.

### Decision 6 — Day-level upload folder; name conflicts fail loud, not silently renamed

Add `buildImportUploadPath(fileName, date)` to `build-upload-path.ts` (alongside `buildUploadPath`) producing `uploads/<YYYY-MM-DD>/<encoded-safe-name>` — a pure path builder with no de-duplication logic, mirroring `buildUploadPath`'s simplicity exactly. The existing month-level `buildUploadPath` (used by normal attachment uploads) is left unchanged.

**Per the user: no auto-suffixing.** Each upload call uses `uploadMode: 'create-only'` (already supported by `uploadFile`/the backend, which rejects with `409 Conflict` if the path exists — see `apps/chat-api/src/files/upload/files-upload.service.ts`). A `409` is caught and reported as a distinct, named **error** notification (`ConversationImportI18nKeys.AttachmentNameConflict`, `"{{names}} already exists. Please rename it and try again."`) — separate from the generic "attachment skipped" warning used for not-found/invalid-path/network failures. The conflicting attachment's reference is left unrewritten (same skip behavior as other unresolvable attachments); the conversation still imports.

_Alternative considered (superseded):_ an in-batch collision suffix (`name (1).ext`) computed client-side via a shared `takenPaths` registry. Rejected per explicit user direction — silently renaming on a bare "file already exists" without surfacing it is surprising; a clear error is preferable to a mystery numbered file.

### Decision 7 — Reuse (but don't merge) the ImportExportQueue: two panels, not one combined queue

Generalize the job type to a neutral shape (rename `ExportJob` to a shared transfer/queue job, or add an `ImportJob` alias) so the same `ImportExportQueue` component renders both export and import jobs — but as **two separate panel instances**, one per hook, each with its own title ("Exporting" / "Importing"), not one merged list.

_Superseded approach:_ the first version of this feature concatenated both hooks' job lists into one panel instance with a single dynamic title (`importJobs.length ? "Importing" : "Exporting"`). This was confusing in practice: if an import job was still present (e.g. not yet dismissed after finishing) and the user then triggered an export, the export job appeared inside a panel still titled "Importing" — the title didn't reflect what was actually happening. Two independent `ImportExportQueue` instances (one wired to `useConversationExport`'s jobs/dismiss/retry, one to `useConversationImport`'s) fix this — each panel's title always matches its own jobs, with no cross-hook routing logic needed for dismiss/retry.

To avoid the two fixed-position panels overlapping, `ImportExportQueue` no longer self-positions (`fixed bottom-4 end-4 z-[70]` moved out of the component); `ConversationPanelView` wraps both instances in one `fixed bottom-4 end-4 z-[70] flex flex-col-reverse gap-2` container, so Tailwind's flexbox stacks them vertically regardless of either panel's variable height (job count, collapsed/expanded) — no manual offset math needed. Each instance still independently returns `null` when its own job list is empty, so a lone active queue looks identical to before the split.

Each job row's name/breadcrumb uses `DialEllipsisTooltip` (from `@epam/ai-dial-ui-kit`) so a truncated file/conversation name shows its full text on hover. The ui-kit's tooltip content portal ships with a fixed `z-[55]`, below the queue panel's `z-[70]`, which would otherwise clip the tooltip under the panel. Rather than lowering the panel's z-index (which would put it below other same-layer UI) or adding a global CSS override for every tooltip in the app, each `DialEllipsisTooltip` instance passes `contentClassName="!z-[80]"` — the `!` important modifier reliably beats the ui-kit's plain `z-[55]` class regardless of stylesheet load order, scoped to just this one usage.

The panel stays prop-driven; title/labels come from i18n.

**Per the Figma "Importing" frame** (node `2352-23886`): the panel header reads "Importing" with a collapse chevron, a determinate progress bar sits under the header, and each **row is two lines** — an optional small secondary **folder-path breadcrumb** (e.g. `Folder 1 / Folder 2 / Folder 3`) above the primary chat name — with the same trailing status affordances the queue already has (× to dismiss an in-progress job, green check on success, retry icon + red alert on failure). The existing `JobRow` renders only a single-line `label`, so the job model gains an **optional secondary line** (e.g. `description`/`folderPath`) and `JobRow` renders it above the label when present. Per the user, this breadcrumb applies to **export jobs too**, so it is a shared queue feature, not import-only. The breadcrumb is derived from the conversation's folder data (display-only); it does **not** imply recreating the folder hierarchy in storage (conversations still save at the bucket root — see Open Questions).

### Decision 9 — One job per imported file (labeled like export); aggregate per-conversation notifications

Per the Figma frames, importing creates **one queue job per file**, mirroring export's `exportSingle`/`exportAll` job model:

- A **single-conversation** file → one job labeled with that conversation's name, with its source folder breadcrumb as the secondary line (Figma node `2352-23886`; the multiple rows there are several single-conversation files).
- A **multi-conversation** file (e.g. an export-all `.json`) → one job labeled **"All conversations"** (Figma "Importing / All conversations" frame), no breadcrumb.

The file is parsed once; the parsed envelope + shared archive attachment map are held for the operation so the job (and any retry) reuses them; retry re-runs the whole file. The job's status is in-progress until every conversation in the file settles, then success (all imported) or failed (any failed) — the granular per-conversation outcome is surfaced in the toasts, not as separate rows. When the operation settles, notifications aggregate by outcome: a single **success** toast naming every imported conversation (`"A", "B", "C" imported.`) and a single **failure** toast naming every failed one (`"D" was not imported. Please try again.`); both can appear together on partial success. An unsupported/unreadable file shows one unsupported-format toast and creates no row. This matches the export feature's per-conversation-named toast convention, extended to lists.

_Alternative considered:_ one job per conversation. Rejected — the "All conversations" frame shows a multi-conversation import as a single row (symmetric with export-all), and per-conversation granularity is carried by the toasts.

### Decision 10 — "Import" menu placement

Per the Figma header-menu frame (`1920_import_start`), "Import" sits immediately **after "Export"** in the conversation panel header overflow menu. The mock also shows Select All / New Folder / Compare Mode items that do not exist on this branch — **only** the "Import" item is added here (between the existing export-all and delete-all items); the others are out of scope.

### Decision 8 — Library isolation and a11y/RTL preserved

All API/host/i18n knowledge stays at the app edge. `libs/chat-shared` gained one small, plain-data rename during this work (`ExportFolderV5`→`ExportFolder` — see Decision 11); it carries no host/app/API/i18n knowledge, so isolation is preserved even though the lib is no longer literally untouched. New UI reuses the export queue's `role="status"` + logical Tailwind utilities; the new menu item's icon gets `aria-hidden` and its label comes through i18n (`ConversationImportI18nKeys`, with generic labels reused from `ButtonsI18nKeys`).

### Decision 11 — Single export version (v5); no legacy-conversation type

_Tried and reverted:_ this app's own export was briefly bumped from `version: 5` to `version: 6` (`buildExportEnvelope`/`buildDialArchive`), with `6` meaning "current export version — conversations always match the current `Conversation` shape" and `5` flagged via a `needsLegacySync(envelope)` helper as possibly predating the model. A `LegacyConversation`/`LegacyMessage` type (grounded in old chat's actual `Conversation`/`Message` types at `origin/development:libs/shared/src/types/chat.ts`) was introduced for `ExportFormatV5.history`, with `ExportFormatV5 | ExportFormatV6` (`SupportedExportFormats`) as the parsed envelope type.

**Reverted, back to a single `version: 5` `ExportFormat`.** On review, the split had no effect on behavior: `needsLegacySync`'s result (`needsSync`) was threaded through `useConversationImport` but never read by any live branch — only referenced in a `// TODO` for a future normalization step that doesn't exist yet. And `LegacyConversation[]` was cast straight to `Conversation[]` at the one place it was consumed (`parseImportFile`), so the two envelope types carried identical information at runtime; the type distinction never survived past that one line. Keeping two versions and two type hierarchies for a distinction nothing currently branches on was premature — the version bump and the legacy type should be introduced together, in the same change as the actual `normalizeImportedConversation` step (Decision 5), when the distinction would drive real logic instead of sitting inert. Until then, `parseImportEnvelope`'s single `as Conversation[]` cast (with a comment documenting the real old-chat shape gap) is the one honest, visible "we're trusting this as-is" point.

`ExportFolderV5` was renamed to `ExportFolder` (dropping the version suffix, kept from this exploration): unlike conversations, both old and new chat's folder data isn't actively contrasted today — this app has no folder feature yet on this branch, so `folders` is always `[]` in every `buildExportEnvelope` call site, and the field is never read on import. A version-suffixed name reusing the exact same type would have been misleading; a real `LegacyFolder` split was rejected as speculative (there is no observed "current" folder shape to contrast against yet).

### Decision 12 — Archive path validation: traversal-only, no character allowlist

`isValidArchivePath` originally allowlisted `[a-zA-Z0-9._-/]`, which rejected any path containing a space, parentheses, or non-ASCII characters — silently dropping legitimate `res/<path>` entries during both export (`buildDialArchive`'s `skippedPaths`) and import (`parseDialArchive` `continue`s past a failing entry, so the byte map never gets an entry the referencing conversation still points at, surfacing later as a generic "skipped" attachment). This was the actual root cause of a reported bug: importing a genuine old-chat `.dial` archive lost attachments whenever a filename had a space or parenthesis — the archive was fine, the validator was too strict.

`isValidArchivePath` now only rejects empty, `.`, or `..` path segments (traversal/absolute-path defense) — no character restriction. An initial fix added a narrower control-character/backslash disallow-list, reasoned as defense against control-character injection into the eventual upload URL; this was removed too, since `buildImportUploadPath`/`buildUploadPath` already run every filename through `encodeURIComponent`, which neutralizes any unsafe character before it reaches a URL context, making the archive-level character check pure redundant defense that old chat's own (validation-free) archive logic never needed either.

The attachment-skipped warning toast now also names every skipped attachment (`ConversationImportI18nKeys.WarningAttachmentSkipped`, `"{{names}} could not be uploaded and were skipped."`) instead of a generic "one or more attachments" message, so a real skip is immediately diagnosable from the toast alone.

## Risks / Trade-offs

- **Old-chat content-model mismatch** → imported old conversations may render imperfectly (missing timestamps, un-highlighted ratings, dropped model info). Mitigation: documented deferred `normalizeImportedConversation`; the manual E2E explicitly observes old-chat rendering to decide scope.
- **`system`-role / `replay` / `playback` data saved verbatim** → may be ignored or mis-rendered by the new app. Mitigation: same deferred normalization; no data loss on disk (saved as-is), so a later pass can refine.
- **Attachment path/URL mismatch between an old archive's `res/` entries and its message URLs** → an attachment might not be found and be skipped. Mitigation: skip-and-warn keeps the conversation importable; matching uses the same decode logic proven by export.
- **ZIP entry-name / path traversal** → mitigated by reusing `isValidArchivePath` (rejects `.`/`..`/empty path segments) before using any archive path; upload file names run through `getSafeFileName` and `encodeURIComponent`.
- **Large archives / many attachments** → bounded by `runWithConcurrency` (≤5 in flight) and one file at a time; memory is one file's attachments.
- **Regenerated-UUID assumption** → relies on the `{bucket}/{deploymentId}__{name}[__{uuid}]` path scheme staying stable; if the backend scheme changes, id regeneration must follow. Mitigation: unit tests assert the produced subPath shape.

## Migration Plan

Additive and reversible; no data migration, no schema change, no flag.

1. Extract shared `runWithConcurrency` + day-date formatter; export `isValidArchivePath`.
2. Add pure utils (`zip-import.ts`, `import-conversation.ts`) with unit tests (TDD).
3. Add `useConversationImport` hook with tests (mock server-api + notification).
4. Generalize `ImportExportQueue`/job types; add i18n enum + English strings.
5. Wire the "Import" menu item + hidden file input in `ConversationPanelMenu`/`ConversationPanelView`; add optional `AbortSignal` to `saveConversation`.
6. Verify: `nx lint/test/build chat`, RTL/a11y spot-check, module-boundary lint (libs stay clean), manual E2E for new-chat round-trip and old-chat files.

**Rollback:** revert the feature commit(s); nothing else references the new utils/hook/menu item and no endpoint/schema changed.

## Open Questions

- **Old-chat content normalization** — _Deferred (Decision 5):_ import as-is first; add a minimal `normalizeImportedConversation` only if observed rendering breaks.
- **Folders** — _Resolved:_ folder path segments in the conversation id/`folderId` are **preserved** on import (rebased to the user's bucket). The new chat renders everything at root until the folder feature ships (soon), at which point imported conversations already sit in their folders with no rework. The v5 `folders` array (folder metadata/names) is not separately materialized; the id-carried path is the source of truth. The queue-row breadcrumb is derived from these segments.
