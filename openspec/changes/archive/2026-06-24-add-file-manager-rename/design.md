## Context

DIAL Core has no in-place rename API. Renaming is a `moveResource` operation:
```
POST /v1/ops/resource/move
{ "sourceUrl": "files/{bucket}/{src}", "destinationUrl": "files/{bucket}/{dest}", "overwrite": false }
```

For a **single file**, rename = one `moveResource` call. For a **folder**, rename = relocating every file under the old prefix (including `.dial_folder` marker). DIAL folders are virtual — no folder-scoped rename endpoint exists.

The project already handles this for folder **delete**: `expandFolderContents` in `FilesService` paginates `getFileMetadata` with `recursive: true, limit: 1000` following `nextToken` until exhausted. Rename must reuse — not duplicate — this strategy.

**Current gap**: no BFF rename endpoint, no `onMoveToFiles` / `onRenameValidate` in `useDialFileManager`, no rename props in `DialFileManagerModal`.

## Goals / Non-Goals

**Goals:**
- BFF `POST /api/v1/files/rename` proxying `moveResource` for files and recursively for folders.
- `useDialFileManager` wires ui-kit inline rename (`onMoveToFiles`, `onRenameValidate`, `isRenaming`).
- `DialFileManagerModal` exposes Rename on `my_files` tab (WRITE-gated).
- Partial-failure UX matching delete pattern.
- Rename capability is documented in the OpenSpec API/UI and tab action specs.

**Non-Goals:**
- Move to another folder (destination picker) — row #23.
- Cross-bucket move or shared-resource rename.
- Unified operation loader modal — row #27.
- `overwrite: true` / replace on conflict.

## Decisions

### D1 — Endpoint name: `/rename`, not `/move`

**Decision**: `POST /api/v1/files/rename`

**Rationale**: "Move to another folder" (row #23) is out of scope for this change. A `/move` name would imply general relocation (cross-folder), misleading callers. `/rename` aligns with `/delete` and `/download-archive` — verb-per-operation naming already established in the files controller.

**Alternative considered**: `/move` — deferred because scope must be bounded per gap-matrix row; a combined endpoint can be introduced later with a v2 contract.

### D2 — POST over DELETE/PATCH

**Decision**: POST, matching delete's rationale.

`PATCH /api/v1/files/:id` implies a single-resource update, but file rename is a batch operation (rename multiple items) and the multi-item pattern in this project is `POST` with a body. `DELETE` with a body is proxy-unfriendly. `POST /api/v1/files/rename` is consistent with `POST /api/v1/files/delete`.

### D3 — Folder rename: reuse `expandFolderContents`, move per file

**Decision**: Extract `expandFolderContents` into a shared private helper (already is private — no extraction needed), call it from the new `renameFolderItem` method passing `archiveRoot = ''` (unused field; rename uses `relItemPath` directly).

**Algorithm**:

```
renameFolderItem(bucket, srcPrefix, destPrefix, at):
  normalise srcPrefix and destPrefix to trailing "/"
  children ← expandFolderContents(bucket, srcPrefix, '', at)   // paginated
  for each child in children:
    relative  = child.path.slice(srcPrefix.length)             // "q1.pdf", "sub/q2.pdf"
    destChild = destPrefix + relative
    moveResource(files/{bucket}/{child.path} → files/{bucket}/{destChild})
  collect per-child results
  folder succeeds only if ALL moves succeed; any failure = partial failure
```

**Pagination contract** (mirrors delete):
- `recursive: true`, `limit: 1000`, follow `nextToken` until `undefined`.
- Folder entries (`nodeType: folder`) are skipped — `expandFolderContents` already does this.
- `.dial_folder` marker appears as a file in the listing and is moved with the rest.

**Mapping table** (example: `reports/` → `reports-2026/`):

| Source path (relative) | Destination path (relative) |
|------------------------|------------------------------|
| `reports/q1.pdf` | `reports-2026/q1.pdf` |
| `reports/sub/q2.pdf` | `reports-2026/sub/q2.pdf` |
| `reports/.dial_folder` | `reports-2026/.dial_folder` |

**Ordering**: moves issued in listing order (arbitrary depth-first). DIAL Core `moveResource` does not require parent-before-child ordering for file moves. Marker is relocated as a regular file, not treated specially.

### D4 — Concurrency: RENAME_CONCURRENCY = 4

**Decision**: Same constant as `DELETE_CONCURRENCY` (4). Sequential per folder item to avoid flooding DIAL Core, parallel across batch items (multiple top-level rename items run via `Promise.all`).

**Alternative considered**: sequential (1) — safer but slower for large batches; 4 matches existing delete baseline.

### D5 — Partial failure semantics

**Decision**: Best-effort (same as delete). Each item in the batch is attempted independently. A failing file move does not abort the rest of the folder rename. Frontend reports which items failed.

**Implication for folder rename**: if N of M file moves fail, the folder is split across old and new prefix. The UI shows a partial-failure toast and triggers a refresh so the user sees the actual state. No rollback.

**Alternative considered**: atomic (all-or-none) — would require DIAL Core to support transactional move, which it does not. Rollback via reverse-moving succeeded files adds complexity with no Core support.

### D6 — Rate limit: 10 requests/minute

**Decision**: `@Throttle({ default: { limit: 10, ttl: 60000 } })` — same as delete. Rename fans out into potentially many Core `moveResource` calls (one per file in a large folder), so a stricter limit than list (60/min) is appropriate.

### D7 — Rename validation: reject, not auto-replace

**Decision**: `onRenameValidate` rejects invalid names with an error message; it does not silently sanitize. The ui-kit shows the message inline before submission. This matches the `onCreateFolderValidate` pattern already in the hook.

**Forbidden checks** (client-side, in priority order):
1. Empty name → `emptyName` message
2. Name matches reserved `.dial_folder` → error
3. `/` or `\` in name → error
4. Length > 255 → error
5. Duplicate sibling name (case-insensitive) → `duplicateName` message

`forbiddenSymbolsRegExp` + `forbiddenSymbolsTooltip` for character-level validation are already wired in the modal (upload-conflicts slice) — align rename to the same regexp.

### D8 — Error mapping for `moveResource`

| DIAL Core response | `RenameItemResultDto.error` |
|--------------------|-----------------------------|
| 409 Conflict | `"Conflict"` (destination exists) |
| 403 Forbidden | `"Forbidden"` |
| 404 on source | `"Not found"` |
| other error | `"Rename failed"` |

Mirrors conversation rename (`renameConversation` in `conversation.service.ts`) and delete file error mapping.

### D9 — Navigation after folder rename

If the user is currently browsing the renamed folder (or any ancestor of it), the hook navigates to the new virtual path after a successful rename. Detection: compare `currentVirtualPath` against the old folder path prefix. Computation: replace old prefix with new prefix.

### D10 — NestJS conventions

All backend implementation follows `apps/chat-api/AGENTS.md` as the source of truth (URI versioning, thin controllers, `Logger` + `ConfigService`, validated DTOs with `@Matches`, typed HTTP exceptions, `EnvironmentVariables`).

## Risks / Trade-offs

**Large folder fan-out** → Many `moveResource` Core calls (one per file). At `RENAME_CONCURRENCY = 4` and 1000 files, renaming a large folder saturates DIAL Core for ~250 round-trips. The rate limit (10 rename requests/min) prevents repeated abuse, but a single rename of a 10,000-file folder is genuinely slow. Mitigation: log elapsed time and file count; document in UX that large folder renames may take time. Future: progress indicator (out of scope here).

**DIAL Core lacks a folder-level move** → Rename is inherently non-atomic. A mid-flight server restart or network partition leaves the folder split. Mitigation: refresh on partial failure; user can retry failed items. No data is lost — source files that were not moved remain accessible.

**`expandFolderContents` signature carries `archiveRoot`** → The third parameter is unused for rename. Passing `''` is safe (the field is only used to build zip paths inside the archive service). No refactor is needed in this change.

**409 Conflict from Core if destination name already exists** → `overwrite: false` ensures no silent clobber. Client-side duplicate-sibling validation catches the common case; server-side 409 is the safety net for race conditions (another user created the name between validate and save).

**RTL** → Inline rename input is provided entirely by ui-kit (`use-item-renaming`); no custom RTL handling required. Error toast uses existing toast infrastructure (logical layout already applied).

## Migration Plan

1. Add `POST /api/v1/files/rename` endpoint to `FilesController`.
2. Run `npm run openapi` to regenerate `@epam/chat-api-client`.
3. Add `renameFiles()` wrapper to `apps/chat/src/server-api/files.api.ts`.
4. Update `useDialFileManager` with rename props.
5. Update `DialFileManagerModal` to pass rename props and add action label.
6. Update i18n keys (`en.json`) and `translation-keys.ts` enum.
7. Update OpenSpec capability specs for rename API/UI behavior and tab action visibility.

**Rollback**: remove the controller route and revert the hook/modal props. No DB or storage migration needed.

## Open Questions

- **Folder rename ordering**: does DIAL Core require deepest paths first for `moveResource`? Current design moves in listing order (arbitrary). If Core enforces parent-must-not-exist-before-children, we need depth-descending sort. Verify against a real DIAL Core deployment before shipping.
- **Rate limit per user vs. global**: `@Throttle` in NestJS is per-user (by IP or session). Confirm the existing throttler configuration identifies users by session cookie rather than IP for the files endpoints.
