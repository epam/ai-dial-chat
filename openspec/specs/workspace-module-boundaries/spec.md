# Spec: workspace-module-boundaries

## Purpose

Specifies the Nx `type:*` project tags and the `@nx/enforce-module-boundaries` constraints in `eslint.config.mjs` that turn the AGENTS.md "Library isolation" import rules into lint errors, together with the known debt that lint still allows.

---

## Requirements

### Requirement: Every Nx project carries exactly one type tag

Every project reported by `nx show projects` SHALL declare exactly one tag of the form `type:<kind>` in the manifest Nx reads for it: `nx.tags` in its `package.json`, or `tags` in its `project.json` where one exists. The kinds and their members:

| Tag               | Projects                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `type:app`        | `apps/chat`                                                                                                                    |
| `type:backend`    | `apps/chat-api`                                                                                                                |
| `type:fixture`    | `apps/chat-overlay-sandbox`, `apps/mcp-app-sandbox`, and every `tools/*-consumer-fixture`                                      |
| `type:api-client` | `libs/chat-api-client`                                                                                                         |
| `type:hooks`      | `libs/chat-hooks`                                                                                                              |
| `type:shared`     | `libs/chat-shared`, `libs/chat-overlay`, `libs/visualizer-connector`                                                           |
| `type:ui`         | every other project under `libs/`                                                                                              |

Tags other than `type:*` SHALL be preserved. This includes `publishable`, which `scripts/validate-docs.mjs` reads to choose the libs it checks.

RTL: none. Feature flag: none. i18n: none. Memoisation: none. Accessibility: none. Telemetry: none. Cache: none.

#### Scenario: A project without a type tag is reported

- **WHEN** a project's manifest declares no `type:*` tag and the project imports any workspace lib
- **THEN** `@nx/enforce-module-boundaries` reports "A project without tags matching at least one constraint cannot depend on any libraries"

#### Scenario: The publishable tag survives

- **WHEN** `npm run validate:docs` runs after the type tags are added
- **THEN** it checks the same set of publishable libs as before

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

These rules encode the project graph as it stood when this requirement was written. Two of them are known debt rather than intent:

- `type:hooks` → `type:ui`: AGENTS.md allows `chat-hooks` only a short list of packages.
- `type:ui` → `type:hooks`: used today by `libs/toolset-editor`.

Narrowing either rule needs its own change. The existing `enforceBuildableLibDependency` option and `allow` list SHALL stay as they are.

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
- AGENTS.md SHALL list `chat-hooks`' imports of UI libs beyond its named exception as known debt that lint currently allows.
- `.claude/rules/libs.md` SHALL require a `type:*` tag on any new project.

#### Scenario: The architecture doc matches the lint config

- **WHEN** a reader compares the `docs/architecture.md` boundary table with `depConstraints` in `eslint.config.mjs`
- **THEN** every source tag and allowed target tag appears in both, with the same meaning
