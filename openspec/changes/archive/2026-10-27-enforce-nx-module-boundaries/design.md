## Context

`@nx/enforce-module-boundaries` (Nx 23.2) is configured in the `**/src/**` block of `eslint.config.mjs` with `enforceBuildableLibDependency: true`, an `allow` entry for eslint config files, and one wildcard `depConstraints` entry. Every one of the 38 projects has a `lint` target.

Today's tags:

- 29 of the 30 libs carry `publishable`, which `scripts/validate-docs.mjs` (`isPublishable`) reads.
- Six libs carry `type:ui`. Nothing reads it.
- Nx adds `npm:private` to every project.
- Apps, sandboxes and fixtures carry no tag of their own.

The project graph from `nx graph --file`, which counts spec files too:

- **Leaf libs:** `chat-shared`, `chat-overlay`, `visualizer-connector` and `chat-api-client` import no workspace project.
- **`chat-api`** imports no workspace project.
- **Feature libs** import `chat-shared` and each other. `toolset-editor` also imports `chat-hooks`.
- **`chat-hooks`** imports `chat-api-client`, `chat-shared` and 13 feature libs.
- **`apps/chat`** imports every lib.
- **Fixtures and sandboxes** import feature libs, `chat-hooks` or `chat-overlay`. None imports `chat-api-client`.

Two facts about Nx's rule shape the design. Both were checked in `node_modules/@nx/eslint-plugin/dist/src/rules/enforce-module-boundaries.js`:

1. An `onlyDependOnLibsWithTags` list is checked only when it is non-empty. `[]` means "anything".
2. A source project that matches no constraint is reported with `projectWithoutTagsCannotHaveDependencies` as soon as it imports a workspace project. An untagged target is rejected by every non-wildcard `onlyDependOnLibsWithTags` list.

## Goals / Non-Goals

**Goals:**

- Lint enforces the dependency direction, and lint passes on adoption.
- Every boundary that AGENTS.md states and the graph already respects becomes a hard rule: the API-client restriction, leaf libs staying leaves, the backend not importing frontend libs, and fixtures behaving like external hosts.
- The docs say what lint enforces, including where the code departs from the stated policy.

**Non-Goals:** removing existing debt edges, `scope:*` tags, layering among UI libs, and changes to `allow` or `enforceBuildableLibDependency`.

## Decisions

**D1 — One `type:*` kind per project, seven kinds.** The kinds are `app`, `backend`, `fixture`, `api-client`, `hooks`, `shared` and `ui`. The existing `type:ui` tag is reused as the kind for feature libs, so six manifests already have the right tag.

- `chat-overlay` and `visualizer-connector` join `chat-shared` as `type:shared`. They are dependency-free protocol packages that `chat-shared`-level code could reasonably use.
- `chat-hooks` and `chat-api-client` each get a kind of their own, because AGENTS.md treats them as named exceptions.
- **Rejected: a `scope:frontend`/`scope:backend` second axis.** `chat-api` imports no lib, so one `type:backend` kind gives the same guarantee with half the tags.

**D2 — A kind that may import nothing lists only its own tag.** This covers `type:shared`, `type:api-client` and `type:backend`. It works around fact 1 without `notDependOnLibsWithTags` lists, which would have to grow every time a kind is added. No other project carries `type:backend` or `type:api-client`, so the rule reads as "nothing".

**D3 — No catch-all constraint, and no separate tag-coverage script.** Fact 2 already rejects an untagged project that imports a workspace lib. Every onlyDependOn list also rejects importing an untagged project, so a forgotten tag fails lint from either side. The one gap is an untagged project that nothing imports and that imports nothing. It is harmless, and `tasks.md` checks for it once by hand. **Rejected: a node script that asserts coverage.** It would duplicate what Nx already does.

**D4 — Tags go where Nx already reads project config.**

- Libs and the four `apps/*` projects: `package.json` `nx.tags`. Add the `nx` key where it is missing, as in `apps/chat-overlay-sandbox`.
- `tools/*-consumer-fixture`: `project.json` `tags`, because those projects already have a `project.json`.

Tag arrays keep their existing order, and the `type:*` tag goes last.

**D5 — Debt edges are allowed by kind, not by project.** `type:hooks` → `type:ui` and `type:ui` → `type:hooks` stay open for every member of those kinds. This is the "lock in today's graph" option the user chose over an exact AGENTS.md encoding and over a per-lib allowlist. The cost is that a new `chat-hooks` → UI-lib import will not fail lint. Docs list it as debt, and a follow-up change should narrow the rule.

**D6 — Regression test for the negative cases.** Add `tools/module-boundaries.spec.mjs`, a `node --test` spec that follows the existing `tools/*.spec.mjs` pattern. For each forbidden edge in the spec, it calls `ESLint.lintText(source, { filePath })`, using a synthetic `filePath` inside the source project's `src/`. It asserts one `@nx/enforce-module-boundaries` message per case. It also asserts that the allowed `chat-hooks` → `chat-api-client` case gives none. The spec runs as `npm run lint:boundaries:test` in the `.github/workflows/pr.yml` job that already runs `publish:lib:test`. No file is written to disk. **Rejected: one-off manual scratch imports.** They prove the rule once and never again.

**D7 — `tools/*-consumer-fixture` are guarded by `no-restricted-imports` (found during apply).** These fixtures install packed tarballs into their own `node_modules`. An import there resolves to neither an Nx project nor an npm node of the root graph, so `@nx/enforce-module-boundaries` skips it silently. Neither `onlyDependOnLibsWithTags` nor `bannedExternalImports` fires. A dedicated `eslint.config.mjs` block for `tools/*-consumer-fixture/src/**` bans `@epam/ai-dial-chat-api-client` with `no-restricted-imports`. The block sits after the general `**/*.ts` block, which sets the same rule, and repeats that block's relative-extension pattern, shared through the `relativeImportExtensionPattern` const. The two `apps/*` sandboxes resolve through the workspace, so the `type:fixture` constraint covers them. **Rejected: `bannedExternalImports`.** It was verified to report nothing for these files.

## Risks / Trade-offs

- **[Risk] The Nx lint cache hides violations on the first run.** → Mitigation: run `nx run-many -t lint --skip-nx-cache` once. `eslint.config.mjs` and the manifests are already lint inputs, so later runs invalidate correctly.
- **[Risk] A dynamic `import()` or type-only import that the graph missed produces a violation.** → Mitigation: the full lint run is the acceptance gate. Any surprise is reported, and the constraint is not loosened silently.
- **[Risk] Docs keep promising stricter rules than lint enforces.** → Mitigation: the architecture table is rewritten from `depConstraints` itself, and debt rows are labelled as debt.
- **[Trade-off] `type:ui` stays a flat layer.** UI-to-UI imports remain unconstrained. This is acceptable until a lib split needs layering.

## Migration Plan

This is a single commit: tags, then constraints, then docs. Rollback is reverting the commit, or restoring only the wildcard entry. Neither has a runtime effect.

## Open Questions

None blocking. Follow-ups to file after this change:

- Narrow `type:hooks` → `type:ui` to the five packages AGENTS.md names, after moving the shared types they need into `chat-shared`.
- Decide whether `toolset-editor` should take its `chat-hooks` hook as a prop.
