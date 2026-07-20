## 1. Shared primitives (prep)

- [x] 1.1 Export `isValidArchivePath` from `apps/chat/src/utils/zip-export.ts`.
- [x] 1.2 Extract `runWithConcurrency` from `useConversationExport.ts` into a shared util (e.g. `apps/chat/src/utils/async.ts`) with a unit test; update the export hook to import it.
- [x] 1.3 Extract the `YYYY-MM-DD` date formatter (currently private `formatExportDate` in `export-conversation.ts`) into a shared util (e.g. `apps/chat/src/utils/date.ts`) with a unit test; update export to use it.

## 2. Pure import utils (TDD)

- [x] 2.1 Add `apps/chat/src/utils/import-conversation.ts` `parseImportEnvelope(text)`: JSON.parse + validate `version === 5` and array `history`; reject otherwise with a clear error. Tests: valid v5, wrong/missing version, malformed JSON.
- [x] 2.2 Add `buildImportUploadPath(fileName, date)` to `build-upload-path.ts` (alongside `buildUploadPath`) producing `uploads/<YYYY-MM-DD>/<encoded-safe-name>` (reuse the `getSafeFileName` sanitizer) — a pure builder with no de-duplication. Tests: day-folder format, name sanitization.
- [x] 2.3 Add `regenerateConversationId(conversation, bucket)` returning `{ conversation, subPath }`: rebase the id to the user bucket and regenerate the trailing UUID while **preserving folder path segments** (`{bucket}/[<folders>/]{deploymentId}__{name}__{uuid}`); set `folderId = {bucket}[/<folders>]`; `subPath = [<folders>/]{deploymentId}__{name}__{uuid}`. Tests: unique subPath, bucket rebase, root conversation (no folders), foldered conversation (segments preserved).
- [x] 2.4 Add `rewriteAttachmentUrls(conversation, urlMap)` (immutable) mapping old `files/{bucket}/{path}` refs (`url` + `reference_url`) to new upload URLs. Tests: rewrite both fields, leave unmatched refs untouched.
- [x] 2.5 Add `apps/chat/src/utils/zip-import.ts` `parseDialArchive(file)` (fflate unzip) resolving the envelope from `conversation.json` OR `conversations/conversations_history.json` (else a root `*.json`) and collecting `res/<path>` → bytes; validate paths with `isValidArchivePath`. Tests: new-name archive, old-name archive, `res/*` collection, traversal-path rejection, missing-entry error.

## 3. Orchestration hook (TDD)

- [x] 3.1 Add `apps/chat/src/hooks/useConversationImport.ts` mirroring `useConversationExport`: `importConversations(file)` parses the file once, then adds **one job per file** — label = the single conversation's name (secondary line = source folder breadcrumb) for a 1-conversation file, or "All conversations" for a multi-conversation file; exposes `jobs`, `dismissJob`, `retryJob`, `dismissAll`; per-job `AbortController`; reads bucket from `useUser`. Holds the parsed envelope + shared archive attachment map so the job and its retry reuse them.
- [x] 3.2 Import work (per file): for each conversation `regenerateConversationId`; for archives upload attachments to `uploads/<YYYY-MM-DD>/` via `uploadFile` with `uploadMode: 'create-only'` (bounded concurrency) — a `409` conflict is reported as a distinct named error (not the generic skip warning), other failures skip-and-warn; then `rewriteAttachmentUrls`; `saveConversation(subPath, conversation)`; refresh the conversation list after the file settles. Job status → success when all conversations import, failed when any fail; retry re-runs the whole file.
- [x] 3.3 Aggregate notifications once the file settles: one success toast naming all imported conversations, one failure toast naming all failed ones (both may show together on partial success), attachment-skipped warning, and a single unsupported-format toast for a bad file (no row created). Abort-aware (no toast/status change after dismiss).
- [x] 3.4 Hook tests (mock server-api + notification): single-conversation file → one job labeled with the name; export-all `.json` → one "All conversations" job saving N conversations; `.dial` uploads attachments to `uploads/<date>/` + rewrites URLs; a `409` name conflict shows the distinct conflict error naming the file (conversation still imports); partial failure → success toast names imported + error toast names failed + job failed; unsupported file → single unsupported toast, no row; retry re-runs using cached parse; dismiss aborts.

## 4. Server-api

- [x] 4.1 Add optional trailing `signal?: AbortSignal` to `saveConversation` in `apps/chat/src/server-api/conversations.api.ts` using the conditional-spread convention; keep existing call sites unaffected. Add a passthrough test.

## 5. UI wiring & i18n

- [x] 5.1 Add `ConversationImportI18nKeys` enum to `apps/chat/src/constants/translation-keys.ts` + English strings in `en.json`: `ImportLabel`, queue title "Importing", success (`"{{names}}" imported.`), failure (`"{{name}}" was not imported. Please try again.`), attachment-skipped warning, attachment-name-conflict error (`"{{names}} already exists. Please rename it and try again."`), unsupported-format; reuse `ButtonsI18nKeys` for generic labels.
- [x] 5.2 Generalize the queue job type (`models/conversation-export.ts` / `types/conversation-export.ts`) to a neutral shared shape with an **optional secondary line** (folder-path breadcrumb) and update `ImportExportQueue.tsx` `JobRow` to render two lines (breadcrumb above label) per Figma node `2352-23886`; update `useConversationExport` accordingly (or add an `ImportJob` alias); keep it prop-driven.
- [x] 5.3 Add an `onImport: () => void` prop and an "Import" `DropdownItem` (icon `IconFileImport`/`IconUpload`, `aria-hidden` icon) to `apps/chat/src/components/ConversationPanel/ConversationPanelMenu.tsx`, placed immediately **after** the "Export" item (per Figma `1920_import_start`).
- [x] 5.4 In `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx`: mount `useConversationImport`, add a hidden `<input type="file" accept=".json,.dial,.zip">` (reset value between selections), wire the menu's `onImport` to open it, and feed import + export jobs into the single `ImportExportQueue`.
- [x] 5.5 Update `ConversationPanelMenu`/`ConversationPanelView` tests for the new Import item and file-input trigger.

## 6. Verification

- [x] 6.1 `npm exec nx test chat`, `npm exec nx lint chat`, `npm exec nx build chat` all green.
- [x] 6.2 RTL + a11y spot-check of the Import menu item and the queue panel.
- [ ] 6.3 Manual E2E — new chat round-trip: export a conversation with attachments (`.dial`) → import → new conversation with unique name, attachments under `uploads/<today>/`, renders on open; repeat for export-all `.json`.
- [ ] 6.4 Manual E2E — old chat: import a real v5 `.json` and a `.dial`/`.zip` from `development`; observe rendering and note any content gaps for the deferred `normalizeImportedConversation` follow-up.
- [ ] 6.5 Confirm queue shows in-progress → success, cancel aborts, retry works, and a bad file shows the unsupported-format toast.

## 7. Export version bump & legacy-sync signal (tried and reverted — see section 9)

- [x] 7.1 Fix `rebaseConversationId`/`getFolderBreadcrumb` to tolerate old chat's raw DIAL Core resource id/folderId prefix (`conversations/{bucket}/...`, vs. this app's `{bucket}/...`) by stripping a leading `conversations/` segment before parsing bucket/folder structure. (`libs/chat-shared` untouched by this fix; app-level only.)
- [x] 7.2 ~~Add `ExportFormatV6` to `libs/chat-shared/src/models/import-export.ts` (`SupportedExportFormats = ExportFormatV5 | ExportFormatV6`); bump `buildExportEnvelope`/`buildDialArchive` to write `version: 6`~~ — reverted in section 9.
- [x] 7.3 ~~`parseImportEnvelope` accepts `version: 5` or `6` (rejects others); add `needsLegacySync(envelope)` returning `true` for v5. `useConversationImport` threads a `needsSync` flag through `ParsedImportFile`~~ — reverted in section 9.
- [x] 7.4 Tests updated/added across `import-conversation.spec.ts`, `zip-import.spec.ts`, `zip-export.spec.ts`, `export-conversation.spec.ts`, `useConversationImport.spec.ts` for the `conversations/` prefix fix (7.1). Tests added for the version bump/`needsLegacySync` (7.2/7.3) were reverted along with them in section 9.

## 8. Attachment-skip diagnosability, archive-path validation fix, and separate transfer queues

- [x] 8.1 Fix `isValidArchivePath` (`zip-export.ts`): drop the character allowlist (was silently dropping `res/<path>` entries whose filename had a space/parenthesis/non-ASCII character, on both export and import); keep only the `.`/`..`/empty-segment traversal check. Remove the redundant control-character/backslash disallow-list added mid-fix once `encodeURIComponent` downstream was confirmed to already neutralize it.
- [x] 8.2 Name every skipped attachment in the warning toast (`ConversationImportI18nKeys.WarningAttachmentSkipped`, `"{{names}} could not be uploaded and were skipped."`) instead of a generic "one or more attachments" message.
- [x] 8.3 `ImportExportQueue.tsx`: remove the component's own `fixed bottom-4 end-4 z-[70]` positioning — it now renders as a plain panel so it can be stacked by its parent.
- [x] 8.4 `ConversationPanelView.tsx`: replace the combined `transferJobs`/dynamic-title/dismiss-retry-routing logic with two independently-wired `ImportExportQueue` instances (export, import), each with its own static i18n title, wrapped in one `fixed bottom-4 end-4 z-[70] flex flex-col-reverse gap-2` container so they stack without overlapping.
- [x] 8.5 Update `ConversationPanelView.spec.tsx` (rename the "combined queue" describe block, simplify the dismiss/retry tests now that there's no cross-hook routing, add a test asserting two separate panels with distinct titles render when both queues have jobs) and `import-conversation.spec.ts`/`zip-export.spec.ts` for the validator fix.
- [x] 8.6 Add `DialEllipsisTooltip` (from `@epam/ai-dial-ui-kit`) to the job description/label rows so a truncated file/conversation name shows its full text on hover; pass `contentClassName="!z-[80]"` on each instance so the tooltip's own `z-[55]` portal content renders above the queue panel's `z-[70]` (the `!` important modifier beats the ui-kit's plain z-index class regardless of stylesheet order).

## 9. Revert the v6 export-version bump and legacy-conversation typing (section 7.2/7.3)

- [x] 9.1 Revert `libs/chat-shared/src/models/import-export.ts` to a single `ExportFormat { version: 5; history: Conversation[]; folders: ExportFolder[] }` — remove `ExportFormatV5`, `ExportFormatV6`, `SupportedExportFormats`, `LegacyConversation`, `LegacyMessage`. `ExportFolder` (from the earlier `ExportFolderV5` rename) is kept.
- [x] 9.2 `buildExportEnvelope`/`buildDialArchive`/`serializeExportEnvelope` (export-conversation.ts, zip-export.ts) write/accept `ExportFormat` at `version: 5` again (was briefly `6`).
- [x] 9.3 `parseImportEnvelope` (`import-conversation.ts`) accepts only `version: 5`; remove `needsLegacySync`. Its `history` cast to `Conversation[]` is now the one documented "trust old-chat's shape as-is" point (was previously two casts: `LegacyConversation[]` in the parser, then `Conversation[]` in the hook).
- [x] 9.4 `useConversationImport.ts`: remove the `needsSync` field from `ParsedImportFile` and the `needsLegacySync` call in `parseImportFile`; update the deferred-normalization TODO comment to no longer reference a `needsSync` flag that doesn't exist.
- [x] 9.5 `zip-import.ts`: `ParsedDialArchive.envelope` typed as `ExportFormat` (was `SupportedExportFormats`).
- [x] 9.6 Update tests (`import-conversation.spec.ts`, `zip-import.spec.ts`, `zip-export.spec.ts`, `export-conversation.spec.ts`, `useConversationImport.spec.ts`) to drop v6/`needsLegacySync`/`LegacyConversation` references; the "real old-chat-shaped conversation" test now casts directly to `Conversation` instead of `LegacyConversation`.
- [x] 9.7 Rationale (see `design.md` Decision 11): the split had no runtime effect — `needsSync` was computed but never read by live code (only a TODO comment), and `LegacyConversation[]` was cast to `Conversation[]` at the one place it was consumed, so both versions carried identical information. Reintroducing the version bump and a legacy type is deferred to the same future change that adds the actual `normalizeImportedConversation` step.
