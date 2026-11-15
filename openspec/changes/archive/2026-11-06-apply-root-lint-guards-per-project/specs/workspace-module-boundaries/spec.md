## ADDED Requirements

### Requirement: Root-relative lint guards apply under per-project lint

Every config object in the root `eslint.config.mjs` whose `files` or `ignores` globs are written from the repository root (`apps/*`, `libs/*`, `tools/*`) SHALL set `basePath` to the absolute workspace root. The same glob then selects the same files whether ESLint runs from the repository root or from a project folder, the way `nx lint` runs it.

`tools/module-boundaries.spec.mjs` SHALL prove this for the hooks guard and the importer guard, by linting a probe file with `cwd` set to the owning project folder.

#### Scenario: The importer guard fires under nx lint

- **WHEN** ESLint runs from `libs/catalog`, as `nx lint` does, on a file that imports `@epam/ai-dial-chat-hooks`
- **THEN** it reports a `no-restricted-imports` violation

#### Scenario: The hooks guard fires under nx lint

- **WHEN** ESLint runs from `libs/chat-hooks` on a non-test file that imports `useFavColumns` from `@epam/ai-dial-catalog`
- **THEN** it reports a `no-restricted-imports` violation

## MODIFIED Requirements

### Requirement: The hooks/UI edges are guarded

`eslint.config.mjs` SHALL limit the two allowed hooks/UI edges with `no-restricted-imports` blocks. Each block SHALL also carry the general block's relative-import-extension pattern, because a later block replaces the rule's options rather than merging them.

- **Hooks guard:** non-test files under `libs/chat-hooks/src` (not `*.spec.*` and not under `tests/`) SHALL NOT import a name matching `^use[A-Z]` from any `type:ui` package. The exception is the data-shape packages `AGENTS.md` lets `chat-hooks` depend on: `@epam/ai-dial-chat-shared`, `@epam/ai-dial-share`, `@epam/ai-dial-quotations`, `@epam/ai-dial-source-panel` and `@epam/ai-dial-attachment-canvas`.
- **Importer guard:** files under `libs/*/src`, other than in `libs/chat-hooks` and `libs/toolset-editor`, SHALL NOT import `@epam/ai-dial-chat-hooks` or its subpaths.
- **No rendering:** `libs/chat-hooks/src` SHALL contain no `.tsx` file outside `*.spec.*` files and `tests/` folders.

`tools/module-boundaries.spec.mjs` SHALL prove each guard.

#### Scenario: chat-hooks cannot import a hook from a feature lib

- **WHEN** a non-test file under `libs/chat-hooks/src` imports `useFavColumns` from `@epam/ai-dial-catalog`
- **THEN** lint reports a `no-restricted-imports` violation

#### Scenario: chat-hooks may import a feature lib's contract

- **WHEN** a non-test file under `libs/chat-hooks/src` imports `CatalogLimitStatus` or `getCatalogItemTabs` from `@epam/ai-dial-catalog`
- **THEN** lint reports no violation

#### Scenario: chat-hooks may call a data-shape package hook

- **WHEN** a non-test file under `libs/chat-hooks/src` imports `useAttachmentCanvas` from `@epam/ai-dial-attachment-canvas`
- **THEN** lint reports no violation

#### Scenario: Only toolset-editor among feature libs imports chat-hooks

- **WHEN** a file under `libs/catalog/src` imports `@epam/ai-dial-chat-hooks`
- **THEN** lint reports a `no-restricted-imports` violation
- **AND WHEN** a file under `libs/toolset-editor/src` imports `getApiErrorDetails` from `@epam/ai-dial-chat-hooks`
- **THEN** lint reports no violation

#### Scenario: chat-hooks stays render-free

- **WHEN** `npm run lint:boundaries:test` runs
- **THEN** it fails if `libs/chat-hooks/src` contains a `.tsx` file outside `*.spec.*` files and `tests/` folders
