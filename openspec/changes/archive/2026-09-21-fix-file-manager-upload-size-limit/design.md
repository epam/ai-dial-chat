## Context

Issue [#6083](https://github.com/epam/ai-dial-chat/issues/6083). The backend already enforces a configurable max file size (`FILE_UPLOAD_MAX_BYTES`, default 512 MB) via `MulterModule` on `POST /api/v1/files` (`apps/chat-api/src/files/files.module.ts:25`), and the client's handling of the resulting `413` in `useDialFileUploadBatch`/`createUploadFileWithProgress` is already correct (marks the file `Failed`, never `Completed`). What's missing everywhere is a **client-side pre-upload size check** — today the Clip-icon native picker path (`libs/conversation-input` → `useAttachments`/`useAttachmentUpload`) has no size-related code at all, and the File Manager path never engages the vendor ui-kit's own built-in pre-upload size check.

**Revision during implementation:** the original version of this design proposed adding exclusion logic to `useDialFileUploadBatch.onValidateUpload` for the File Manager path. Implementation work discovered that `@epam/ai-dial-react-file-manager`'s `<DialFileManager>` already exposes a `maxFileSize?: number` prop and an `uploadValidationMessages.oversizedFiles` message — a built-in pre-upload size check, distinct from the already-used `maxSelectableFileSize` (which only gates selecting an *existing* file) — that our code has simply never wired up. `onValidateUpload`/`onUploadFiles` in `useDialFileUploadBatch` are called by the ui-kit only *after* its own `maxFileSize` check passes, so an oversized file never reaches them once that prop is set. This section and the Decisions below describe the corrected design: the File Manager path is fixed by threading two new pass-through props through `DialFileManagerShell`/`FileManagerAttachModal`, not by modifying `libs/chat-hooks`. The Clip-icon path (`useAttachmentValidation`) has no equivalent built-in mechanism and is still fixed by hand-written validation, as originally designed.

A related, independently real gap: `DialFileManagerPage.tsx` (the standalone `/files` page) passes no size limit to `DialFileManagerShell` at all, so — unlike `DialFileManagerModal`, which already threads a hardcoded `MAX_SELECTABLE_FILE_SIZE_BYTES` constant into `isRowSelectable` — existing-file selection on the standalone page is completely unrestricted by size.

`useDialFileManager` already composes five sub-hooks (`useDialFileListing`, `useDialFileUploadBatch`, `useDialFileMutations`, `useDialFileSharing`, `useDialFileMetadata`) and is the seam every upload-related option flows through today (`filesApi`, `bucket`, `onNotification`, …) — see `libs/chat-hooks/src/files/useDialFileManager/useDialFileManager.ts:50-79`. `maxSelectableFileSize` is *not* currently among those options; `DialFileManagerModal` only uses it locally (grid `isRowSelectable`, header copy) and forwards it straight to `DialFileManagerShell` as a display/grid-filtering prop (`DialFileManagerModal.tsx:592`), never into `useDialFileManager` itself.

## Goals / Non-Goals

**Goals:**

- Reject an oversized file before any network request, at every upload entry point: the standalone File Manager page, the attach modal's own upload, and the Clip-icon/drag-drop/paste path.
- Make the pre-check value and the backend's real enforcement the same number, sourced from the one env var that already exists (`FILE_UPLOAD_MAX_BYTES`), surfaced to the frontend via client-config.
- Close the standalone page's existing-file-selection gap so it matches the attach modal.
- Keep every lib change parameter-driven (no lib reads `AppConfig`, env, or `ConfigService`), per `AGENTS.md` §Library isolation.

**Non-Goals:**

- Introducing a second, independently-configured env var for this limit (rejected in the proposal's Alternatives).
- Pre-checking the archive-extraction upload path against `ARCHIVE_UPLOAD_MAX_BYTES` — a file is only classified as "goes to archive extraction" after upload begins, based on content, so it cannot be pre-checked by size alone without reading the file first. That endpoint's existing server-side enforcement is unchanged and untouched.
- Changing `POST /api/v1/files`'s or the archive endpoint's server-side behavior — `apps/chat-api` changes are limited to the config-registry entry that surfaces the existing `FILE_UPLOAD_MAX_BYTES` value read-only through client-config; the Multer limit itself is untouched.

## Decisions

### Reuse `FILE_UPLOAD_MAX_BYTES`, don't add a new env var

**Decision:** Register a new `attachments.maxFileSizeBytes` client-config key whose `envVar` is the existing `FILE_UPLOAD_MAX_BYTES`, not a new variable.

**Why:** `FILE_UPLOAD_MAX_BYTES` already exists, already has the exact default (512 MB) the issue describes, and already drives real server-side enforcement. A second, separately-configured variable would let an operator change one without the other, silently reintroducing exactly this bug's symptom (frontend says "fits," backend says "413," or vice versa) for anyone who edits only one of the two.

**Alternative considered:** A new `MAX_ATTACHMENT_FILE_SIZE_BYTES`, as the issue's maintainer comment literally suggests. Rejected for the divergence risk above — the comment predates knowledge that `FILE_UPLOAD_MAX_BYTES` already exists and is already wired to Multer.

### File Manager path: wire the ui-kit's existing `maxFileSize`, don't hand-roll exclusion logic

**Decision:** Add two new optional props to `DialFileManagerShellProps` and `FileManagerAttachModalProps` (`libs/chat-shared/src/file-manager/...`): reuse the existing `maxSelectableFileSize` value as the `<DialFileManager maxFileSize>` prop (no new numeric prop needed — one AppConfig-sourced number serves both the existing-file-selection cap and the new-upload cap), and add a new `oversizedUploadMessage?: string` forwarded to `<DialFileManager uploadValidationMessages={{ oversizedFiles: oversizedUploadMessage }}>`. `DialFileManagerModal` and `DialFileManagerPage` (`apps/chat`) compute `oversizedUploadMessage` once via `t()` with the actual limit interpolated, and pass both new/reused values down.

**Why:** `@epam/ai-dial-react-file-manager`'s `<DialFileManager>` already implements exactly this check internally — `maxFileSize`/`uploadValidationMessages.oversizedFiles` reject an oversized file and surface a message *before* `onValidateUpload`/`onUploadFiles` are ever called for it. Discovered during implementation (see Context); confirmed by grepping both `libs/*` and `apps/*` for `maxFileSize`/`uploadValidationMessages` and finding zero existing call sites, only the vendored `.d.ts` declarations. Reusing this means zero changes to `libs/chat-hooks`'s upload hooks, less code, and reliance on a path the vendor component already tests, rather than duplicating a byte-size comparison the ui-kit already performs.

**Alternative considered (the original plan for this change):** Add a `maxFileSizeBytes` option to `useDialFileUploadBatch.onValidateUpload` that excludes oversized files from the batch and reports via a new structured `onNotification` reason. Rejected once the native prop was found — it would have duplicated a check the ui-kit already performs, and would never actually run (the ui-kit's own `maxFileSize` check, once wired, rejects the file before `onValidateUpload` is invoked at all, making the hand-rolled exclusion logic dead code). The trade-off: the ui-kit's message is a single fixed string (`uploadValidationMessages.oversizedFiles`), not a structured event listing the specific rejected file names — a real but accepted limitation, since the vendor component owns how it renders the rejection and we have no evidence today's message needs per-file-name detail to be useful.

### Clip-icon path still uses a hand-written check — no ui-kit equivalent exists there

**Decision:** `useAttachmentValidation` (`libs/chat-hooks`) gains an optional `maxFileSizeBytes?: number` parameter and its own size check in `validateAttachment`, reporting through the existing debounced `onValidationError` callback — unchanged from the original design.

**Why:** The Clip-icon native `<input type="file">` path (`libs/conversation-input` → `useAttachments` → `useAttachmentUpload`) is hand-written app/lib code with no equivalent vendor component or built-in size check to reuse; a genuinely new check is the only option here. Making the parameter optional (default: no restriction) preserves current behavior for any caller that doesn't pass it, for the same reason given below.

### New capability for the Clip-icon side; modify existing capabilities for the File Manager side

**Decision:** `attachment-file-too-large-error` is a new capability (mirrors the existing `attachment-unsupported-type-error` capability's shape exactly). The File Manager side is expressed as modifications to the existing `dial-file-manager-attach-validation` and `file-manager-standalone-page` capabilities (new pass-through props) and `file-manager-upload` (clarifying that `onValidateUpload`/`onUploadFiles` need no change), since it wires up an existing mechanism rather than introducing a new validation flow.

## Risks / Trade-offs

- **[Risk]** A consumer of `@epam/ai-dial-chat-hooks` outside this repo (if any) calls `useAttachmentValidation` and expects the old never-`FileTooLarge` behavior even after upgrading. → **Mitigation:** the new parameter is optional and defaults to "no size restriction," so an unmodified call site sees zero behavior change after a version bump; the restriction only activates when a caller explicitly opts in by passing `maxFileSizeBytes`.
- **[Risk]** The pre-check and the server's real limit could still drift if a future change edits one without the other, since they're two separate code paths (Multer config vs. registry entry, and now also the ui-kit's own `maxFileSize` prop) that happen to read the same env var/value today. → **Mitigation:** the registry entry's `envVar` field is documented (in the spec delta and this doc) as intentionally reusing `FILE_UPLOAD_MAX_BYTES`; a future change to any of the three should grep for the others before touching the value.
- **[Risk]** `File.size`/`contentLength` can be `0` or missing for some attachment sources (e.g. a URL-based reference without a known size). → **Mitigation:** the Clip-icon size check treats a missing/undefined size as "no size to check" (skip the size check for that entry), consistent with the existing `contentLength != null` guard already present in `isRowSelectable` (`DialFileManagerModal.tsx:256`). The File Manager side inherits whatever behavior the vendor `<DialFileManager maxFileSize>` check already has for a file with an unknown size — not something this change can alter, since it is vendor-internal logic.
- **[Trade-off]** The archive-extraction path (`ARCHIVE_UPLOAD_MAX_BYTES`) is explicitly left without a pre-check (see Non-Goals) — a large zip file still only fails after a full upload attempt. Accepted because pre-classifying archive vs. plain-file intent before upload would require reading file content client-side, a larger change than this fix's scope, and archive uploads are not what issue #6083 reports.
- **[Trade-off]** The File Manager path's rejection message is a single fixed string (`uploadValidationMessages.oversizedFiles`), not a structured event naming the specific rejected files — unlike the Clip-icon path's richer, file-name-listing notification. Accepted: the vendor component owns how/where it renders this message, and matching the Clip-icon path's granularity would require bypassing the native mechanism this design deliberately chose to reuse.

## Migration Plan

No data migration. Rollout is a standard PR:

1. Backend: add the `attachments.maxFileSizeBytes` registry entry and the `ClientConfigResponseDto` field (additive, no env var change).
2. Frontend context: `AppConfigContext` gains the field with a safe default; existing consumers of `MAX_SELECTABLE_FILE_SIZE_BYTES` are migrated to read it.
3. Libs: add `maxFileSize`/`oversizedUploadMessage` pass-through props to `DialFileManagerShell`/`FileManagerAttachModal` (no logic, pure forwarding); add the optional `maxFileSizeBytes` parameter and `FileTooLarge` enum member to `useAttachmentValidation`.
4. App wiring: `DialFileManagerModal`, `DialFileManagerPage`, and the Clip-icon input path pass the resolved value in and handle the new message/error reason.
5. i18n: add the new keys to `en.json` (and any other maintained locale files, per the existing locale-parity expectation).

**Rollback:** Revert the app-wiring commit(s); the additive lib props/parameter and backend field are harmless left in place (unused) if only the wiring is reverted. No feature flag is needed — the change is a straightforward bug fix with a safe (opt-in, defaulting to no-op) parameter shape.

## Open Questions

- Whether non-English locale files need the new `attachments.fileTooLarge.*` and `dialFileManager.uploadFileTooLarge` keys added in this same change, or whether the project's translation workflow backfills them separately. Follow whatever the most recent comparable addition (e.g. `attachments.unsupportedType.*`) did in its own PR.
