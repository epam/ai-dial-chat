## Context

`POST /api/v1/skills/import` (added by `2026-08-20-add-skill-archive-import`, spec at `openspec/specs/skill-archive-import/spec.md`) currently accepts exactly one thing: a ZIP archive in the `file` multipart field. The request flow today is:

`SkillArchiveUploadInterceptor` (disk-stages the upload, enforces `SKILL_ARCHIVE_UPLOAD_MAX_BYTES` via Multer) → `skills.controller.ts`'s `import` route → `SkillsArchiveImportService.importSkillArchive(bucket, archivePath, accessToken, signal)` → `SkillsArchiveExtractionService.extract(archivePath, signal)` (opens as ZIP via `yauzl`, validates structure/paths/entries, incrementally enforces decompressed-size limits, decodes `SKILL.md` as strict UTF-8, calls `parseSkillManifestFrontmatter`, validates the derived name via `isValidSkillName`) → `SkillsUploadService.createSkill(bucket, name, skillManifest, filePathsJson, files, accessToken, signal)` (the same call the manual multipart create endpoint uses, `If-None-Match: *`, Core `412`→`409`).

A user whose Skill is just a manifest — no scripts, no resources — must still zip it before "Upload" will take it. Every validation building block this needs already exists: strict UTF-8 decode, `parseSkillManifestFrontmatter`, `isValidSkillName`, and the unmodified atomic `createSkill` call. The only genuinely new logic is (a) telling a bare manifest apart from a ZIP, and (b) building the same `{ name, skillManifest, filePaths, files }` shape from one file instead of many.

## Goals / Non-Goals

**Goals:**
- Accept a standalone `SKILL.md` through the exact same endpoint, field, and file picker as the ZIP path, with zero behavior change to ZIP uploads.
- Reuse `parseSkillManifestFrontmatter`, `isValidSkillName`, `SKILL_MANIFEST_FILE`, and `SkillsUploadService.createSkill` unmodified — do not re-implement manifest or path validation for the new branch.
- Keep the whole request atomic: no Core call until every check on the standalone manifest passes.
- Keep the archive-specific limits (`SKILL_ARCHIVE_UPLOAD_MAX_BYTES`, the 100-file/1 MiB-per-file/16 MiB-total decompressed limits) scoped to the ZIP branch only; apply the existing per-file limit (`SKILL_FILE_UPLOAD_MAX_BYTES`) to the standalone manifest.

**Non-Goals:**
- No generic "any single Markdown file becomes a Skill" feature — only the manifest filename `SKILL.md`, exact case, is accepted standalone.
- No archive-based *update* of an existing Skill (unchanged from the original archive-import scope — create-only).
- No change to `SkillsArchiveExtractionService`'s ZIP-specific structural rules (wrapper-dir stripping, `__MACOSX` skipping, entry-count ceiling, encrypted/symlink rejection) — none of that applies when there is only one file and no archive container.
- No renaming of the endpoint path, HTTP method, multipart field name (`file`), response DTO shape, or the generated client's `importSkillArchive` operation — this stays additive to the existing contract.

## Decisions

### D1 — Payload-type detection: exact filename for the manifest branch, existing ZIP-signature open for the archive branch

The multipart field's *original filename* (`file.originalname`, as Multer preserves it — not the extension, not the declared `mimetype`) decides the branch:

- `file.originalname === 'SKILL.md'` (case-sensitive, exact) → standalone-manifest branch.
- Anything else → handed to the existing `SkillsArchiveExtractionService.openArchive` (`yauzl.openPromise`), which already validates by ZIP local-file-header signature, not by name — a file named `bundle.foo` that is a real ZIP still opens correctly today, and that behavior is preserved.
- If neither applies — i.e. the name isn't exactly `SKILL.md` and the content doesn't open as a ZIP — the request is rejected `400` with a message naming both accepted forms, reusing the archive branch's existing "cannot open" catch block with an updated message rather than adding a third code path.

**Why filename and not content-sniffing for the manifest branch:** `SKILL.md` is not an extension pattern here — it is the exact required manifest filename the archive branch already enforces internally (`SKILL_MANIFEST_FILE`, `skill-path.util.ts:10`). Requiring the same exact name for the standalone form keeps one naming contract for "this is a Skill manifest" instead of two. A renamed `.md` file (e.g. `readme.md`, or `skill.md` with wrong case) fails this exact check and falls through to the ZIP-open attempt, which fails for a plain text file, landing on the shared `400`.

**Alternative considered — sniff content instead of trusting `originalname`:** rejected. A manifest has no byte-level signature to sniff (it's arbitrary UTF-8 text); the only thing that identifies "this is meant to be a Skill manifest, standing alone" is the same filename the archive contract already uses as its manifest marker. This is not equivalent to trusting a MIME type or a loose extension — it's an exact, case-sensitive match against a filename that is already load-bearing in the sibling archive path.

**Safety against a disguised ZIP named `SKILL.md`:** such a file enters the manifest branch (by name), then fails the strict-UTF-8 decode (D2) — ZIP's binary local-file-header bytes are not valid UTF-8 in the overwhelming majority of cases — and is rejected `400` under the same "malformed UTF-8" path a corrupted text manifest would hit. No separate detection is needed for this case; it is not a security gap because the manifest branch never skips validation or writes anything before the Core call.

### D2 — New `SkillsManifestImportService`, parallel to `SkillsArchiveExtractionService`, both feeding the same orchestrator

Add `apps/chat-api/src/skills/import/skills-manifest-import.service.ts` — `SkillsManifestImportService.extract(manifestPath, signal)` — mirroring `SkillsArchiveExtractionService.extract`'s return shape `{ name, skillManifest, filePaths, files }` so the orchestrator can treat both branches identically:

1. `fs.stat` the staged file; if `size > SKILL_FILE_UPLOAD_MAX_BYTES` (same env var and default, `1_048_576`, the extraction service already reads at `skills-archive-extraction.service.ts:75`) → `413 PayloadTooLargeException`, no read attempted.
2. Read the full file, decode with `new TextDecoder('utf-8', { fatal: true })` → `400` on invalid UTF-8 (identical decode call to the archive branch's manifest decode).
3. `parseSkillManifestFrontmatter(raw)` (unchanged import from `skill-manifest-frontmatter.util.ts`) → `400 InvalidSkillManifestError` mapping, identical to the archive branch.
4. `isValidSkillName(name)` (unchanged import from `skill-path.util.ts`) → `400` if unsafe.
5. Return `{ name, skillManifest: raw, filePaths: [], files: [] }` — `SKILL.md` itself travels as `skillManifest`, never as a `filePaths`/`files` entry; `SkillsPackageService.validateAndBuildFormData` rejects a `SKILL.md` entry inside `filePaths` as redundant (`filePaths must not include SKILL.md — it is supplied via skillManifest`), the same rule the archive branch's `supportingEntries` already respects by excluding the manifest entry. A standalone manifest has no supporting files, so both arrays are empty.

`SkillsArchiveImportService` (rename to `SkillsImportService` — see D5) picks the extractor by the D1 filename check and passes the result, unchanged, to the same `uploadService.createSkill(...)` call already used for archives. No changes to `SkillsUploadService` or `SkillsPackageService` at all.

**Alternative considered — teach `SkillsArchiveExtractionService` to also handle the single-file case:** rejected. That service's whole shape (open a ZIP handle, iterate entries, strip a wrapper directory, reject duplicates) is meaningless for one already-decoded file; forcing it through the same class would mean branching on "is this even an archive" inside a class named and structured around being one. A second, much smaller service with the same return contract is less code and keeps each service's invariants simple enough to state in one sentence.

### D3 — Multer/interceptor stays unchanged; the manifest size limit is enforced after staging, not during upload

`SkillArchiveUploadInterceptor` keeps its single Multer `fileSize` limit at `SKILL_ARCHIVE_UPLOAD_MAX_BYTES` (20 MiB default) regardless of branch, because Multer's `limits.fileSize` must be fixed before the multipart body is known to contain a manifest or an archive — the field's `originalname` is available at the point Multer's `fileFilter` would run, but changing the effective byte ceiling mid-stream is not something Multer supports, and parsing the multipart preamble ourselves to pick a limit early would duplicate Multer's own parsing.

Instead, `SkillsManifestImportService.extract` performs its own `stat`-based `SKILL_FILE_UPLOAD_MAX_BYTES` check as step 1, before reading any bytes into memory. The outer 20 MiB Multer ceiling still bounds how much a client can push over the wire for *any* single request (defense against an oversized-transfer DoS); the inner, much smaller manifest check is what actually enforces "a manifest must fit the existing per-file limit."

**Trade-off accepted:** a client could transfer up to 20 MiB before the manifest-specific rejection fires (vs. rejecting immediately at, say, 1 MiB). Given imports are rate-limited to 5/minute per user and the outer ceiling already existed for the archive branch, this is judged an acceptable, bounded cost rather than a reason to add per-branch Multer configuration.

### D4 — No new `422` paths for the standalone branch; only `400`/`413`/`409` apply

The archive branch's `422` responses (too many entries, multiple manifests, duplicate paths, encrypted/symlink entries) all describe *structural* problems that can only exist inside a container with more than one entry. A standalone manifest has no structure to be wrong in that sense, so the standalone branch only ever produces the same `400` (malformed input) / `413` (size) / `409` (Core collision) / `429`/`502`/`503` (rate-limit/Core failure) outcomes the archive branch also produces for its own non-structural checks. This is a direct consequence of D2's design, not a separate decision to implement — called out here so the spec delta's error table is complete.

### D5 — Rename `SkillsArchiveImportService` → `SkillsImportService`; keep the HTTP contract and operationId unchanged

The orchestrator class is renamed (file: `skills-archive-import.service.ts` → `skills-import.service.ts`) since it now fronts two extraction strategies, not one — "archive" in its name would be misleading. This is an internal rename only: `skills.controller.ts`'s route (`@Post('import')`), the `importSkillArchive` handler method name, its Swagger `operationId: 'importSkillArchive'`, the request field (`file`), and `SkillImportResponseDto`'s shape are all left exactly as they are, so the generated `@epam/chat-api-client` method name and existing frontend call sites do not change. Only the OpenAPI `@ApiOperation`/`@ApiBody` *description* text is updated to mention both accepted forms; regenerating the client after that touches description strings only, not signatures.

**Alternative considered — also rename the controller method/operationId (e.g. `importSkill`):** rejected for this change. `importSkillArchive` remaining accurate-enough (it still imports *a* Skill via a single-file-or-archive request) avoids a generated-client method rename that would ripple into `apps/chat/src/server-api/skills.api.ts` and every test asserting on it, for a purely cosmetic gain. Flagged as an Open Question below in case reviewers disagree.

### D6 — Frontend: widen the picker's `accept`, add a client-side filename pre-check, keep the hook name

- `CatalogView.tsx`'s hidden `<input type="file">` `accept` attribute changes from `".zip"` to `".zip,.md"` — a browser-level filter hint only, not a security boundary.
- `useSkillArchiveImport.ts`'s `handleFileChange` gets one new pre-submit check: if the selected file's name ends in `.md` (case-insensitive, to catch the common mistake) and is not exactly `SKILL.md`, show the existing "validation" error state immediately, without calling `importSkillArchive` — same UX pattern already used for reading `event.target.value = ''` before dispatch, so re-selecting the same (still-wrong) file re-fires the check. A `.zip`-named file, or a file named exactly `SKILL.md`, is passed through unchanged; the BFF is the actual authority regardless of what this check allows through.
- The hook keeps its name, `useSkillArchiveImport` — see the alternative below.
- `en.json`'s `skillArchiveImport.*` copy (the file-input `aria-label` and the "Upload" menu item's associated help text, if any exists at the call site) is updated to state both accepted forms; no new component, no new `aria-live` region — the existing `StatusUploading/Success/Error` announcements are unchanged in structure, only the strings they can now describe.

**Alternative considered — rename the hook/i18n namespace to something archive-agnostic (`useSkillUpload`, `skillUpload.*`):** considered but deferred. It touches every existing call site, test, and translation key for a naming-only change, mirroring D5's reasoning. Left as the same Open Question as D5 — if the reviewer wants the rename, it should be done consistently across frontend and backend in one pass, not half-renamed here.

### D7 — Library isolation: no changes to `libs/catalog`

`libs/catalog`'s `DropdownItem`/`CreateButton` already supports the `children` shape the "Skill" submenu uses; the file `accept` string, the filename pre-check, and all networking stay in `apps/chat` (`CatalogView.tsx`, `useSkillArchiveImport.ts`, `server-api/skills.api.ts`). This change requires zero edits inside `libs/*`.

## Risks / Trade-offs

- **[Risk]** A client could rename a large binary file to `SKILL.md` and transfer up to the 20 MiB outer ceiling before rejection (D3). → **Mitigation**: existing per-user rate limit (5/min) already bounds repeated abuse; the manifest-specific `413` still fires before any content is parsed or any Core call is made, and no disk artifact survives (interceptor's existing `finalize`-based cleanup is untouched).
- **[Risk]** Two extraction services (`SkillsArchiveExtractionService`, `SkillsManifestImportService`) both implement "decode as UTF-8, parse frontmatter, validate name" — a future manifest-rule change could be applied to one and not the other. → **Mitigation**: both branches import the exact same `parseSkillManifestFrontmatter`/`isValidSkillName` functions rather than re-implementing them; the risk is scoped to someone adding a new manifest rule as inline logic instead of extending the shared util, which code review should catch.
- **[Trade-off]** Keeping `importSkillArchive`/`useSkillArchiveImport`/`skillArchiveImport.*` names (D5/D6) leaves a permanent minor naming mismatch ("archive" import that also accepts a bare file) in exchange for not touching the generated client's method name or every existing call site. Reversible later as a pure rename if desired.

## Migration Plan

No data migration. Deployment is a normal backend + frontend release:
1. Ship backend changes first (new `SkillsManifestImportService`, orchestrator branch, updated Swagger description) — additive, so existing frontend clients (still `.zip`-only `accept`) are unaffected.
2. Regenerate `libs/chat-api-client` from the updated OpenAPI description (no interface change expected).
3. Ship the frontend `accept`/filename-check/copy changes.
4. Rollback is a plain revert of either side independently — the endpoint's existing ZIP behavior and contract are untouched at every step, so a partial rollout (new backend + old frontend, or vice versa) is safe.

## Open Questions

- Should `importSkillArchive` / `useSkillArchiveImport` / the `skillArchiveImport.*` i18n namespace be renamed to drop "archive" now that the endpoint accepts a non-archive form, or is that deferred to a later cleanup change? (D5/D6 default to **not renaming** for this change.)
- Should the Swagger `operationId` gain a doc-only note (e.g. `@ApiOperation({ summary: ... })` text) listing the exact accepted filename, or is "a ZIP archive or a file named SKILL.md" sufficient without spelling out the case-sensitivity in the public API description? (Default: state case-sensitivity explicitly, since it's the one filename subtlety a client integrator could get wrong.)
