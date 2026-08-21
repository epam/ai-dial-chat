## Why

Today the only way to create a Skill is to write `SKILL.md` by hand in the Skill Editor (`catalog-create-options`, `skill-authoring`). Authors who already have a Skill packaged as a folder — exported from another tool, shared by a teammate as a ZIP, or produced by an external generator — have no way to bring it into the Catalog in one step; they must open the editor and recreate every file manually. `add-skill-authoring-ui` explicitly deferred this ("Catalog Upload submenu... per product decision, 'Skill' is a single direct Create action... with no nested menu") pending a decision on where archive validation belongs. `fix-skill-editor-core-contract` has since settled that question for the *write* path: DIAL Core's `PUT /v2/skills/{bucket}/{path}` never accepts a ZIP body, only discrete multipart parts. That leaves exactly one place a ZIP can legitimately be accepted from a user: an import boundary that unpacks and validates it, then drives the existing atomic multipart create.

## What Changes

- The Catalog Create dropdown's "Skill" entry becomes a nested submenu with two children: **"Write instructions"** (unchanged navigation to `/skill-editor?returnUrl=%2Fcatalog`) and **"Upload"** (opens a native file picker for one `.zip`, imports it, and refreshes the Catalog on success). **BREAKING** for the `catalog-create-options` requirement that currently mandates the Skill entry have no `children`.
- New BFF endpoint `POST /api/v1/skills/import` (`importSkillArchive`) on the existing versioned `SkillsController`: accepts one ZIP archive as `multipart/form-data`, safely extracts and validates it server-side under explicit limits, converts the validated package into the existing whole-Skill create shape (manifest text + relative paths + file bytes), and performs exactly one atomic `uploadSkillFolder` call with `If-None-Match: *` — reusing `SkillsPackageService`/`SkillsUploadService.createSkill` rather than duplicating them. A `412` collision from Core still maps to `409`.
- New Skill-specific archive extraction/validation service (disk-staged, size/entry/path/encryption/symlink/UTF-8/YAML-frontmatter checks) modeled on the Files domain's `yauzl`-based ZIP ingress, but scoped to a single Skill package and never partially uploading entries.
- New environment variable `SKILL_ARCHIVE_UPLOAD_MAX_BYTES` (compressed-ingress cap, separate from the existing decompressed-content limits) with validated config, `.env.template`, and README entries.
- Frontend: a new `apps/chat/src/hooks/skills/useSkillArchiveImport.ts` hook owns file selection, upload, notification, and `SkillsContext.refetchSkills()` refresh; a thin `importSkillArchive` wrapper is added to `apps/chat/src/server-api/skills.api.ts` using the generated `@epam/ai-dial-chat-api-client` method. `libs/catalog` gains no new knowledge beyond rendering a `DropdownItem` with `children` it already supports.
- New "Created" success-notification copy for `NotifiableEntity.Skill` (currently the only catalog entity in the `entity-operation-notifications` matrix with a `—` in that column), used by both the archive-import flow and, going forward, any other Skill-create path.
- No changes to the existing `POST /api/v1/skills`, `PUT /api/v1/skills`, or `GET /api/v1/skills/download` contracts, and no changes to how DIAL Core is called for non-import Skill writes.

## Capabilities

### New Capabilities
- `skill-archive-import`: the end-to-end whole-Skill ZIP import feature — Catalog "Upload" entry point, `POST /api/v1/skills/import` contract, server-side archive extraction/validation/security rules, atomicity and collision handling, and the frontend hook that wires file selection to the API call and Catalog refresh.

### Modified Capabilities
- `catalog-create-options`: the "Skill create option in catalog" requirement changes from "a single direct action — not a submenu" to a nested submenu with "Write instructions" and "Upload" children; the existing "No nested Upload sub-item is present" scenario is superseded.
- `entity-operation-notifications`: the Model/Skill row's "Created" column changes from `—` (not implemented) to `required`, with new `entityNotifications.skill.createdTitle`/`created` i18n keys added to the existing map.

## Impact

- **Frontend**: `apps/chat/src/components/CatalogView/CatalogView.tsx` (createOptions), new `apps/chat/src/hooks/skills/useSkillArchiveImport.ts`, `apps/chat/src/server-api/skills.api.ts` (new wrapper), `apps/chat/src/constants/translation-keys.ts` and `apps/chat/src/i18n/locales/en.json` (new keys), `apps/chat/src/utils/entity-notification.ts` (new map entry).
- **Backend**: `apps/chat-api/src/skills/skills.controller.ts` (new route), a new `SkillsImportService` (or equivalent) plus a Skill-specific archive-extraction helper under `apps/chat-api/src/skills/`, `apps/chat-api/src/skills/skills.module.ts` (new interceptor/provider registration), `apps/chat-api/src/config/environment.config.ts` and `.env.template` (new env var).
- **Generated client**: `libs/chat-api-client` regenerated (`npm run openapi`) to add `importSkillArchive` to `SkillsApi`.
- **Docs**: `apps/chat-api/README.md` (new env var), `docs/architecture.md` if the `ApiEndpoints` enum or a documented mechanism changes.
- **No data migration.** Additive endpoint and additive UI entry; existing create/update/download/editor flows are untouched.
