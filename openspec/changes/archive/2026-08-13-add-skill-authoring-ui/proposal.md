## Why

DIAL Chat's Skills BFF API (`apps/chat-api/src/skills/`, `apps/chat/src/server-api/skills.api.ts`) already lets a user list, upload, and delete a Skill (a ZIP archive with a root `SKILL.md`), but there is no UI to author one. Users who want to create a Skill today have no in-product path to do so. This change adds the minimal authoring surface — a Catalog entry point and a "Create skill" page — so a user can write a Skill's name, description, and instructions and have the app package and upload it, without yet building the full Skill catalog experience (listing, details, favorites, sharing, publishing, "use in chat").

## What Changes

- Add a "Skill" entry to the Catalog's Create dropdown (`libs/catalog/src/components/Catalog/CreateButton.tsx` via `apps/chat/src/components/CatalogView/CatalogView.tsx`'s `createOptions`) that navigates directly to a new Create-skill route, mirroring the existing Prompt entry — no nested submenu, no feature flag (see Impact for the rationale on both).
- Add `ROUTES.SkillEditor = '/skill-editor'` and a lazy-loaded `apps/chat/src/pages/SkillEditor/SkillEditor.tsx` page, following the `PromptEditor` page's responsibility split (routing/`returnUrl`, user bucket, i18n, notifications, API calls, navigation).
- Create a new host-agnostic React library `@epam/ai-dial-skill-editor` (`libs/skill-editor/`), scaffolded to match `libs/prompt-editor/`'s package shape, that owns only form-field state, file-tree selection/expansion state, and inline presentation — no REST, YAML, ZIP, routing, auth, feature-flag, or i18n knowledge.
- The `SkillEditor` app page normalizes the skill name, serializes YAML frontmatter (via the installed `yaml` package) and a ZIP archive (via `fflate`) containing a root `SKILL.md` plus any supporting files/folders the user added, and calls `uploadSkill` from `apps/chat/src/server-api/skills.api.ts`.
- The Create flow does a `listSkills` preflight check before calling `uploadSkill` to avoid clobbering an existing skill, and surfaces a conflict error if the upload still lands on an existing path — this is a best-effort, not atomic, guarantee (see Impact).
- Add full state/error handling for the create form: initial/dirty/submitting/success/failure states, disabled actions while submitting, inline validation, and interpretation of `400`/`409`/`412`/`413`/`422`/`503` responses from `uploadSkill`.
- WCAG 2.1 AAA accessibility and full RTL support for the new page and library, per repo-wide rules.

**Non-goals** (explicitly out of scope for this slice):
- Skill catalog listing, details view, favorites, editing an existing skill, deletion, sharing, publishing, or "use in chat" — only Skill *creation* is in scope.
- The Catalog screenshot's "Upload" sub-action (uploading an existing `SKILL.md`/ZIP/`.skill` file as a whole skill from the Catalog's Create menu) is deferred; per product decision, "Skill" is a single direct Create action that opens the "Write instructions" editor, with no nested menu.
- No new `OverlayFeature` flag is introduced; per product decision, the Skill Catalog entry and editor route ship unconditionally (see Impact).
- Adding/removing supporting files and folders in the editor's Files pane (including "upload from device" for an individual supporting file, seen in the mobile design's bottom sheet) is in scope only as far as building the in-memory package structure; no arbitrary binary-file *content* editor is introduced.

## Capabilities

### New Capabilities
- `skill-editor-library`: The `@epam/ai-dial-skill-editor` package's public surface, its internal state ownership (form fields, file-tree selection/expansion, inline loading/error presentation), and its isolation from REST/YAML/ZIP/routing/auth/feature-flag/i18n concerns — mirrors the `publish-panel-library` capability's structure for `libs/publish-panel`.
- `skill-authoring`: The end-to-end app-level Create-skill flow — route and `returnUrl` handling, user-bucket resolution and the no-bucket error state, DIAL name normalization, YAML frontmatter and ZIP serialization, the `uploadSkill` call and its create-vs-replace preflight, API error interpretation (`400`/`409`/`412`/`413`/`422`/`503`), notifications, and post-success/cancel navigation — mirrors the `toolset-authoring` capability's structure for the toolset editor flow.

### Modified Capabilities
- `catalog-create-options`: Adds a "Skill" entry to the Catalog's Create dropdown that navigates to the new `/skill-editor` route in create mode, unconditionally (no feature-flag gating), alongside the existing Prompt/Toolset/Custom App/Quick App entries.

## Impact

- **Affected code**: `apps/chat/src/components/CatalogView/CatalogView.tsx` (new `createOptions` entry), `apps/chat/src/types/routes.ts` (`ROUTES.SkillEditor`), `apps/chat/src/app/app.tsx` (new lazy route), new `apps/chat/src/pages/SkillEditor/SkillEditor.tsx`, new `libs/skill-editor/` library, `apps/chat/src/i18n/locales/en.json` (new keys). No changes to `apps/chat-api/src/skills/**` or the generated `SkillsApi` client — the backend contract is reused as-is.
- **Dependencies**: New workspace dependency on `@epam/ai-dial-skill-editor` from `apps/chat`; the app adapter's ZIP/YAML serialization reuses the already-installed `fflate` and `yaml` packages (already dependencies of `apps/chat-api`/other app code; frontend usage is new but adds no new third-party package).
- **API gap — no atomic create-only semantics**: The generated `SkillsApi.uploadSkill` (`PUT /api/v1/skills`, `libs/chat-api-client/src/generated/src/apis/SkillsApi.ts:667-696`) is an unconditional upsert; its `ifMatch` parameter only guards *updates* against a stale ETag via `If-Match` and there is no `If-None-Match`/create-only primitive anywhere in the BFF or DIAL Core contract (confirmed against `apps/chat-api/src/skills/skills.controller.ts` and the archived `openspec/changes/archive/2026-08-10-add-skills-bff-api/design.md` D2 matrix). Per product decision, this change ships with a `listSkills` preflight check plus conflict-error messaging as a best-effort mitigation, documents the residual TOCTOU race explicitly in `design.md`, and files atomic create-only support as a follow-up backend API-gap item rather than blocking this UI slice on it.
- **No new feature flag**: Per product decision, the Skill Catalog entry point and `/skill-editor` route are not gated by a new `OverlayFeature` member (unlike `OverlayFeature.Prompts`). This is simpler to ship but means embedding hosts cannot opt out of the new surface independently of the rest of the Catalog; this is an accepted tradeoff for this slice given the low blast radius (an additive Create option and a new route).
- **Compatibility / rollback**: Purely additive — a new route, a new library, one new Catalog dropdown entry, and new i18n keys. Rollback is a revert of this change; no data migration, no existing-behavior change to any other Create option or to the Skills BFF API.
- **Alternatives considered**: (1) Building the Files pane directly on `@epam/ai-dial-react-file-manager`'s `DialFoldersTree` primitive instead of a bespoke tree in `libs/skill-editor` — adopted, see `design.md`. (2) Gating behind a new `OverlayFeature.Skills` flag — rejected per product decision above. (3) Blocking this change on a backend `If-None-Match` addition — rejected per product decision above; tracked as a follow-up.
