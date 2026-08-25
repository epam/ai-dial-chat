## Why

Skill archive import (`POST /api/v1/skills/import`) only accepts a ZIP, so a user with nothing more than a single-file Skill — just a `SKILL.md` manifest, no supporting files — must wrap it in a ZIP before they can use "Upload". That's needless friction for the common minimal case, and it's now worth fixing because the archive import pipeline (extraction, manifest validation, path derivation, atomic create) already contains every building block a standalone-manifest path needs — this is a thin extension, not new infrastructure.

## What Changes

- Extend `POST /api/v1/skills/import` to accept **either** a ZIP archive (unchanged) **or** a standalone file named exactly `SKILL.md` (case-sensitive) in the same `file` multipart field. The manifest branch is selected only by the multipart field's exact, case-sensitive filename (`SKILL.md` is itself the required manifest filename in the archive contract too, so this is not a loose extension check); anything else is handed to the existing ZIP-signature-based archive opener, and a file that is neither is rejected. The client's declared MIME type is never trusted for this decision.
- For a standalone `SKILL.md`: validate it as strict UTF-8, parse and validate its YAML frontmatter with the exact same rules the archive path already applies (non-empty string `name`/`description`, no silent rewriting), derive the destination Skill path from `name` using the existing path-safety contract, and create a Skill containing only that one manifest file — through the same unmodified atomic `SkillsUploadService.createSkill` call the archive path uses (one Core create, `If-None-Match: *`, same 409-on-collision mapping).
- Enforce the existing manifest per-file size limit (`SKILL_FILE_UPLOAD_MAX_BYTES`, currently applied per-entry to `SKILL.md` inside archives) against the standalone file too. The archive-specific compressed-ingress limit (`SKILL_ARCHIVE_UPLOAD_MAX_BYTES`) and the archive entry-count/total-decompressed-size limits do not apply to a standalone manifest — there is nothing to decompress and only one file.
- Reject any other `.md` filename (wrong case, e.g. `skill.md`, or any other name) as an unsupported input — do not silently accept a renamed file as a manifest.
- Update the frontend file picker's `accept` config so the same "Upload" action lets a user choose either a supported archive or a `SKILL.md` file, with client-side filename validation before submit (defense in depth only — the BFF remains the authority).
- Update Catalog "Upload" help copy/localized strings to state both accepted input forms.
- Update the OpenAPI/Swagger description for `importSkillArchive` (or rename if inspection during design shows the current name is misleading) and regenerate `libs/chat-api-client`.

No **BREAKING** changes: existing ZIP uploads, the endpoint path, the request field name, and the response shape are all unchanged.

## Capabilities

### New Capabilities

(none — this is a targeted extension of an existing capability, not a new one)

### Modified Capabilities

- `skill-archive-import`: the "Catalog Upload entry" and "`POST /api/v1/skills/import`" requirements are widened to describe a standalone `SKILL.md` file as a second accepted input form alongside the ZIP archive, with its own filename-detection, validation, size-limit, and error-mapping requirements added as new scenarios/requirements within the same spec (renamed if needed to reflect the widened scope — to be finalized during design).

## Impact

- **Backend** (`apps/chat-api/src/skills/`): `skills.controller.ts` (`import` route docs/response description), the Multer interceptor (`skill-archive-upload.interceptor.ts`, size-limit selection must branch on detected payload type), a new/extended service to detect ZIP-vs-manifest payload type and route to the existing extraction service or a new lightweight standalone-manifest path, reusing `skill-manifest-frontmatter.util.ts` and `skill-path.util.ts` unchanged, and `SkillsArchiveImportService`/`SkillsUploadService.createSkill` reused unmodified for the atomic create.
- **Frontend** (`apps/chat`): the hidden file input's `accept` attribute in `CatalogView.tsx`, `useSkillArchiveImport.ts` (client-side filename check before calling the API), localized strings in `en.json` describing the two accepted forms.
- **API contract**: `apps/chat-api` Swagger annotations for the `import` endpoint (description/examples only, no path/method/field change) → regenerate `libs/chat-api-client`.
- **Tests**: new BFF unit/controller cases for standalone-manifest detection, validation, size limits, and conflict/error mapping; new frontend unit cases for the widened `accept` and filename validation; regression cases confirming existing ZIP behavior is unchanged.
- **Docs**: `openspec/specs/skill-archive-import/spec.md` delta; assess `docs/architecture.md` and `apps/chat-api/README.md` for wording that describes the endpoint as ZIP-only.
