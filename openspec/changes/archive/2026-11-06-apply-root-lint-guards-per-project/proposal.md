## Why

Four blocks in the root `eslint.config.mjs` select files with globs written from the repository root:

| Block | Glob |
| --- | --- |
| Raw `role="status"`/`"alert"` guard | `apps/*/src/**/*.tsx`, `libs/*/src/**/*.tsx` |
| Consumer-fixture API-client guard | `tools/*-consumer-fixture/src/**` |
| `chat-hooks` hooks guard | `libs/chat-hooks/src/**` |
| Feature-lib importer guard (only `toolset-editor` may import `chat-hooks`) | `libs/*/src/**` |

`nx lint` runs `eslint .` from each project's folder, with the project's own `eslint.config.mjs`, which spreads the root config. ESLint matches `files` and `ignores` against the directory of the config file in use, which is the project folder. There, `libs/chat-hooks/src/**` matches nothing.

So all four guards are inert in `nx lint`, `npm run lint:check` and the CI workspace lint job, even though `.claude/rules/a11y.md`, `AGENTS.md` and `docs/architecture.md` say lint enforces them. `tools/module-boundaries.spec.mjs` still passes, because it lints in memory from the repository root, where the globs do match.

With the guards made active, three imports in `libs/chat-hooks` fail the hooks guard:

- `useAttachmentAction` and `useOpenMcpAppCanvas` call `useAttachmentCanvas` from `@epam/ai-dial-attachment-canvas`;
- `useConversationAnnotationPool` calls `useHtmlTagAnnotationGroups` from `@epam/ai-dial-quotations`.

`AGENTS.md` explicitly lets `chat-hooks` depend on both packages, as host-agnostic data-shape packages. The guard was simply written over every `type:ui` package.

## What Changes

- **Set `basePath` on the four blocks.** Each gets `basePath` set to the absolute workspace root, computed from `import.meta.url` in the root config. This uses ESLint 9.30+ flat-config `basePath`; the installed version is 9.39. The blocks then match the same files from the root and from any project folder.
- **Narrow the hooks guard.** It no longer covers the data-shape packages that `AGENTS.md` names as `chat-hooks` dependencies:
  - `chat-shared`, `share`, `quotations`, `source-panel` and `attachment-canvas`.
  - Hooks from every other `type:ui` lib stay forbidden.
  - `AGENTS.md` and `docs/architecture.md` say so.
- **Guard the guard.** `tools/module-boundaries.spec.mjs` lints probes with `cwd` set to the project folder, the way `nx lint` does, and asserts that both hooks/UI guards fire. Without `basePath` these cases fail. It also asserts that a data-shape package hook is allowed.

No code changes. The three `chat-hooks` imports are legitimate under the narrowed rule.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `workspace-module-boundaries`: root-relative guards apply under per-project lint, and the hooks guard exempts the data-shape packages.

## Impact

- **Config:** `eslint.config.mjs`.
- **Tooling:** `tools/module-boundaries.spec.mjs`.
- **Docs:** `AGENTS.md` and `docs/architecture.md`.
- **Unaffected:** runtime behavior and every lib's public API.
