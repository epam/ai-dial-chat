## Why

Users have no way to back up, share, or archive their conversation history outside the app. If a conversation is deleted or the account is lost, the data is gone. Export is the first half of a round-trip (export → import) that also enables moving conversations between environments and sharing them as files. The feature is purely additive and frontend-only — it reuses existing BFF endpoints and introduces no new backend surface.

## What Changes

- Add the ability to **export a single conversation** from its context menu, with a choice of format:
  - Without attachments → a `.json` file (JSON export format v5).
  - With attachments → a `.dial` ZIP archive bundling the conversation JSON plus every referenced attachment.
- Add the ability to **export all conversations** from the conversation panel header menu → a single `.json` file (without attachments; bulk ZIP is explicitly out of scope).
- Add a **hover-revealed submenu** on the "Export" context-menu item (with / without attachments) — matches the Figma design's chevron-right affordance and the existing "Language"/"Keyboard shortcuts" nested-menu pattern in `UserMenu.tsx`. **No modal is used for the export entry points.**
- Add a **non-modal, non-blocking export queue panel** (bottom-end corner) for every export operation — single-conversation JSON, single-conversation ZIP, and export-all alike — so the user has one consistent place to see the status of everything they've triggered, even a JSON export that completes almost immediately; it shows a determinate **aggregate** progress bar (fraction of jobs finished) and never blocks interaction with the rest of the app. The queue supports **multiple concurrent export jobs** (e.g. exporting several heavy conversations at once), each independently tracked as in-progress / success / failed; an **in-progress** job has a per-row close that **cancels** its underlying request via `AbortController` (it isn't just hidden), a **failed** job can be **retried** in place (same job id, same parameters), and a panel-level close clears the whole queue at once (aborting anything still running). If every job has already succeeded, the panel-level close clears the queue immediately; if any job is still in progress or failed, it first shows a `DialConfirmationPopup` so the user doesn't lose track of unfinished or unretried work — the one deliberate modal in this otherwise non-modal feature. A failed-count badge appears in the header when any job has failed.
- Add **success and failure toasts** naming the affected conversation(s), matching the Figma toast mockups (e.g. `"Simple Greeting and Response" exported.` / `"Dynamic Weather Elements" was not exported. Please try again.`).
- Serialize conversations into the versioned **JSON v5 envelope** `{ version: 5, history, folders }` so exports are re-importable in the future.
- Serialize each conversation's data verbatim (no field-stripping — this branch has no `publicationInfo`/publication-sharing concept to strip; see design.md).
- Fetch attachments through the existing file-download BFF endpoint, cap parallel fetches at a small concurrency limit, and lay them out inside the ZIP under a `res/<relative-path>/<filename>` structure.
- Add new i18n keys and (if missing) the export-format type definitions to shared types.

No **BREAKING** changes. No new backend endpoints, no OpenAPI contract changes, no feature flag.

## Capabilities

### New Capabilities

- `conversation-export`: Client-side export of one or all conversations to a downloadable file. Covers the JSON v5 serialization format, the plain-JSON download path, the `.dial` ZIP-with-attachments path (bounded-concurrency attachment fetching, path-allowlist validation, `res/…` archive layout), deterministic file naming from a fixed template, the two UI entry points (per-conversation context-menu item with a hover-revealed with/without-attachments submenu + panel-header "export all" item) and their wiring, the non-modal export **queue panel** supporting concurrent jobs with an aggregate finished-vs-total progress bar, real cancellation on dismiss of an in-progress job (plus a panel-level close that clears the queue), and same-id retry on failure, pagination over the full conversation list for export-all, and success/failure toasts (named per conversation, unauthorized-defers-silently, per-attachment skip as a warning).

### Modified Capabilities

<!-- None. The conversation-panel library exposes an opaque `headerActions` slot and
     per-item action callbacks (see specs/conversation-panel-header-menu), so the new
     export menu items are injected by the app without changing any library spec.
     No existing capability's requirements change. -->

## Impact

- **New app utilities** (`apps/chat/src/utils/`): pure functions (named `export const` arrows, kebab-case files, tests under `utils/tests/`) for JSON v5 serialization and for building the `.dial` ZIP. They accept conversation data and return a `Blob`; browser download reuses the existing `triggerBlobDownload` / `prepareDownloadDestination` helpers in `apps/chat/src/utils/file-download.ts` rather than hand-rolling `<a download>`.
- **App UI wiring**: a new "Export" item (with a nested `children` submenu — no modal) in the app's `getActions` `DropdownItem[]` for a conversation row (`apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`) and a new "Export all conversations" item added to the header overflow menu (`apps/chat/src/components/ConversationPanel/ConversationPanelHeaderMenu.tsx`, today only "Delete all chats", injected via `headerActions`), plus a non-modal `ImportExportQueue` panel and a `useConversationExport` hook that owns the export job queue (`jobs: ExportJob[]`, `dismissJob`, `retryJob`).
- **Server-api layer** (`apps/chat/src/server-api/`): reuses existing `getConversation(path, signal?)`, `listConversations({ limit, nextToken, path }, signal?)`, and `downloadFile(bucket, path, signal?)` wrappers — each extended with an optional trailing `AbortSignal` (matching the existing `watchConversation(path, signal?)` convention) so a dismissed job can genuinely cancel its in-flight request; export-all must iterate `nextToken` (default page `limit` is 1000) so large histories are not silently truncated.
- **Shared types** (`libs/chat-shared`, package `@epam/ai-dial-chat-shared`): add net-new export-format types in `src/types/import-export.ts` (re-exported from the lib entrypoint) — none exist on this branch. The format **starts at v5**: define only `ExportFormatV5` (no `ExportFormatV1`–`V3`); `SupportedExportFormats = ExportFormatV5` now, growing to `ExportFormatV4 | ExportFormatV5` when a future import feature lands (versions < 4 unsupported). `history` uses a dedicated, version-scoped `ExportConversationV5` (a named alias of the in-lib domain `Conversation` from `src/models/chat.ts`) — **not** the generated `ConversationResponseDto` (forbidden import for a `type:shared` lib) and not generic. There is currently **no** conversation-folder model, so `folders` uses a minimal net-new `ExportFolderV5` and may be empty until a folder model exists.
- **i18n**: new `ConversationExportI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts` plus English defaults in the locale file (every `t()` key must be declared in that enum per project rule).
- **Dependencies**: add `fflate` to `package.json` for ZIP creation — it is **not** currently a dependency.
- **BFF / backend**: none — export consumes existing endpoints (`GET` conversation list, `GET` conversation content, `GET /api/v1/files/download`) as-is. Attachments are same-origin, so session cookies flow automatically; no CORS changes.
- **Libraries (`libs/*`)**: unchanged. Per the library-isolation rule, all API/host knowledge (endpoints, download triggering, i18n) stays at the app edge; libs only expose generic slots/callbacks that the app fills.
