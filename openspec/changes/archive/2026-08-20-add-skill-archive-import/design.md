## Context

A Skill is stored by DIAL Core as discrete files under a bucket path, with `SKILL.md` as the manifest. Two verified facts fix the shape of this design:

1. **Core never accepts a ZIP for writes.** `fix-skill-editor-core-contract` read Core's real handler (`ComplexResourceController`/`ComplexResourceService`) and confirmed the whole-resource write is `PUT /v2/skills/{bucket}/{path}` with `multipart/form-data`, one part per file, `filename` = relative path. The only ZIP Core ever produces is on `GET` (whole-skill download). Any archive a user uploads must be unpacked and re-shaped into that same multipart contract before it reaches Core — there is no "just forward the bytes" option.
2. **The existing create endpoint (`skills-bff-api`, `skills-multipart-processing`) already owns that contract.** `POST /api/v1/skills` (`SkillsController.createSkill`, `apps/chat-api/src/skills/skills.controller.ts:321`) takes `skillManifest` + `filePaths` + `files[]`, validates them in `SkillsPackageService.validateAndBuildFormData` (`apps/chat-api/src/skills/package/skills-package.service.ts:48`), and calls `SkillsUploadService.createSkill` (`apps/chat-api/src/skills/upload/skills-upload.service.ts:66`), which sends `If-None-Match: *` to `uploadSkillFolder` and maps Core's `412` to `409`. This flow is correct and already tested; the import feature's job is only to produce the same three inputs (`skillManifest`, `filePaths`, `files[]`) from a ZIP, not to reimplement Core communication.

The nearest existing ZIP-ingress pattern is the Files domain's `POST /api/v1/files/upload-archive` (`files.controller.ts:121`, `archive-upload.interceptor.ts:18`, `files-upload.service.ts:212`), which disk-stages via Multer (`diskStorage`), extracts with `yauzl` in two passes (metadata-only entry count, then per-entry streaming), and cleans up the temp file in a `finalize()` regardless of outcome. That pattern is reused for disk staging, timeout/abort handling, and cleanup discipline — but not for its per-file upload semantics: Files' archive upload uploads each extracted entry independently to Core with per-entry conflict dedup, which is explicitly wrong for a Skill (a Skill is one atomic resource, not a bag of independent files). The investigation also found the Files `yauzl` service currently has **no explicit symlink or encrypted-entry rejection** — a gap this design does not inherit; Skill import adds both checks explicitly (see Decision D5).

`add-skill-authoring-ui` deferred the Catalog "Upload" entry with this design.md decision: *"A single direct action matches the existing Prompt/Toolset/Custom-App entries' shape exactly and needs zero new dropdown-nesting code, since `ButtonDropdown`'s `children` support... simply isn't exercised."* That decision is now superseded: `DropdownItem.children` (verified in `@epam/ai-dial-ui-kit`'s `dropdown.d.ts`) and two working examples of the pattern already exist in this codebase (`UserMenu.tsx:47`, `ConversationPanelView.tsx:456`), so shipping a two-child submenu with both children fully functional no longer carries the "broken/misleading affordance" risk the original deferral was protecting against.

## Goals / Non-Goals

**Goals:**
- Let a user upload a complete Skill as a single ZIP from the Catalog and have it appear as a normal, fully-formed Skill — same end state as authoring it by hand in the editor.
- Keep the archive-safety boundary entirely server-side; the BFF is the only place arbitrary user-supplied ZIP bytes are trusted to be inspected.
- Reuse the existing atomic create contract (`SkillsPackageService`, `SkillsUploadService.createSkill`) unchanged in its Core-facing behavior, so the two entry points (editor, import) can never diverge on what "a valid Skill" means.
- Make the operation genuinely atomic: any validation failure makes zero calls to Core, and success is exactly one whole-Skill create.

**Non-Goals:**
- Updating an existing Skill via archive (`PUT`/`If-Match` semantics) — import is create-only, matching the "Upload" affordance being a Catalog *create* action, not an editor *replace* action. A future change can add archive-based update if a product need appears.
- Any change to how Core is called for non-import Skill writes, or to the `GET /api/v1/skills/download` ZIP-producing contract.
- A generic "archive import framework" shared across entity types. The Files domain's archive upload has different semantics (partial success, per-file dedup) that must not be generalized into this atomic single-resource flow; a shared abstraction would need to serve both sets of semantics and is not justified by one call site.
- Reintroducing `SKILL_UPLOAD_MAX_BYTES` (retired by `fix-skill-editor-core-contract` because no ZIP is uploaded on the create/update path) — the new `SKILL_ARCHIVE_UPLOAD_MAX_BYTES` is a distinct variable for a distinct, newly-reintroduced ingress point, not a revival of the old one.
- Browser-side unzip-then-multipart (Alternative 1) as the security boundary. `apps/chat/src/utils/skill.ts:159`'s `fflate`-based `unpackSkillArchive` is explicitly for archives Core itself produced and is not hardened against adversarial input (no path-safety, zip-bomb, or entry-count checks); reusing it for user-uploaded archives would move the trust boundary into the browser.

## Decisions

### D1: Additive endpoint `POST /api/v1/skills/import`, not a variant of the existing create endpoint

**Decision:** Add a new route, `@Post('import')` on the existing `@Controller({ path: 'skills', version: '1' })`, resolving to `/api/v1/skills/import`, `operationId: 'importSkillArchive'`, rather than overloading `POST /api/v1/skills` to also accept a `file` field.

**Rationale:** `POST /api/v1/skills` has a settled, spec'd, tested contract (`skills-bff-api`, `skills-multipart-processing`) built around `skillManifest`/`filePaths`/`files[]` with 1:1 pairing — adding a mutually-exclusive "or send one ZIP instead" branch would double every validation path's meaning and blur the `@ApiBody` schema. A dedicated route keeps both contracts simple, keeps the "no ZIP anywhere in this path" invariant in `skills-multipart-processing` literally true for the endpoint it describes, and gives OpenAPI/Swagger and the generated client one unambiguous operation per capability.

**Alternatives considered:** (a) Overload `POST /api/v1/skills` with an optional `file` field — rejected, mixed-contract ambiguity. (b) A new `SkillsImportController` — rejected, one controller already owns `skills` and NestJS/Nx conventions here keep one domain in one controller unless it grows unreasonably large.

### D2: Request/response contract

`POST /api/v1/skills/import`:
- `multipart/form-data`, one required field `file` (binary, `application/zip`), Multer `.single('file')`.
- Bucket is **never** read from the client. The controller reads `req.user.bucket` (`SessionUser`, same source `createSkill` uses for auth) and passes it to the service — a client-supplied bucket is not trusted for this action, matching the product requirement.
- Success: `201 Created`, body `SkillImportResponseDto` (`{ name, path, url, etag }`). This is a new, small DTO rather than a reuse of the existing `SkillUploadResponseDto` (`{ etag }` only): unlike `createSkill`/`updateSkill`, whose caller already knows `bucket`/`path` because it supplied them, `importSkillArchive`'s caller does not know the destination path in advance — it is derived server-side from the archive manifest's `name` — so the response must tell the caller what was created. `SkillImportResponseDto` still wraps the same `etag` semantics `SkillUploadResponseDto` already defines, so the two types share meaning, not just a name.
- Errors: `400` (missing file, not-ZIP signature, corrupt archive, missing/invalid manifest, invalid path, ambiguous layout, duplicate paths) · `401` (not authenticated) · `403` (forbidden — parity with `createSkill`) · `409` (collision, Core's `412`) · `413` (single entry, decompressed total, or per-file over limit) · `422` (archive-level structural rejection that isn't a plain 400 — see D4 for the 400 vs 422 split) · `429` (`@Throttle`, same `{ limit: 5, ttl: 60000 }` window as `createSkill` — an import is exactly as expensive as a create) · `502`/`503` (Core unavailable, same mapping `mapDialHttpStatus` already provides).
- CSRF: covered by the same session-cookie + CSRF-token mechanism as every other mutating BFF endpoint (`docs/auth/`) — no new mechanism.
- Cache: none. This is a write endpoint; no response is cached, and it does not need to invalidate any BFF-side cache (Skill listing is a `GET` against Core, not cached in `apps/chat-api`).
- Rate limit: `@Throttle({ default: { limit: 5, ttl: 60000 } })`, matching `createSkill`/`updateSkill`.

### D3: Reuse `SkillsPackageService`/`SkillsUploadService`, add a new extraction service in front of them

**Decision:** A new `SkillsArchiveImportService` (name indicative; final name decided in implementation) is responsible only for: staging the ZIP to disk, extracting and validating archive-specific concerns (D4/D5), and producing `{ skillManifest: string, filePaths: string[], files: UploadedSkillFile[] }`. It then calls the **existing** `SkillsPackageService.validateAndBuildFormData` (re-validates path safety, count, and size limits against the now-extracted bytes — the archive service does not duplicate that logic) and the **existing** `SkillsUploadService.createSkill` for the Core call. `SkillsController.importSkillArchive` wires these together the same way `createSkill` wires `SkillsPackageService` + `SkillsUploadService` today.

**Rationale:** This is the crux of the design: two entry points (`multipart create`, `archive import`) converging on one Core-facing implementation means the "what is a valid Skill" rule can never diverge between them, and any future skills-multipart-processing spec change (e.g. a limit change) automatically applies to both. The new service's *only* new responsibility is archive-specific: is this a well-formed ZIP, does it contain exactly one Skill, and does its manifest parse — concerns `SkillsPackageService` has no reason to know about since it never receives a ZIP today.

**Alternatives considered:** (a) A monolithic `SkillsImportService` that reimplements path/size validation independently — rejected, duplicates and risks drifting from `skills-multipart-processing`. (b) Modify `SkillsPackageService` to optionally accept a ZIP — rejected, violates its own spec's "SHALL NOT construct, receive, or forward a ZIP archive anywhere in this path" for the *existing* create/update path, and conflates two different input shapes in one method.

### D4: Archive structural validation — 400 vs 422, wrapper-directory handling, ambiguity rejection

**Decision:** The extraction service performs, in order, before any bytes are handed to `SkillsPackageService`:

1. **Container check** (→ `400` on failure): file present, non-empty, ZIP local-file-header signature (`PK\x03\x04`) present at the start — not just `.zip` extension or client `Content-Type`. A corrupt/truncated archive that `yauzl` fails to open is `400 BadRequestException('Invalid or corrupted ZIP archive')`, mirroring `files-upload.service.ts`'s existing catch-all for this case.
2. **Entry-count and iteration ceiling** (→ `422 UnprocessableEntityException`): central-directory entry count capped at a small multiple of the Skill file-count limit (mirroring the Files service's `entryCount > maxFiles * 10` guard against directory-entry amplification), read metadata-only before any extraction, exactly as `files-upload.service.ts:212` does.
3. **Path normalization and single-wrapper detection**: every non-directory entry's path is decoded and checked (D5 below has the exact safety rules). If **every** entry's first path segment is identical and that segment is not itself `SKILL.md`, that segment is treated as an optional wrapper directory and stripped before the next steps (e.g. `docs-helper/SKILL.md` → `SKILL.md`, `docs-helper/scripts/run.sh` → `scripts/run.sh`). If entries disagree on a common first segment, no stripping happens and manifest lookup proceeds against the raw (unwrapped) paths.
4. **Exactly one manifest at the normalized root** (→ `422`): after optional unwrapping, there must be exactly one entry whose normalized path is exactly `SKILL.md` (case-sensitive — matching `SkillsPackageService`'s own `SKILL_MANIFEST_FILE` constant exactly, no case-insensitive fallback). Zero matches → `400 ('Archive is missing a root SKILL.md file')`. More than one normalized path equal to `SKILL.md` (e.g. one at the wrapper root and one unwrapped, or two differently-cased entries whose decoding still collides) → `422 ('Archive contains more than one SKILL.md — expected exactly one Skill per archive')`. This is also where "multiple Skills in one archive" is rejected: any layout that does not reduce to exactly one root manifest after at most one wrapper-strip is ambiguous by definition and hits this same check.
5. **Duplicate normalized paths** (→ `422`): after unwrapping, if two entries normalize to the same relative path (case-sensitive comparison, since the destination store is case-sensitive), reject — this also catches a wrapper-strip that accidentally collides two previously-distinct paths.
6. **Directory entries are not files**: entries whose raw name ends in `/` (or whose central-directory external attributes mark them as a directory) are skipped for counting and content, never treated as a zero-byte file.

The `422` vs `400` split follows the existing precedent in this codebase's Files archive-upload endpoint (`400` = "this isn't parseable as the thing we expect", `422` = "it parses, but its *content* violates a structural rule we can only know after reading the directory listing") and is preserved here rather than inventing a third convention.

**Rationale:** The product requirement explicitly asks for wrapper-directory support and ambiguity rejection; making this a distinct, ordered step before any manifest parsing keeps the manifest-parsing code (D6) simple and gives each failure mode one specific, testable status/message.

**Alternatives considered:** Reject wrapper directories entirely (require `SKILL.md` at the true archive root only) — rejected because common ZIP-export tools (including this repo's own `downloadSkillFolder`-produced structure, and most "download as ZIP" UIs elsewhere) place content under a named top-level folder; refusing that would make "download a Skill, re-upload it elsewhere" — a plausible real workflow — fail for no security reason.

### D5: Path-safety and entry-safety rules — reuse the existing Skill contract, extend for archive-specific threats

**Decision:** Every extracted entry's normalized relative path is checked against the **existing** `isValidSkillRelativePath` rules from `apps/chat-api/src/skills/utils/skill-path.util.ts` (no absolute path, no drive letter, no backslash, no empty/`.`/`..` segment, no control/NUL characters, no `.dial-resource`/`.dial-folder` segment, no reserved first segment such as `files`/`v`) — the same function `SkillsPackageService` already calls, imported and reused, not reimplemented. This is the ZIP-slip defense: the raw entry name from `yauzl` is decoded (matching the Files service's `decodeStrings: false` + manual decode approach, so a crafted archive can't abuse yauzl's own path validation short-circuiting the whole archive on one bad entry) and validated per-entry, never joined onto a filesystem path and trusted.

In addition to the existing rules, the extraction service rejects, per entry, before any content is read into memory:
- **Encrypted entries**: an entry whose general-purpose bit flag has bit 0 set (yauzl exposes this on the raw entry) is rejected — `422`, since decompression would require a password this flow never collects, and silently skipping it would create a Skill missing content the user thought they uploaded.
- **Symbolic links**: an entry whose Unix external file attributes (upper 16 bits) encode `S_IFLNK` is rejected — `422`. This closes the gap the investigation found in the Files domain's `yauzl` usage; it is added here explicitly rather than assumed inherited.
- **Any entry that is neither a regular file nor a directory** (device files, FIFOs, other Unix modes encoded in external attributes) — rejected `422`, same reasoning as symlinks.

**Rationale:** These are exactly the "unsupported ZIP features" the product requirement calls out, and are cheap metadata checks available before touching entry bytes — consistent with the two-pass, metadata-first design already used for the entry-count ceiling.

**Alternatives considered:** Trust `yauzl`'s own entry validation for names — rejected per the Files-service comment already in the codebase explaining exactly why: it aborts the whole archive on the first unsafe name rather than allowing this flow's more specific per-check status codes.

### D6: Content validation — decompression limits, UTF-8, YAML frontmatter, name-to-path mapping

**Decision:**
- **Decompressed-size enforcement is incremental, not metadata-trusted.** Each entry is decompressed via `openReadStreamPromise` with byte counting as data flows, and the read is aborted the instant a running total exceeds the applicable Skill limit (`SKILL_FILE_UPLOAD_MAX_BYTES` per file, `SKILL_UPLOAD_MAX_TOTAL_BYTES` overall) — the ZIP central directory's declared uncompressed-size field is never trusted alone, closing the classic zip-bomb vector (a tiny compressed entry claiming a small declared size while the deflate stream itself keeps producing bytes past it, or a manipulated central directory declaring a false size). This mirrors the Files service's use of `yauzl`'s streaming reads plus this design's own running-total check, rather than the alternative of reading `entry.uncompressedSize` and trusting it.
- **`SKILL.md` is decoded strict UTF-8.** A decode that hits an invalid byte sequence is a `400` ("Skill manifest is not valid UTF-8"), not a silent replacement-character fallback (`TextDecoder(..., { fatal: true })` equivalent on the Node side, i.e. manual validation rather than lossy decode).
- **YAML frontmatter is parsed** (reusing whatever the existing editor/manifest-parsing path uses — see `skill-manifest-parsing` spec — rather than a second parser) and requires non-empty string `name` and `description`; missing frontmatter, malformed YAML, or empty/non-string `name`/`description` is `400`.
- **Destination path is derived from the manifest's `name`**, not from the archive's filename or wrapper directory name (which is display/organizational only and already stripped in D4). The `name` field must independently satisfy the same "safe single-segment path" contract the editor's manual creation flow already enforces for a Skill's destination path (this is the broader existing contract, not a new "must already be canonical" requirement — an archive author gets the same latitude a manual-creation author gets). This choice is deliberate: the manifest text itself is **never rewritten** by the import path — whatever bytes the user's `SKILL.md` contains are exactly what gets stored, byte-for-byte — only the *destination path* is computed from `name` for the `path` argument to `SkillsUploadService.createSkill`, exactly as the editor's create flow already does for manually-typed Skills.
- **Collisions are rejected, never merged or overwritten.** This falls out of D3 for free: `SkillsUploadService.createSkill` already sends `If-None-Match: *` and already maps Core's `412` to `409` — the import path calls the identical method, so this behavior needs no new code, only a test proving it.

**Rationale:** Reusing the existing name→path and manifest-parsing logic (rather than writing archive-specific versions) is what makes "atomic and behaviorally identical to hand-authoring" true, and is the direct consequence of D3.

**Alternatives considered:** Trust the ZIP's declared uncompressed size fields and reject before streaming — rejected, this is precisely the zip-bomb trust failure the product requirement calls out ("do not trust ZIP metadata alone").

### D7: Disk staging, timeout, and cleanup

**Decision:** A dedicated Nest interceptor (a Skill-specific counterpart to `ArchiveUploadInterceptor`, or the same interceptor parameterized by a configurable field name and limit if that avoids near-duplicate code — decided during implementation, not by this design) stages the uploaded ZIP to a temp file via Multer `diskStorage`, enforcing `SKILL_ARCHIVE_UPLOAD_MAX_BYTES` as the Multer `fileSize` limit so an oversized upload is rejected by Multer itself before the extraction service ever runs. `SkillsArchiveImportService` then applies the same timeout/abort pattern `SkillsUploadService` already uses (`AbortSignal.any([signal, timeoutSignal])`, `req.on('close', ...)` from the controller) around extraction *and* the subsequent Core call, so a slow client disconnect or a stuck extraction cannot hold resources indefinitely. Cleanup uses the same `finally`/`finalize()`-style guarantee as `ArchiveUploadInterceptor.removeUploadedFile` — the temp file and any open `yauzl` handle are closed/removed on success, every validation failure, timeout, and unexpected error, verified with the same basename/path-containment check the Files interceptor already uses for the deletion step itself.

**Rationale:** Disk staging (not memory, unlike `SkillsModule`'s existing `memoryStorage()` for the discrete-files create endpoint) is necessary here because the *compressed* archive itself can legitimately be up to `SKILL_ARCHIVE_UPLOAD_MAX_BYTES`, decompressing to up to 16 MiB of validated content — holding the raw ZIP fully in Node memory in addition to the decompressed buffers being validated is unnecessary peak-memory pressure the Files domain already chose to avoid for exactly this reason.

**Alternatives considered:** Memory storage for the ZIP, matching the existing `SkillsModule` Multer config — rejected, that config is sized for `SKILL_FILE_UPLOAD_MAX_BYTES` (1 MiB) per discrete part, not for a compressed archive that may be substantially larger before decompression.

### D8: `SKILL_ARCHIVE_UPLOAD_MAX_BYTES` default and placement

**Decision:** New env var `SKILL_ARCHIVE_UPLOAD_MAX_BYTES`, validated in `EnvironmentVariables` alongside the other Skills-domain vars (`SKILL_UPLOAD_MAX_FILES`, `SKILL_FILE_UPLOAD_MAX_BYTES`, `SKILL_UPLOAD_MAX_TOTAL_BYTES`, `SKILL_TRANSFER_TIMEOUT_MS`), default **20,971,520 (20 MiB)** — deliberately larger than the 16 MiB decompressed-content ceiling `SKILL_UPLOAD_MAX_TOTAL_BYTES` already enforces, since a ZIP container adds local/central-directory overhead and most Skill content (Markdown, scripts, small assets) compresses poorly-to-not-at-all, so the compressed size realistically approaches, not shrinks far below, the uncompressed total. This is a distinct variable from the retired `SKILL_UPLOAD_MAX_BYTES` (per the load-bearing comment already in `environment.config.ts`: "The former `SKILL_UPLOAD_MAX_BYTES`... has been removed: no ZIP is ever uploaded on the create/update path since this change, so it has no remaining meaning") — this design reintroduces ZIP ingress at a *new*, additive endpoint, so a new name avoids resurrecting a variable a deployment may have already dropped or repurposed in its mind.

**Rationale:** Naming and placement follow the Files domain's precedent (`ARCHIVE_UPLOAD_MAX_BYTES` etc., all Multer `fileSize`-driven) applied to the Skills domain's own naming convention (`SKILL_*` prefix, matching its three existing size/count vars).

### D9: Catalog menu — nested `DropdownItem`, ownership split

**Decision:** In `CatalogView.tsx`'s `createOptions` memo, the existing flat `skill` push is replaced with:
```ts
options.push({
  key: 'skill',
  label: t(CatalogI18nKeys.CreateSkill),
  children: [
    {
      key: 'skill-write',
      label: t(CatalogI18nKeys.CreateSkillWriteInstructions),
      onClick: () => navigate(`${ROUTES.SkillEditor}?${new URLSearchParams({ [EditorQuery.ReturnUrl]: ROUTES.Catalog })}`),
    },
    {
      key: 'skill-upload',
      label: t(CatalogI18nKeys.CreateSkillUpload),
      onClick: handleSkillArchiveUploadClick, // opens the hidden file input via ref, from useSkillArchiveImport
    },
  ],
});
```
matching the exact shape already used for `exportAction` in `ConversationPanelView.tsx:456` (parent item with `label`, no `onClick`, `children: DropdownItem[]`). The hidden `<input type="file" accept=".zip">`, its ref, `onChange` (with `event.target.value = ''` reset **before** invoking the import, exactly as the conversation-import pattern at `ConversationPanelView.tsx:246` does), loading/success/error notification calls, and the `SkillsContext.refetchSkills()` call all live in the new `useSkillArchiveImport` hook and are rendered from `CatalogView` (an app component), not from `libs/catalog`. `libs/catalog`'s `CreateButton`/`CatalogProps.createOptions` needs **zero** code changes — it already accepts `DropdownItem[]` and already forwards `children` to `ButtonDropdown`/the underlying menu component, which already renders nested items (used today by `UserMenu`, `ConversationPanelView`).

**Rationale:** This is the direct unblock the investigation found: the library-side capability (`children` support) already exists and is exercised elsewhere, so the entire feature's app/lib boundary is satisfied by construction — the app assembles `DropdownItem[]` with app-owned callbacks; the lib only renders what it's given, per the library isolation rule.

**Alternatives considered:** A visible (non-hidden) "Choose file" button as the "Upload" child's rendered content, opening the file picker directly without an intermediate click — rejected as unnecessary complexity; the existing hidden-input + `.click()`-on-select pattern is simpler and already proven in this codebase.

### D10: Frontend state ownership — `useSkillArchiveImport` hook

**Decision:** A new `apps/chat/src/hooks/skills/useSkillArchiveImport.ts` owns: the file-input ref, a `status` state (`idle | uploading | success | error`), the `importSkillArchive` API call, mapping the BFF's error statuses to specific user-facing messages (400/413/422 → validation, 409 → collision, 429 → rate-limited, 502/503 → service unavailable), calling `useOperationNotification`'s `notifyOperationSuccess(NotifiableEntity.Skill, EntityOperation.Created, { name })` on success, and calling `SkillsContext`'s `refetchSkills()` after a successful create so the new Skill appears without a manual reload. `CatalogView` consumes the hook and wires its returned `triggerFilePicker`/`handleFileChange`/`isUploading` into the Create dropdown and the hidden input's props.

**Rationale:** `CatalogView.tsx` is already large (the investigation found the `createOptions` memo alone spans hundreds of lines); folding a full async upload/notify/refetch workflow directly into it would make an already-large component harder to review and test. A dedicated hook is independently unit-testable and matches this codebase's existing pattern of hooks owning one cohesive async workflow (e.g. `useFavicon.ts`'s documented pattern: `AbortController`, cancelled-flag, async/await).

**Alternatives considered:** Inline everything in `CatalogView` — rejected for the size/testability reason above. A new React Context for import state — rejected, the state is transient and local to one button's interaction, not shared across the tree; a hook is sufficient and matches `SkillsContext`'s own precedent of using Context only for genuinely cross-cutting state (the list itself), not per-action UI state.

### D11: "Created" notification copy addition

**Decision:** Add `entityNotifications.skill.createdTitle` / `entityNotifications.skill.created` i18n keys following the exact pattern the `entity-operation-notifications` spec already defines for every other catalog entity (`"Skill created successfully"` / `"You can now see skill \"{{name}}\" in the catalog and My collection."`), and add the corresponding `[EntityOperation.Created]` entry to the `NotifiableEntity.Skill` row in `ENTITY_OPERATION_NOTIFICATIONS` (`apps/chat/src/utils/entity-notification.ts`). This is the only cell in the entity-operation matrix that is currently `—` for an entity this change newly makes creatable through a second path; per that spec's own compile-time enforcement (`satisfies Record<NotifiableEntity, Partial<Record<EntityOperation, ...>>>`), the `notifyOperationSuccess(NotifiableEntity.Skill, EntityOperation.Created, ...)` call in D10 would not typecheck without this addition.

**Rationale:** Adding one map entry the existing spec's own mechanism already anticipates ("`**new**`" is exactly this spec's notation for cells this kind of change is expected to fill in) is strictly cheaper and more consistent than inventing bespoke success copy only for the import flow.

## Risks / Trade-offs

- **[Risk] A crafted ZIP with a highly compressible payload (zip-bomb) could attempt to exhaust memory/CPU during extraction even under the compressed-size cap.** → Mitigation: D6's incremental, running-total decompression check aborts the stream the instant any per-file or total limit is crossed, so peak memory is bounded by the limits themselves (1 MiB/file, 16 MiB total) regardless of how the compressed archive is shaped, not by the compressed size.
- **[Risk] Wrapper-directory auto-detection (D4) could be exploited to smuggle an ambiguous structure past validation** (e.g. two differently-named top-level directories, each containing a plausible `SKILL.md`, where stripping is skipped and the "exactly one root manifest" check needs to correctly still fire). → Mitigation: stripping only happens when *every* entry shares one common first segment; any archive with more than one top-level segment falls through to the un-stripped path check, which will find either zero or multiple `SKILL.md` matches and reject via the existing D4 step 4 logic — no separate code path is needed for the "ambiguous multi-directory" case, it's the same check.
- **[Risk] Introducing a second Skill-creation code path (archive vs. multipart) increases the surface where the two could silently diverge over time** (e.g. a future change to `SkillsPackageService`'s limits that the archive path forgets to also apply). → Mitigation: D3's architecture makes divergence structurally hard — the archive service does not reimplement path/size validation, it calls the same `SkillsPackageService.validateAndBuildFormData` the multipart endpoint calls, so a future limit change applies to both by construction; only the archive-specific concerns (D4–D6) are unique to this path and covered by their own tests.
- **[Risk] Disk-staging a second Multer path (this endpoint) alongside the existing memory-storage Skills Multer config (the create/update endpoint) adds module configuration complexity.** → Mitigation: scope the new interceptor/limits narrowly to the `import` route only (a per-route interceptor, not a module-wide `MulterModule.registerAsync` change), so the existing create/update endpoint's memory-storage behavior and limits are untouched.
- **[Trade-off] Requiring the manifest's `name` to already resolve to a safe destination path (D6) means a Skill whose original author used spaces, uppercase, or special characters in `name` will be rejected rather than auto-slugified.** This trades a small amount of import convenience for never silently rewriting user-authored content or destination paths in a way the user didn't ask for — consistent with the manual-creation flow's own existing behavior, which this design deliberately mirrors rather than special-cases.

## Migration Plan

Purely additive: a new route, a new service, a new env var (with a working default — no deployment action required to adopt this change), a new Catalog submenu, and one new notification-map entry. No existing endpoint, DTO, table, or stored Skill format changes, so there is no data migration and no coordinated rollout ordering with DIAL Core required.

**Rollout:** ship both the BFF endpoint and the Catalog UI in the same release (an endpoint with no UI entry point is dead code; a UI entry point calling a nonexistent endpoint is broken) — but the two can still be reviewed/merged as separable PRs/tasks since the endpoint has no effect on existing behavior until the UI calls it.

**Rollback:** revert the Catalog "Upload" UI first (drop back to a flat "Skill" action or leave the submenu with only "Write instructions" temporarily) — this immediately removes user-facing exposure to the new endpoint with a frontend-only change. The additive `POST /api/v1/skills/import` endpoint can then be removed independently and separately (it has no other caller and no stored state depends on it existing), without needing to coordinate the two reverts into one deploy.

## Open Questions

- Exact final name for the new backend service class (`SkillsArchiveImportService` vs. `SkillsImportExtractionService` vs. folding extraction and orchestration into two smaller classes) — left to implementation; does not affect the contract or specs.
- Whether the Skill-specific archive interceptor is a genuinely new class or a parameterized reuse of `ArchiveUploadInterceptor` — left to implementation; D7 states the required behavior, not the class structure.
- Exact `SKILL_ARCHIVE_UPLOAD_MAX_BYTES` default (20 MiB proposed in D8) may need adjustment based on real-world Skill archive sizes observed after this ships; the variable is externally configurable so this is a tuning question, not a design blocker.
