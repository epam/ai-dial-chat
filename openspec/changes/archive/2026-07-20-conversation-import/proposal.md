## Why

The app can **export** a conversation (change `2026-07-15-conversation-export`) but cannot bring one back in, so the round-trip is only half-complete: users can't restore a backup, move a conversation between environments, or carry conversations over from the previous ("old") chat. This change adds the **import** half.

## What Changes

- Add the ability to **import conversations** from the conversation panel header menu via a hidden file picker accepting `.json`, `.dial`, and `.zip`.
- Accept the **v5 export envelope** (`{ version: 5, history, folders }`) produced by **both** the old chat (`development`) and the new chat (`development-1.0`):
  - `.json` → conversations only (no attachments).
  - `.dial` / `.zip` → the v5 envelope plus bundled attachments under `res/<path>`.
- Detect the archive's conversation-JSON entry under **both** names — `conversation.json` (new) and `conversations/conversations_history.json` (old) — so old archives open.
- **Re-upload archive attachments** to a day-level folder `uploads/<YYYY-MM-DD>/` in the current user's bucket and **rewrite** each conversation's attachment URLs (`custom_content.attachments[].url` / `reference_url`) to the new upload locations.
- **Regenerate a fresh UUID** in each imported conversation's id/path so every import is saved as a brand-new conversation — **no** duplicate/replace/skip dialog.
- Persist each conversation via the existing `saveConversation` server-api wrapper (into the current user's bucket); refresh the conversation list afterward.
- Reuse the existing non-modal **ImportExportQueue** panel (rendered as two separate instances, one for import jobs and one for export jobs, so they never appear merged under one misleading title) to show per-file import jobs (in-progress / success / failed, with dismiss and retry), plus success/failure/warning toasts (now naming every skipped attachment, not just a generic count) and an unsupported-format toast.
- **Fix two real bugs found while testing against genuine old-chat files:** old chat's raw resource id prefix (`conversations/{bucket}/{path}` vs. this app's `{bucket}/{path}`) was breaking id rebasing and the queue's folder breadcrumb; and an overly strict archive-path character allowlist was silently dropping legitimate attachments whose filenames had a space, parenthesis, or non-ASCII character.
- Add new i18n keys for the import UI.

Conversations are imported **as-is** (no content-model normalization) in this iteration — see design.md for the documented old-chat content-model gap and the deferred follow-up. A version bump (`5`→`6`) plus a typed `LegacyConversation` shape were explored to flag old-chat-shaped conversations for that future normalization pass, then reverted (see design.md Decision 11) since nothing yet branches on the distinction — both this app and old chat still write `version: 5`. No **BREAKING** changes, no new backend endpoint, no OpenAPI/contract change, no feature flag.

## Capabilities

### New Capabilities

- `conversation-import`: Client-side import of one export file (`.json` or `.dial`/`.zip`, v5 envelope, old- or new-chat origin) into the current user's conversations. Covers file-picker entry point and accepted types, tolerant parsing of both archive JSON-entry names, bounded-concurrency attachment re-upload to `uploads/<YYYY-MM-DD>/` with in-batch name-collision handling and path-allowlist validation, attachment-URL rewriting, fresh-UUID id/path regeneration for collision-free saves, per-file job queue with cancel/retry, and success/failure/warning/unsupported-format notifications.

### Modified Capabilities

- `conversation-export`: the "Import" entry is an app-level menu item injected through the conversation panel's existing header-menu slot (same mechanism the export-all item uses), so export's *requirements* don't change. Its *output* is affected in smaller ways: the export/import menu icons changed to a matched `IconFileArrowRight`/`IconFileArrowLeft` pair, the "Export all conversations" label was shortened to "Export", and several `ImportExportQueue` chrome strings were reworded to be generic (export- and import-neutral) rather than export-specific. Export's own envelope version stays `5` — a `6` bump was tried and reverted (see design.md Decision 11).

## Impact

- **New app utilities** (`apps/chat/src/utils/`): `zip-import.ts` (parse `.dial`/`.zip`) and `import-conversation.ts` (envelope parsing, fresh-UUID id/path regeneration, attachment-URL rewrite, `uploads/<YYYY-MM-DD>/` upload-path builder). `isValidArchivePath` is reused from `zip-export.ts`; `runWithConcurrency` and the day-date formatter are extracted to shared utils so export and import share them.
- **New orchestration hook** `apps/chat/src/hooks/useConversationImport.ts` mirroring `useConversationExport` (job queue, `AbortController` per job, toasts).
- **App UI wiring**: an "Import" item in `ConversationPanelMenu` (new `onImport` prop) + a hidden `<input type="file">` and the import hook mounted in `ConversationPanelView`; the existing `ImportExportQueue` component is generalized (shared job type, presentational) and mounted as two separate instances — one for import jobs, one for export jobs — stacked in a shared fixed-position container rather than merged into one list.
- **Server-api layer**: `saveConversation` (`conversations.api.ts`) gains an optional trailing `AbortSignal` (same conditional-spread convention already used by `getConversation`/`listConversations`); `uploadFile` (already signal-capable) is reused for attachment upload.
- **Shared types** (`libs/chat-shared/src/models/import-export.ts`): renamed `ExportFolderV5` → `ExportFolder` (the version suffix was misleading since folder data isn't contrasted between envelope versions). All plain data-shape types — no generated-client import, no host/app/API knowledge, module boundaries preserved.
- **i18n**: new `ConversationImportI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts` + English strings; generic labels reused from `ButtonsI18nKeys`.
- **Dependencies / BFF / backend**: none — `fflate` (added by export) is reused for unzip; import consumes existing endpoints (`uploadFile`, `saveConversation`, conversation list refresh).
