Slicing: risk-first. The risk is a hidden edge that makes lint fail once the wildcard goes, so slice 1 tags every project and swaps the constraints, then proves the whole workspace still lints before anything else is built on it. Slice 2 adds the regression test, slice 3 fixes the docs. No runtime code changes, and no lib gains host knowledge: only manifest `nx.tags` / `project.json` `tags` change under `libs/*`.

## 1. Tags and constraints

- [x] 1.1 Add `type:shared` to `nx.tags` in `libs/chat-shared/package.json`, `libs/chat-overlay/package.json` and `libs/visualizer-connector/package.json`.
- [x] 1.2 Add `type:api-client` to `libs/chat-api-client/package.json`, and `type:hooks` to `libs/chat-hooks/package.json`.
- [x] 1.3 Add `type:ui` to every other `libs/*/package.json` that lacks it. Six already carry it: `prompt-editor`, `prompts`, `settings-panel`, `share`, `skills`, `usage-dashboard`. Keep `publishable` and the existing order; append the new tag.
- [x] 1.4 Add the app and harness tags. Create the `nx` key where it is missing, as in `apps/chat-overlay-sandbox/package.json`.
  - `type:app` in `apps/chat/package.json`;
  - `type:backend` in `apps/chat-api/package.json`;
  - `type:fixture` in `apps/chat-overlay-sandbox/package.json` and `apps/mcp-app-sandbox/package.json`;
  - `type:fixture` in the `tags` of each `tools/*-consumer-fixture/project.json`: attachment-canvas, reusable-workflows, scheduled-tasks, usage-dashboard.
- [x] 1.5 Check that every project in `npm exec nx show projects` has exactly one `type:*` tag. Use `nx show project <name> --json`, or the `nx graph --file` export. This also covers the one gap design D3 names: a project that imports nothing and that nothing imports.
- [x] 1.6 In `eslint.config.mjs`, replace the `sourceTag: '*'` entry with the seven `depConstraints` entries from the spec table. Keep `enforceBuildableLibDependency` and `allow` unchanged. Update the block comment above the rule to say what it now enforces. Add the `tools/*-consumer-fixture` `no-restricted-imports` block (design D7).
- [x] 1.7 Run `npm exec nx run-many -t lint --skip-nx-cache`. If a project reports `@nx/enforce-module-boundaries`, **stop and report the edge**. Do not widen a constraint or add a disable comment.

Verification: 1.7 passes; `npm run validate:docs` passes and still checks the same publishable libs.

## 2. Regression test

- [x] 2.1 Add `tools/module-boundaries.spec.mjs` using `node:test` and the ESLint Node API, following `tools/publish-lib-package-json.spec.mjs`. Each case lints an in-memory import with `lintText(…, { filePath })` placed in the source project's `src/`. The five cases mirror the spec scenarios:
  - `libs/catalog` → `@epam/ai-dial-chat-api-client`: fails;
  - `libs/chat-shared` → `@epam/ai-dial-catalog`: fails;
  - `apps/chat-api` → `@epam/ai-dial-chat-shared`: fails;
  - `tools/scheduled-tasks-consumer-fixture` → `@epam/ai-dial-chat-api-client`: fails;
  - `libs/chat-hooks` → `@epam/ai-dial-chat-api-client`: passes.

  Test names describe the boundary, for example "a UI lib cannot import the generated API client".
- [x] 2.2 Add `"lint:boundaries:test": "node --test tools/module-boundaries.spec.mjs"` to the root `package.json`.
- [x] 2.3 In `.github/workflows/pr.yml`, add a `npm run lint:boundaries:test` step to the job that runs `npm run publish:lib:test`.

Verification: `npm run lint:boundaries:test` passes. To prove the test can fail, temporarily restore the wildcard constraint and confirm the four negative cases fail, then revert.

## 3. Docs

- [x] 3.1 `docs/architecture.md` "Module boundary rules":
  - replace the "convention today" paragraph and the intended-direction table with the enforced tag table;
  - keep the debt rows (`type:hooks` → `type:ui`, `type:ui` → `type:hooks`) labelled as known debt;
  - remove the incorrect "Feature libs: `chat-shared` only" row;
  - change Decision Log row 17 from "❓ Open" to accepted, noting the remaining debt.
- [x] 3.2 `AGENTS.md` "Library isolation":
  - after the second (`chat-hooks`) exception, add a short known-debt note listing the nine extra UI libs `chat-hooks` imports today and `toolset-editor` → `chat-hooks`;
  - state that lint allows these edges until a follow-up narrows them;
  - in "Module boundary rules" context, point to `eslint.config.mjs` as the enforcement.
- [x] 3.3 In `openspec/config.yaml`, replace the "current wildcard tag constraint does not enforce…" lines with a one-line pointer to the type tags and `docs/architecture.md`.
- [x] 3.4 In `.claude/rules/libs.md`, add a rule: every new project carries exactly one `type:*` tag. Add the kind table, or link to `docs/architecture.md`.
- [x] 3.5 Run `npm run validate:docs`, `npm run validate:agent-docs` and `npm run validate:specs`.

Verification: 3.5 passes. Then run `npm run verify:full` once to close the change.

## 4. Follow-ups (out of scope, file as separate changes)

- [x] 4.1 Propose the `chat-hooks` → UI-lib follow-up. Decided: keep the edge as an allowed, guarded one (types, enums and pure functions only, no hooks, no `.tsx`) — proposed as `allow-chat-hooks-ui-edges`.
- [x] 4.2 Propose the `toolset-editor` → `chat-hooks` follow-up. Decided: `chat-hooks` holds hooks, functions, types and enums but never a component, so the toolset-auth enums and `getApiErrorDetails` stay; `toolset-editor` takes a host `avatarPicker` and drops `GeneralForm` (`toolset-editor-host-avatar-resolver`), and the remaining edge is allowed and guarded (`allow-chat-hooks-ui-edges`).
