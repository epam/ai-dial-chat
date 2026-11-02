## Why

`@nx/enforce-module-boundaries` is on, but its only constraint is `sourceTag: '*'` → `onlyDependOnLibsWithTags: ['*']` (`eslint.config.mjs:43-48`), so it rejects no project-to-project import. The import rules in AGENTS.md "Library isolation" and `docs/architecture.md` "Module boundary rules" are enforced only in review; `docs/architecture.md` Decision Log row 17 lists this as open work. The 2026-10-26 refactoring audit ranks it as the second P1 item, because every later lib split relies on these boundaries holding.

Running `nx graph` also showed that both documents describe the graph wrongly:

- `docs/architecture.md` says feature libs import "`chat-shared` only". In fact they import each other: `catalog` → `publish-panel`; `attachment-canvas` → `sidebar`, `quotations`, `visualizer-connector`; `skills` → `catalog`, `conversation-input`; `toolset-editor` → `chat-hooks`; and more.
- AGENTS.md limits `chat-hooks` to `chat-shared`, `share`, `quotations`, `source-panel` and `attachment-canvas`. It actually also imports values from nine more libs: `catalog`, `skill-editor`, `scheduled-tasks`, `conversation-input`, `attachment-input`, `mcp-apps`, `publish-panel`, `chat-overlay` and `usage-dashboard`.

## What Changes

- Give every Nx project exactly one `type:*` tag in its existing manifest (`package.json` `nx.tags`, or `project.json` `tags` for the `tools/*-consumer-fixture` projects). Existing tags stay. `publishable` is read by `scripts/validate-docs.mjs`, and `npm:private` is added by Nx.
- Replace the wildcard constraint with one constraint per `type:*` tag. The constraints encode **today's graph**, so lint passes on the day this lands. That choice was made explicitly over enforcing AGENTS.md as written. The new rules:
  - only `type:app` and `type:hooks` may import `chat-api-client`;
  - `type:shared` libs, including `chat-shared`, depend only on other `type:shared` libs;
  - `chat-api` imports no workspace lib;
  - fixtures and sandboxes import no app and not `chat-api-client`;
  - Nx's built-in rules still forbid importing an app and relative imports that cross project lines.
- Correct the docs to match the code and the new rules:
  - AGENTS.md "Library isolation": `chat-hooks` → UI-lib imports, and UI lib → `chat-hooks` imports, are listed as known debt that lint allows today;
  - `docs/architecture.md` "Module boundary rules": the table and Decision Log row 17;
  - `openspec/config.yaml`: the module-boundary note;
  - `.claude/rules/libs.md`: a new project must carry a `type:*` tag.

Non-goals:

- Removing `chat-hooks`' extra dependencies or `toolset-editor` → `chat-hooks`. These are follow-ups.
- Restricting `type:ui` → `type:ui` imports.
- Adding `scope:*` tags.
- Changing `enforceBuildableLibDependency` or the existing `allow` list.

Acceptance criteria:

- `eslint.config.mjs` has no `sourceTag: '*'` constraint.
- Every project in `nx show projects` has exactly one `type:*` tag.
- `npm exec nx run-many -t lint` passes with no new disable comments.
- A new `node --test` spec, run in the PR workflow, proves that each of these fails with `@nx/enforce-module-boundaries`:
  - a UI lib importing `chat-api-client`;
  - `chat-shared` importing a UI lib;
  - `chat-api` importing `chat-shared`;
  - a fixture importing `chat-api-client`.
- `npm run validate:docs` and `npm run validate:specs` pass.

Alternatives considered:

- **Enforce AGENTS.md exactly.** Rejected for now: lint would fail until a large `chat-hooks` refactor lands inside this change.
- **Per-lib allowlist tags for `chat-hooks`' 14 dependencies.** Rejected: they would freeze the debt with more tags to maintain, and the user picked the simpler scheme.
- **Keep the wildcard and rely on review.** Rejected: the drift above shows review does not hold the line.

Rollback: this changes only lint configuration, manifest tags and docs, with no runtime effect. To roll back, revert the commit, or put the wildcard constraint back alone.

## Capabilities

### New Capabilities

- `workspace-module-boundaries`: the project type tags, the allowed dependency direction for each tag, and the rule that lint enforces both.

### Modified Capabilities

None. Existing specs that say "`@nx/enforce-module-boundaries` reports no violations", for example `usage-dashboard-lib` and `chat-hooks-package-distribution`, become stronger statements under the new rules without any change to their text.

## Impact

- **Config:** `eslint.config.mjs`.
- **Tests and CI:**
  - new `tools/module-boundaries.spec.mjs`;
  - new `lint:boundaries:test` script in the root `package.json`;
  - one step added to `.github/workflows/pr.yml`.
- **Manifests:**
  - all 30 `libs/*/package.json`;
  - `apps/chat`, `apps/chat-api`, `apps/chat-overlay-sandbox` and `apps/mcp-app-sandbox` `package.json`;
  - four `tools/*-consumer-fixture/project.json`.
- **Docs:** `AGENTS.md`, `docs/architecture.md`, `openspec/config.yaml`, `.claude/rules/libs.md`.
- **Scope note:** this touches every lib's manifest, but only `nx.tags`. No lib's `dependencies`, `peerDependencies` or exports change, so `npm run docs:install-matrix` is not affected.
- **Unaffected:** runtime code, published package contents, i18n and backend endpoints.
