## MODIFIED Requirements

### Requirement: Dependency direction per type tag

`eslint.config.mjs` SHALL configure `@nx/enforce-module-boundaries` with one `depConstraints` entry per `type:*` tag and no `sourceTag: '*'` entry. Each entry SHALL use a non-empty `onlyDependOnLibsWithTags`. Nx treats an empty list as "no restriction", so a kind that may import nothing lists only its own tag.

| Source tag        | `onlyDependOnLibsWithTags`                                 |
| ----------------- | ---------------------------------------------------------- |
| `type:app`        | `type:shared`, `type:ui`, `type:hooks`, `type:api-client`  |
| `type:hooks`      | `type:shared`, `type:ui`, `type:api-client`                |
| `type:ui`         | `type:shared`, `type:ui`, `type:hooks`                     |
| `type:shared`     | `type:shared`                                              |
| `type:api-client` | `type:api-client`                                          |
| `type:backend`    | `type:backend`                                             |
| `type:fixture`    | `type:shared`, `type:ui`, `type:hooks`                     |

Two edges in this table are allowed on purpose and limited by the guards in "The hooks/UI edges are guarded":

- `type:hooks` → `type:ui`: `chat-hooks` adapts DIAL Core data into feature libs' props, so it may import their types, enums and pure functions.
- `type:ui` → `type:hooks`: only `libs/toolset-editor` uses it.

The existing `enforceBuildableLibDependency` option and `allow` list SHALL stay as they are.

The `tools/*-consumer-fixture` projects resolve imports from their own `node_modules` of packed tarballs, which `@nx/enforce-module-boundaries` cannot see. `eslint.config.mjs` SHALL therefore also guard `tools/*-consumer-fixture/src/**` with a `no-restricted-imports` pattern for `@epam/ai-dial-chat-api-client`.

#### Scenario: The workspace lints clean on adoption

- **WHEN** `npm exec nx run-many -t lint` runs on the commit that adds the tags and constraints
- **THEN** no `@nx/enforce-module-boundaries` error is reported, and no new `eslint-disable` comment for that rule has been added

#### Scenario: A UI lib cannot import the generated API client

- **WHEN** a file under `libs/catalog/src` imports `@epam/ai-dial-chat-api-client`
- **THEN** lint reports an `@nx/enforce-module-boundaries` violation naming `type:ui` and the allowed tags

#### Scenario: chat-shared cannot import a feature lib

- **WHEN** a file under `libs/chat-shared/src` imports `@epam/ai-dial-catalog`
- **THEN** lint reports an `@nx/enforce-module-boundaries` violation

#### Scenario: The backend cannot import a frontend lib

- **WHEN** a file under `apps/chat-api/src` imports `@epam/ai-dial-chat-shared`
- **THEN** lint reports an `@nx/enforce-module-boundaries` violation

#### Scenario: A sandbox app cannot import the API client

- **WHEN** a file under `apps/chat-overlay-sandbox/src` imports `@epam/ai-dial-chat-api-client`
- **THEN** lint reports an `@nx/enforce-module-boundaries` violation naming `type:fixture`

#### Scenario: A consumer fixture cannot import the API client

- **WHEN** a file under `tools/scheduled-tasks-consumer-fixture/src` imports `@epam/ai-dial-chat-api-client`
- **THEN** lint reports a `no-restricted-imports` violation

#### Scenario: chat-hooks may still import the API client

- **WHEN** a file under `libs/chat-hooks/src` imports types or operations from `@epam/ai-dial-chat-api-client`
- **THEN** lint reports no boundary violation

### Requirement: Docs describe the enforced rules and the known debt

AGENTS.md "Library isolation", `docs/architecture.md` "Module boundary rules" and its Decision Log, `openspec/config.yaml` and `.claude/rules/libs.md` SHALL describe the type tags and the table above as what lint enforces. In particular:

- `docs/architecture.md` SHALL no longer say feature libs import `chat-shared` only.
- AGENTS.md and `docs/architecture.md` SHALL describe `type:hooks` → `type:ui` and `type:ui` → `type:hooks` as allowed edges with the limits and guards of "The hooks/UI edges are guarded", not as debt.
- AGENTS.md, `docs/architecture.md` and `.claude/rules/libs.md` SHALL state the ownership rule: `libs/chat-hooks` owns functions (hooks and pure utilities), and new domain types and enums go in `libs/chat-shared`. Types that describe one hook's own parameters or result may stay next to that hook.
- `.claude/rules/libs.md` SHALL require a `type:*` tag on any new project.

#### Scenario: The architecture doc matches the lint config

- **WHEN** a reader compares the `docs/architecture.md` boundary table with `depConstraints` in `eslint.config.mjs`
- **THEN** every source tag and allowed target tag appears in both, with the same meaning

#### Scenario: The ownership rule is discoverable

- **WHEN** a contributor reads AGENTS.md "Library isolation" before adding an enum used by both `chat-hooks` and a feature lib
- **THEN** the text tells them to put it in `libs/chat-shared`

## ADDED Requirements

### Requirement: The hooks/UI edges are guarded

`eslint.config.mjs` SHALL limit the two allowed hooks/UI edges with `no-restricted-imports` blocks. Each block SHALL also carry the general block's relative-import-extension pattern, because a later block replaces the rule's options rather than merging them.

- **Hooks guard:** non-test files under `libs/chat-hooks/src` (not `*.spec.*` and not under `tests/`) SHALL NOT import a name matching `^use[A-Z]` from any `type:ui` package.
- **Importer guard:** files under `libs/*/src`, other than in `libs/chat-hooks` and `libs/toolset-editor`, SHALL NOT import `@epam/ai-dial-chat-hooks` or its subpaths.
- **No rendering:** `libs/chat-hooks/src` SHALL contain no `.tsx` file outside `*.spec.*` files and `tests/` folders.

`tools/module-boundaries.spec.mjs` SHALL prove each guard.

#### Scenario: chat-hooks cannot import a hook from a feature lib

- **WHEN** a non-test file under `libs/chat-hooks/src` imports `useFavColumns` from `@epam/ai-dial-catalog`
- **THEN** lint reports a `no-restricted-imports` violation

#### Scenario: chat-hooks may import a feature lib's contract

- **WHEN** a non-test file under `libs/chat-hooks/src` imports `CatalogLimitStatus` or `getCatalogItemTabs` from `@epam/ai-dial-catalog`
- **THEN** lint reports no violation

#### Scenario: Only toolset-editor among feature libs imports chat-hooks

- **WHEN** a file under `libs/catalog/src` imports `@epam/ai-dial-chat-hooks`
- **THEN** lint reports a `no-restricted-imports` violation
- **AND WHEN** a file under `libs/toolset-editor/src` imports `getApiErrorDetails` from `@epam/ai-dial-chat-hooks`
- **THEN** lint reports no violation

#### Scenario: chat-hooks stays render-free

- **WHEN** `npm run lint:boundaries:test` runs
- **THEN** it fails if `libs/chat-hooks/src` contains a `.tsx` file outside `*.spec.*` files and `tests/` folders
