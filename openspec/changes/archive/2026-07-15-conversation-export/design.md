## Context

AI DIAL Chat has no way to export conversations. This change adds a purely frontend, additive export feature (see `proposal.md` for motivation and `specs/conversation-export/spec.md` for the normative behavior). It reuses existing BFF endpoints — no new backend surface, no OpenAPI change.

Grounding facts confirmed in the current codebase (these differ from the original request and drive the decisions below):

- **Server-api already has everything needed.** `apps/chat/src/server-api/conversations.api.ts` exposes `getConversation(path)` and `listConversations({ limit, nextToken, path })` (default `limit` 1000, pagination via `nextToken`). `apps/chat/src/server-api/files.api.ts` exposes `downloadFile(bucket, path)` (uses `downloadFileRaw` to preserve stream semantics). File download resolves to `GET /api/v1/files/download?bucket=…&path=…` (via `resolveDialFileDownloadUrl` in `apps/chat/src/utils/dial-file.ts`) — **not** `/api/v1/files/{path}/{name}` as originally assumed.
- **A blob-download helper already exists**: `triggerBlobDownload(blob, filename)` and `prepareDownloadDestination` (File System Access `showSaveFilePicker` with an `<a download>` fallback) in `apps/chat/src/utils/file-download.ts`. Reuse it.
- **No export-format types exist.** `libs/shared` does not exist; the shared lib is `libs/chat-shared` (`@epam/ai-dial-chat-shared`). `ExportFormatV1–V5` / `SupportedExportFormats` are net-new.
- **Conversation types:** `ConversationResponseDto` (generated, re-exported from `@epam/chat-api-client`) is what the server-api wrappers return, and a **concrete domain `Conversation`** interface lives in `libs/chat-shared/src/models/chat.ts:293`. The two are structurally interchangeable in the app (round-tripped via `as` casts). **No `FolderInterface`/conversation-folder model exists** — conversations carry only `folderId: string`. A prior `development` branch has a full legacy import/export implementation (`libs/shared/src/types/import-export.ts`, `apps/chat/src/utils/app/import-export.ts`) used here as the reference for format shape and file naming.
- **`fflate` is not a dependency** — it must be added.
- **The conversation row context menu** (`libs/conversation-panel/.../ConversationRow.tsx`) renders app-supplied `getActions(item): DropdownItem[]`; the app builds those items in `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` (`DropdownItem = { key, label, icon, onClick }`).
- **The header overflow menu** is `apps/chat/src/components/ConversationPanel/ConversationPanelHeaderMenu.tsx` (a `DialDropdown` + `IconDotsVertical`, currently just "Delete all chats"), injected via the library's `headerActions` slot. The rich "Select All / New Folder / Import / Compare Mode" menu from the mock does not exist yet.
- **Toasts** come from `useNotification().showNotification({ variant, message })` (`apps/chat/src/context/NotificationContext.tsx`), `NotificationVariant` from `@epam/ai-dial-ui-kit`.
- **i18n**: every `t()` key must be declared in an enum in `apps/chat/src/constants/translation-keys.ts` (one enum per domain). `ConversationExportI18nKeys` is net-new.

**Design pivot (post-Figma review):** the actual Figma design (node `1231:16906` and neighbors) showed the "Export" context-menu item with a chevron-right icon — a **hover-revealed submenu** with "With attachments"/"Without attachments" as nested items, not a modal — and the "Exporting" progress indicator as a **non-blocking status bar** ("Exporting" + determinate progress bar), not a popup; the user also confirmed explicitly "no modals while exporting, chat shouldn't be blocked" and pointed to Figma toast mockups showing per-conversation-name success/failure toasts. This superseded the modal-based UI originally built in this change; see the updated Decisions 1, 7, 8 below. `libs/conversation-panel`'s `DropdownItem.children` (used identically for "Language"/"Keyboard shortcuts" submenus in `apps/chat/src/components/Navigation/UserMenu.tsx`) already supports hover-triggered nested items, so no new library capability was needed.

**Bug found and fixed via live testing against a real backend:** `ConversationListItemDto.id` (the panel's `contextId`, e.g. `conversations/{bucket}/{name}`) cannot be passed to `getConversation` as-is — the backend's `GET /api/v1/conversations?path=` handler (`apps/chat-api/src/conversations/conversation.service.ts`'s `resolveConversationLocation`) expects `path` as `{bucket}/{name}` (**no** `conversations/` prefix), and naively slash-splits whatever it receives to determine the bucket. Passing the raw id made it treat the literal string `"conversations"` as the bucket, producing a bogus DIAL Core request → `400 Bad Request` / "Invalid request to DIAL Core". The existing `ConversationsContext.tsx` avoids this because its `deleteConversation`/`renameConversation`/`generateConversationTitle` methods internally strip the id via `getConversationPath(normalizeConversationId(id))` (bare `{name}`, which is what *those* backend endpoints separately expect), while `duplicateConversation` uses `normalizeConversationId(id)` alone (`{bucket}/{name}`, matching `duplicateConversation`'s own backend parser) — three different backend path conventions behind one shared frontend id shape. Because `useConversationExport` calls the raw `getConversation` server-api wrapper directly (bypassing `ConversationsContext`), it must apply its own normalization: `normalizeConversationId(id)` alone (strip `conversations/`, **keep** the bucket) — matching what `getConversation`'s backend handler expects, and what the working "open conversation" page already sends. **Do not** chain `getConversationPath` on top here (that additionally strips the bucket, which is correct for delete/rename but would silently break export for shared/public/cross-bucket conversations by always assuming the caller's own session bucket). See Decision 10 and the regression tests in `useConversationExport.spec.ts` (ids like `conversations/bucket-xyz/name` asserting `getConversation` is called with `bucket-xyz/name`).

**Second design pivot (from live testing feedback, with a further Figma reference):** after seeing the non-modal single-status-bar design working live, the user asked for a genuine **export queue/history panel** — bottom-right, supporting multiple concurrent export jobs, each independently showing in-progress/success/failed with a close control on every job and a retry control on failed ones ("imagine if I export 3 different heavy conversations, I wanna see their statuses... we can close every export entry, or retry if export is failed"). This is a materially bigger change than a status bar: it requires (a) a job-queue state model instead of a single `isExporting`/`progress` pair, (b) genuine cancellation via `AbortController` threaded through the server-api layer (confirmed with the user: closing an in-progress job must actually abort the request, not just hide it), and (c) confirmed that toasts and per-job status icons coexist rather than one replacing the other. See Decisions 11–13.

**Third addition (post-implementation review):** finished-only jobs (success/failed) lost their per-row close control once close semantics were reconciled with the shipped code (see Decision 13), so the queue is now emptied via the panel-level close in the header. To avoid silently discarding an in-progress export or a failed job the user hasn't retried yet, the panel-level close now shows a `DialConfirmationPopup` whenever the queue contains anything other than all-succeeded jobs; an all-succeeded queue still closes immediately with no prompt. This is a deliberate, narrow exception to the "no modal in this feature" rule established below — it applies only to this one confirmation, not to the queue panel or the export entry points, which remain modal-free. See Decision 14.

## Goals / Non-Goals

**Goals:**

- Export a single conversation to `.json` (no attachments) or `.dial` ZIP (with attachments) from its context menu.
- Export all conversations to a single `.json` (no attachments) from the header menu, following list pagination.
- Produce a versioned, re-importable JSON v5 envelope `{ version: 5, history, folders }`.
- Keep the `libs/conversation-panel` library free of any API/host/i18n knowledge — wire everything at the app edge.
- Reuse existing server-api wrappers and the existing blob-download helper; add only `fflate`.

**Non-Goals:**

- No import feature (the format is designed to be re-importable later, but import is out of scope).
- No bulk ZIP export (all-conversations-with-attachments) — memory-unbounded, deferred.
- No new backend endpoint, no OpenAPI/contract change, no new authorization rule.
- No feature flag / `ENABLED_FEATURES` gating.
- No analytics/telemetry events (not required for this additive UI action).
- No conversation-folder tree model — `folders` may be emitted empty until such a model exists.

## Decisions

### Decision 1 — Layered architecture: pure utils + orchestration hook + thin UI

Split responsibilities so logic is testable and the lib stays clean:

- **Pure utils** (`apps/chat/src/utils/`, no React/API):
  - `export-conversation.ts` — `buildExportEnvelope(conversations, folders): ExportFormatV5`, `serializeExportEnvelope(envelope): Blob`, and `buildExportFileName(kind, appName, date): string`. No field-stripping step: this branch's domain `Conversation` has no `publicationInfo` field and no publication/sharing subsystem (unlike `development`'s `ShareEntity.publicationInfo`) — resolved to drop the `excludePublicationInfo` requirement rather than keep dead code against a field that can never be set; revisit if publication/sharing is ported here later.
  - `zip-export.ts` — `buildDialArchive({ envelope, attachments }): Promise<Blob>` using `fflate`, laying attachments under `res/<relative-path>/<filename>` and validating each path against `^[a-zA-Z0-9._\-/]+$`.
  - Naming/style per repo convention: kebab-case files, named `export const` arrows with explicit return types, tests in `apps/chat/src/utils/tests/`.
- **Orchestration hook** (`apps/chat/src/hooks/useConversationExport.ts`): owns `jobs: ExportJob[]` (the queue), calls server-api wrappers with an `AbortSignal` per job, drives bounded-concurrency attachment fetches, maps errors to success/failure/warning `showNotification` calls plus the job's own status, and triggers the download via `triggerBlobDownload`. **Revised across iterations:** post-Figma-review it briefly carried a per-job step-count `progress`; that was later dropped in favour of a **panel-level aggregate** progress bar (fraction of jobs finished), since the queue never rendered per-job progress. The single `isExporting`/`progress` pair was replaced entirely with a job queue supporting concurrent exports, real cancellation, and retry — see Decisions 11–13.
- **UI**: an "Export" `DropdownItem` with `children` (native ui-kit hover submenu — no modal component), a non-modal `ImportExportQueue` panel, plus the two menu entry points wired in existing app components. The originally-built `ConversationExportModal` and the intermediate single-job `ConversationExportStatusBar` were both deleted as the design evolved.

_Alternative considered:_ put logic directly in components. Rejected — untestable, violates the small-pure-function convention, and would tempt API calls into render paths.

### Decision 2 — Reuse existing download + server-api primitives, add only `fflate`

Use `triggerBlobDownload` / `prepareDownloadDestination` (existing) for the actual save, and `getConversation` / `listConversations` / `downloadFile` (existing) for data. Add `fflate` as the single new dependency for ZIP building (chosen because the request specified it and it is a tiny, fast, dependency-free zipper; it is not yet installed).

_Alternative considered:_ `jszip`. Rejected — heavier, and `fflate` was the stated choice. _Alternative considered:_ reuse the server-side `downloadArchive` in `files.api.ts`. Rejected — that archives files server-side; it cannot embed our client-built conversation JSON, and export must bundle both.

### Decision 3 — The `folders` array and the missing folder model

The v5 envelope keeps a `folders` field for format compatibility (`development` uses `folders: FolderInterface[]`), but the current branch has **no** conversation-folder model — `Conversation` carries only `folderId: string` and no `FolderInterface`/`ShareEntity` exists. Define a **minimal net-new, version-scoped** `ExportFolderV5` type (`{ id: string; name: string; folderId?: string }`) capturing just what a future importer needs, and emit `folders: []` for now (each conversation still carries its `folderId`). This preserves the versioned shape without porting the legacy folder subsystem.

_Alternative considered:_ omit `folders` entirely. Rejected — it would diverge from the documented v5 shape and break a future importer. _Alternative considered:_ port the legacy `FolderInterface extends ShareEntity`. Rejected — it drags in `ShareEntity`, share/publication concepts, and folder-type enums that don't exist on this branch. _Alternative considered:_ synthesize folder entries from distinct `folderId`s. Deferred — no names/hierarchy are available, so empty is the honest representation today.

### Decision 4 — Export-format types live in `libs/chat-shared`; start at v5 with a version-scoped conversation type

Add the export-format types under `libs/chat-shared/src/types/import-export.ts` (types only, no logic — matches the lib's charter) and export them from the lib's public entrypoint (`libs/chat-shared/src/index.ts`).

**Resolved decisions:**

- **Start at v5.** Only `ExportFormatV5` is defined now (the shape this app produces). `ExportFormatV1`–`ExportFormatV3` are **not** created. `SupportedExportFormats` is `ExportFormatV5` today and grows to `ExportFormatV4 | ExportFormatV5` when the future import feature lands; **versions < 4 are never supported**.
- **Dedicated, version-scoped element type (not the generated DTO, not generic).** `history` is typed `ExportConversationV5[]`, where `ExportConversationV5` is a named alias of the in-lib domain `Conversation` (`../models/chat`). This gives the format its own versioned name while avoiding duplication; if the domain model later diverges from what v5 files must hold, it is frozen into a standalone interface and the format bumps to `ExportFormatV6`. It is **not** `ConversationResponseDto` (a `type:shared` lib is forbidden by `@nx/enforce-module-boundaries` from importing `@epam/chat-api-client`) — this is safe because the DTO and the domain `Conversation` are structurally interchangeable in this codebase (already round-tripped via `as` casts), so the objects returned by `getConversation`/`listConversations` serialize cleanly.

Concretely:

```ts
// libs/chat-shared/src/types/import-export.ts
import { Conversation } from '../models/chat';

export interface ExportFolderV5 {
  id: string;
  name: string;
  folderId?: string;
}

/** Conversation as serialized in export v5. Fork into a frozen interface and
 *  bump to V6 when the domain model diverges from what v5 files must hold. */
export type ExportConversationV5 = Conversation;

export interface ExportFormatV5 {
  version: 5;
  history: ExportConversationV5[];
  folders: ExportFolderV5[];
}

export type LatestExportFormat = ExportFormatV5;
// grows to (ExportFormatV4 | ExportFormatV5) when import lands; < 4 unsupported
export type SupportedExportFormats = ExportFormatV5;
```

_Alternative considered:_ define the types in `apps/chat`. Rejected — a future importer and other apps should share one source of truth; the shared lib is the right home. _Alternative considered:_ bind `history` to `ConversationResponseDto`. Rejected — boundary violation for a `type:shared` lib. _Alternative considered:_ a fully self-contained/frozen `ExportConversationV5` duplicating the whole message/attachment tree. Rejected for now — heavier and prone to silently dropping newly added conversation fields on export; revisit when import parsing of old files makes freezing worthwhile.

### Decision 5 — Bounded-concurrency attachment fetching

Fetch attachments with a small worker pool (≤ 5 in flight) inside `useConversationExport`, awaiting `downloadFile(bucket, path)` per attachment. A failed or path-invalid attachment is skipped with a `Warning` toast; the archive is still produced. This bounds request pressure and keeps memory to one conversation's worth of blobs.

_Alternative considered:_ fetch all in parallel. Rejected — request floods and memory spikes. _Alternative considered:_ fully sequential. Rejected — needlessly slow for many small files.

### Decision 6 — Library isolation preserved

`libs/conversation-panel` gains nothing. The app supplies the "Export" `DropdownItem` through the existing `getActions` prop and the "Export all" item through the existing `headerActions` slot. No API client, server-api, context, routing, `useTranslation`, `fflate`, or `process.env` import enters the lib (guarded by `@nx/enforce-module-boundaries` + a spec scenario). App name for filenames is resolved at the app edge and passed into the pure util as a plain string (see Decision 9).

### Decision 9 — File name and app-name source

Mirror `development`'s naming exactly: `getCurrentDate()` → `${year}-${month}-${day}` with **zero-padded** month/day (e.g. `2026-07-10`), and `getDownloadName({ name, exportType, extension })` → `<date>_<namePart>_<exportType>.<ext>` where `namePart = name ? name.toLowerCase().replaceAll(' ', '_') : 'ai_dial'`. Export types: `chat_conversation` (single .json), `chat_with_attachments` (single .dial), `chat_conversations_history` (all .json).

**Resolved — app-name source:** the current branch exposes **no** app display-name to the frontend. `AppConfigContext` carries only `{ asrModelId, transcribeSizeLimitBytes, defaultDeploymentId }` + `features` + `metadata`; a repo-wide grep for `appName`/`appTitle` is empty. On `development` this value was `SettingsSelectors.selectAppName` (Redux, default `'DIAL'`), which does not exist in this Context/hooks rewrite. Therefore the app passes the constant default `'ai_dial'` (matching `development`'s `getDownloadFileName` fallback) as `name`. This keeps the feature frontend-only.

_Alternative considered:_ surface the backend `ClientConfigResponseDto.appId` (example `'chat-ui'`) through `AppConfigContext` and use it as `name`. Deferred — `appId` is a machine identifier, not a brand name, and wiring it adds context surface for no user-visible benefit today; it remains the clean upgrade path if a config-driven name is later desired (no backend change required, since `appId` is already returned).

### Decision 7 — Error mapping and logging (revised: unified per-conversation toast text, not per-status)

**Revised after the Figma toast mockups.** The design shows one generic toast per outcome, naming the conversation, rather than a different message per HTTP status. `classifyExportError` now only distinguishes `isUnauthorized` (401 → defer to the global unauthorized handler, no toast) and `isNotFound` (404 → in export-all, skip that conversation with a per-title `Error` toast and continue); every other status (403/429/5xx) collapses to the same generic failure path — `Error` toast naming the conversation for single export, or a generic export-all failure toast that aborts the operation. Every successful export (single or all) now also raises a `Success` toast. All outcomes still `console.error` without tokens/cookies/bodies. This matches the notification pattern already used in `ConversationPanelView` and `ConversationPanelHeaderMenu`, extended with `title`-bearing toasts and i18next interpolation (`t(key, { title })`).

_Alternative considered:_ keep the original 403/404/429/5xx-differentiated messages. Rejected — the Figma toast design ("'Dynamic Weather Elements' was not exported. Please try again.") shows one unified message per conversation; differentiating by status added complexity the design doesn't call for.

### Decision 8 — Accessibility & RTL (revised: no modal, submenu + non-modal status bar)

**Revised after the Figma review — no modal/popup is used for the export entry points or the queue panel itself** (the sole exception, added later, is the queue's own close-confirmation dialog — see Decision 14). The "Export" submenu relies entirely on the ui-kit's existing `DialDropdown`/`DropdownItem.children` keyboard and hover/focus handling (the same mechanism already shipping for "Language"/"Keyboard shortcuts" in `UserMenu.tsx`) — no bespoke focus-trap or dialog semantics were added. The status bar is `role="status"` + `aria-live="polite"` but is a plain fixed-position `<div>`, not a `DialPopup`: no scrim, no focus trap, pointer events pass through to the rest of the page so the chat stays usable while an export runs. All new UI uses Tailwind **logical** utilities (`ms/me`, `ps/pe`, `text-start/end`, `start/end`); the ui-kit's own submenu-open chevron already follows the RTL convention, so no new directional icon was introduced. Icons use `@tabler/icons-react` (e.g. `IconDownload`), no inline SVG.

_Alternative considered:_ keep the modal but restyle it as non-blocking. Rejected — a modal is inherently blocking (focus trap, scrim); the user's explicit requirement ("chat shouldn't be blocked") and the Figma design both rule out any modal component for this feature.

### Decision 10 — Conversation-id normalization before `getConversation` (bug fix from live testing)

`useConversationExport` calls `getConversation(normalizeConversationId(id))` — never the raw `ConversationListItemDto.id` — at both call sites (`exportSingle`'s conversation fetch and `exportAll`'s per-item fetch). `normalizeConversationId` (`apps/chat/src/constants/routes.ts`) strips only the leading `conversations/` domain segment, producing `{bucket}/{name}`, which is exactly what `getConversation`'s backend handler (`apps/chat-api/src/conversations/conversation.service.ts`'s `resolveConversationLocation`) expects and what the working "open conversation" page already sends. It deliberately does **not** additionally strip the bucket (i.e. does not chain `getConversationPath`), because that would default every export to the caller's own session bucket and silently produce the wrong (or a 404) result for shared/public/cross-bucket conversations.

_Alternative considered:_ reuse `ConversationsContext`'s `getConversation`-adjacent methods instead of calling the server-api wrapper directly. Not applicable — the context has no generic "fetch conversation content" method; `getConversation` is only ever inlined at specific use sites (`useConversationStream.ts`, `ConversationsContext.tsx` itself), each already normalizing inline. `useConversationExport` follows the same inline-normalization convention rather than introducing a new context method for a single additional caller.

### Decision 11 — Job-queue state model instead of a single in-flight export

`useConversationExport` owns `jobs: ExportJob[]` (`{ id, label, status: InProgress | Success | Failed, progress: { completed, total } | null }`, `apps/chat/src/types/conversation-export.ts`) rather than one shared `isExporting`/`progress` pair. `exportSingle`/`exportAll` each: generate a job id (`crypto.randomUUID()`, matching the existing convention in `NotificationContext.tsx`), append a new `InProgress` job immediately, and run the actual work asynchronously against that specific job id — multiple calls run fully concurrently, each updating only its own row via a functional `setJobs` update keyed by id. This is what makes "export 3 heavy conversations and watch all three independently" possible; a single shared flag/progress pair cannot represent more than one in-flight export at a time.

_Alternative considered:_ keep a single `isExporting` boolean and maintain an internal FIFO queue that runs jobs one at a time. Rejected — the user explicitly wants concurrent, independently-tracked exports ("imagine if I export 3 different heavy conversations, I wanna see their statuses"), not a serialized queue; serializing would also make heavy exports block each other for no technical reason (each is independent I/O).

### Decision 12 — Real cancellation via `AbortController`, threaded through the server-api layer

Dismissing an in-progress job actually cancels its work, per the user's explicit choice. Each job gets its own `AbortController` (stored in a `useRef<Map<jobId, AbortController>>`, not React state, since it's not rendered); `dismissJob` calls `.abort()` on the job's controller before removing it. To make abortion effective, `getConversation`, `listConversations` (`apps/chat/src/server-api/conversations.api.ts`), and `downloadFile` (`apps/chat/src/server-api/files.api.ts`) were extended with an optional trailing `signal?: AbortSignal` parameter, threaded to the generated client's `initOverrides` — the same `(path, signal?)` shape `watchConversation` already used, so this is a repo-established convention, not a new one. The wrapper only appends the `initOverrides` argument when a signal is actually provided (`...(signal ? [{ signal }] : [])`), so every existing call site and its existing tests are unaffected (calling with one argument continues to call the generated method with exactly one argument). Inside `useConversationExport`, every loop and `runWithConcurrency` worker checks `signal.aborted` before/after each await and returns early without touching job state or showing toasts once aborted — an aborted job is being removed anyway, so no error/warning toast should appear for it.

_Alternative considered:_ dismiss = hide only, let the work finish in the background. Rejected per the user's explicit answer — silent background work risks a surprise download after the user believed they'd cancelled, and wastes network/CPU for work no longer wanted.

### Decision 13 — Retry reuses the same job id

Each job stores its own retry closure in a `useRef<Map<jobId, () => Promise<void>>>` (captured at `exportSingle`/`exportAll` call time, closing over the original `conversationId`/`title`/`mode`). `retryJob(jobId)` looks up and invokes that closure, which resets the existing job's status to `InProgress` (`progress: null`) and re-runs the same underlying async function with a fresh `AbortController` — no new job/row is created. This matches the Figma design (a failed row's retry icon updates that same row) and the user's literal wording ("retry if export is failed").

_Alternative considered:_ retry by calling `exportSingle`/`exportAll` again with the stored parameters, producing a new job. Rejected — would leave the old failed row behind (or require separately removing it), and the Figma mock shows the same row transitioning, not a second row appearing.

### Decision 14 — Confirm panel-level close only when it would discard unfinished work

Once finished (success/failed) rows lost their per-row close control (Decision 13's shipped implementation reconciled with the panel-level-close design — see the third addition above), the panel-level close in the header became the only way to clear a finished job from the queue. That control now shows a `DialConfirmationPopup` before clearing, but **only** when the queue contains a job that is still `InProgress` or `Failed` — closing would either abort an in-flight export or discard the record of a failure the user hasn't retried or acknowledged yet. When every job has already succeeded, closing has nothing to lose, so it clears immediately with no prompt. The popup passes an explicit `cancelLabel={t(ButtonsI18nKeys.Cancel)}`, matching the existing convention in `ConversationPanelHeaderMenu.tsx`'s own delete-confirmation popup, rather than relying on the ui-kit's built-in (hardcoded-English, non-localized) default label.

_Alternative considered:_ always clear immediately with no confirmation, matching the panel's otherwise-non-modal design. Rejected — silently aborting in-progress network requests or discarding a failed job's row (with no way to retry it afterward) is a real, easily-triggered data-loss footgun for a single accidental click on a small icon button; a lightweight confirmation only in the cases where something is actually at risk is a reasonable, narrow exception to "no modal in this feature."

## Risks / Trade-offs

- **Conversation-id shape mismatch across backend endpoints** → `getConversation`, `deleteConversation`/`renameConversation`, and `duplicateConversation` each expect a differently-normalized form of the same frontend id (`{bucket}/{name}`, bare `{name}`, and `{bucket}/{name}` respectively) — a real, unrelated pre-existing inconsistency this change had to work around (Decision 10) rather than fix; caught only via live manual testing, not by mocked unit tests, since the mocks never modeled the real id shape until a regression test was added afterward.
- **Missing folder model** → v5 `folders` is empty for now; documented as a known limitation and a future extension point. Importers must tolerate `folders: []`.
- **`chat-shared` cannot import generated types** (a `type:shared` lib may not import `@epam/chat-api-client`) → resolved by binding `ExportFormatV5.history` to the in-lib domain `Conversation` (Decision 4), not `ConversationResponseDto`. Verify with `nx lint chat-shared`.
- **New dependency `fflate`** → supply-chain surface; mitigated by it being a small, widely-used, zero-dependency package pinned in `package.json`.
- **Large histories (export-all)** → many sequential `getConversation` calls; mitigated by the queue panel's progress display and pagination; still bounded by no-attachments. If it proves slow, batch with the same ≤5 pool (future).
- **Unbounded concurrent jobs** → nothing currently caps how many exports a user can start simultaneously (e.g. clicking "Export" on many conversations in a row); each is independent I/O bounded by its own ≤5 attachment pool, but there is no global cap across jobs. Acceptable for now given the realistic UI-driven click rate; revisit if abuse/perf issues surface.
- **`AbortSignal` plumbing is new surface on shared server-api wrappers** → `getConversation`/`listConversations`/`downloadFile` gained an optional trailing parameter; mitigated by the conditional-spread call pattern (`...(signal ? [{signal}] : [])`) that preserves the exact previous call shape (and passing tests) when no signal is given, and by dedicated passthrough tests for the new parameter.
- **Memory during ZIP export** → bounded to a single conversation's attachments; acceptable. Bulk ZIP stays out of scope.
- **File System Access API variance** → `prepareDownloadDestination` already falls back to `<a download>`, so browsers without `showSaveFilePicker` still work.
- **ZIP entry-name injection / path traversal** → every attachment path validated against `^[a-zA-Z0-9._\-/]+$` before being written; failures are skipped. **Caught during implementation:** that character class alone does not block traversal (`.`, `..`, and `/` are all permitted characters, so `../../etc/passwd` matches it) — `isValidArchivePath` in `zip-export.ts` additionally splits on `/` and rejects empty segments or `.`/`..` segments. Filenames are template + date only — no user text.

## Migration Plan

Additive and reversible; no data migration, no schema change, no flag.

1. Add `fflate` to `package.json`; install.
2. Add export-format types to `libs/chat-shared`; verify `nx lint/build chat-shared`.
3. Add pure utils (`export-conversation.ts`, `zip-export.ts`) with unit tests (TDD).
4. Add `useConversationExport` hook with tests (mock server-api + notification).
5. Add the "Export" submenu (`DropdownItem.children`, no modal) + the non-modal `ImportExportQueue` panel; add i18n keys/enum + English strings (including success/failure toast text and job-queue labels).
6. Wire the "Export" `DropdownItem` in `ConversationPanelView` and "Export all conversations" in `ConversationPanelHeaderMenu`.
7. Thread `AbortSignal` through `getConversation`/`listConversations`/`downloadFile`; rework `useConversationExport` into a job queue (`jobs`, `dismissJob`, `retryJob`) with real cancellation and same-id retry.
8. Verify: `nx lint/test/build chat` and `nx lint chat-shared`, RTL spot-check, module-boundary lint (lib stays clean).

**Rollback:** revert the feature commit(s). Because nothing else references the new utils/hook/menu items and no endpoint/schema changed, removal is clean. Phased delivery: ship JSON export (single + all) first, then the `.dial` ZIP path.

## Open Questions

- **App name source for filenames** — _Resolved (Decision 9):_ no app display-name exists on `development-1.0`; pass the constant `'ai_dial'` (mirrors `development`). The backend `appId` (`'chat-ui'`) is the future config-driven upgrade path if wanted.
- **`chat-shared` history typing** — _Resolved (Decision 4):_ start at v5 only; `history: ExportConversationV5[]` where `ExportConversationV5` is a version-scoped alias of the in-lib domain `Conversation`; not `ConversationResponseDto`, not generic. `SupportedExportFormats` grows to `ExportFormatV4 | ExportFormatV5` with a future import; < 4 unsupported.
- **Folder representation** — _Resolved (Decision 3):_ `folders` stays `[]` for now with a minimal net-new version-scoped `ExportFolderV5` type; revisit if/when a conversation-folder model lands.
- **Attachment enumeration** — confirm the exact field(s) on the domain `Conversation`/`Message` that list attachment `bucket`+`path` (e.g. message `attachments` / `custom_content`) so the ZIP path derives `res/<relative-path>/<filename>` correctly. To be pinned during task 2.3/4.2.
