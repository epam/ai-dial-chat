## ADDED Requirements

### Requirement: Every configured project typechecks production and test sources

The workspace SHALL expose a documented full-workspace typecheck command that
runs the `typecheck` target of every project configured with one, and that
target SHALL check both the project's production sources and its test sources.
A project whose `tsconfig.json` references a `tsconfig.spec.json` SHALL have
that spec project checked as part of its `typecheck` target.

#### Scenario: Full command covers every configured project

- **WHEN** a maintainer runs the documented full-workspace typecheck command
- **THEN** the run reports a result for every project that declares a
  `typecheck` target, with no project silently skipped
- **AND** the command exits `0` only if every one of those projects reported no
  TypeScript diagnostics

#### Scenario: A type error in a test source fails the project's typecheck

- **WHEN** a TypeScript type error is introduced into a `*.spec.ts`,
  `*.spec.tsx`, `*.test.ts` or `*.test.tsx` file of any project that declares a
  `typecheck` target
- **THEN** that project's `typecheck` target exits nonzero and reports the
  diagnostic with its file, line and TS error code

#### Scenario: A type error in a production source fails the project's typecheck

- **WHEN** a TypeScript type error is introduced into a non-test source file of
  any project that declares a `typecheck` target
- **THEN** that project's `typecheck` target exits nonzero and reports the
  diagnostic with its file, line and TS error code

### Requirement: Typecheck results invalidate on every input that can change them

Each `typecheck` target SHALL declare, as cache inputs, every file whose
content can change its result: the project's production sources, its test
sources, its own tsconfig files, the shared `tsconfig.base.json`, and the
declaration outputs of the projects it references. A cached result SHALL NOT be
reused when any of those inputs has changed.

#### Scenario: Changing a test source invalidates a previously cached success

- **WHEN** a project's `typecheck` target has completed successfully and its
  result is cached, and a test source of that project is then modified to
  contain a type error
- **THEN** the next run of that target does not report a cache hit
- **AND** the target re-runs the compiler and exits nonzero

#### Scenario: Changing a shared tsconfig invalidates dependent results

- **WHEN** `tsconfig.base.json` or a project's own `tsconfig.json`,
  `tsconfig.app.json`, `tsconfig.lib.json` or `tsconfig.spec.json` is modified
- **THEN** the affected projects' cached typecheck results are not reused

#### Scenario: Changing a referenced project's sources invalidates the consumer

- **WHEN** a source file changes in a project that another project references
  through TypeScript project references
- **THEN** the referencing project's cached typecheck result is not reused

### Requirement: Typecheck targets declare and restore their declaration outputs

A `typecheck` target that emits TypeScript declarations SHALL declare those
declarations and its `tsbuildinfo` as target outputs, so that a cached result
restores exactly the artifacts a dependent project's typecheck consumes. A
target SHALL NOT report a cache hit while the declaration artifacts a dependent
project references are absent from the working tree.

#### Scenario: Cache hit restores the declarations a dependent project needs

- **WHEN** a project's declaration output directory has been deleted and its
  `typecheck` target is run with caching enabled and a matching cache entry
  present
- **THEN** the declaration files and `tsbuildinfo` are restored to the working
  tree before the run is reported as successful
- **AND** a dependent project's `typecheck` run immediately afterwards resolves
  those declarations and reports no `TS6305` diagnostic

#### Scenario: Declarations and bundles do not share an output directory

- **WHEN** a project has both a `typecheck` target that emits declarations and
  a bundler `build` target that clears its own output directory
- **THEN** the two targets write to different directories, so neither target's
  outputs can delete or invalidate the other's

#### Scenario: A stale build-info cannot mask missing declarations

- **WHEN** a project's declaration files are absent for any reason while its
  `tsbuildinfo` is present
- **THEN** running the project's `typecheck` target regenerates the missing
  declarations rather than reporting the project up to date
- **AND** dependent projects do not report `TS6305`

### Requirement: Typechecking is reproducible from a clean checkout

The documented full-workspace typecheck command SHALL succeed from a checkout
that has no pre-existing `dist` directories, no `tsbuildinfo` files and no
local or remote Nx cache, with dependencies installed from the lockfile. Any
declaration artifact the command needs SHALL be produced by the command itself,
not by a manual build step a developer is expected to remember.

#### Scenario: Clean checkout passes without a manual pre-build

- **WHEN** the command is run in a freshly installed checkout containing no
  build outputs, no `tsbuildinfo` and no warm cache
- **THEN** it builds the required declaration outputs in dependency order and
  exits `0`

#### Scenario: Ordering is independent of task-graph cycles

- **WHEN** the task graph for the full-workspace typecheck command is computed
- **THEN** it contains no cycle, no task that bundles a project merely to
  typecheck it, and no two tasks that write the same output path

#### Scenario: Build and typecheck are order-independent

- **WHEN** `build` is run for a project and then its `typecheck`, and
  separately when `typecheck` is run and then its `build`
- **THEN** both orders succeed, and the second target in each order is not
  broken by the first target's outputs

### Requirement: Typechecking leaves tracked files unchanged

Running any typecheck command SHALL NOT modify, add or delete files tracked by
Git.

#### Scenario: Working tree is clean after a typecheck run

- **WHEN** the full-workspace or affected typecheck command completes, whether
  it passed or failed
- **THEN** `git status --porcelain` reports no change to tracked files

### Requirement: An observable PR check enforces typechecking

The repository SHALL own a pull-request CI job that runs the workspace
typecheck and fails the job on any TypeScript diagnostic. The job SHALL be
defined in this repository rather than delegated, SHALL run on the Node version
the repository's other PR jobs use, and SHALL NOT duplicate an existing
equivalent gate.

#### Scenario: A PR introducing a type error fails the check

- **WHEN** a pull request contains a TypeScript type error in a production or
  test source of any configured project
- **THEN** the repository-owned typecheck job reports a failed conclusion for
  that pull request

#### Scenario: The check is identifiable by name

- **WHEN** a maintainer inspects a pull request's checks
- **THEN** a check whose name identifies it as the workspace typecheck is
  listed, with its project scope, Node version and commands recorded in the
  workflow file

#### Scenario: Branch protection is recorded as external

- **WHEN** the typecheck job is added to the PR workflow
- **THEN** the change documents that marking the check *required* is a
  branch-protection setting administered outside this repository, and does not
  claim the check is required merely because the job exists

### Requirement: Existing checks are not weakened to reach a green gate

Reaching a passing typecheck SHALL NOT be achieved by disabling or narrowing
existing checks. `strict`, `noUnusedLocals`, `noUnusedParameters`,
`noImplicitOverride`, `noImplicitReturns` and `noFallthroughCasesInSwitch` SHALL
retain their current values; `skipLibCheck` SHALL NOT be changed; test files
SHALL remain included in the projects that check them; and no new blanket
`exclude` entry, `any`, double cast or error-suppression comment SHALL be added
to silence a diagnostic.

#### Scenario: Compiler strictness is unchanged

- **WHEN** the change is reviewed against the previous revision
- **THEN** no compiler option in `tsconfig.base.json` or a project tsconfig has
  been relaxed, and no `tsconfig` `exclude` list has gained an entry that
  removes previously checked source files

#### Scenario: Diagnostics are fixed, not suppressed

- **WHEN** a TypeScript diagnostic reported before the change is no longer
  reported after it
- **THEN** the cause is a type-correct change to the code or configuration, not
  an `any`, a double cast, a `@ts-ignore` or a `@ts-expect-error`

### Requirement: Privacy assertions in auth metrics tests are preserved

The auth-metrics privacy test SHALL continue to traverse every data point of
every `dial.chat.auth.*` metric and SHALL continue to assert that none of the
request, session and token identifier fixtures appears among the collected
attribute values. Fixing its type errors SHALL NOT reduce what it traverses or
what it asserts.

#### Scenario: The assertion still covers every auth metric data point

- **WHEN** the auth-metrics test suite runs after the change
- **THEN** the traversal still visits every data point of every metric whose
  descriptor name starts with `dial.chat.auth.`
- **AND** it still asserts that none of the session, user, access-token and
  refresh-token fixture values appears among those data points' attribute
  values

#### Scenario: The traversal typechecks without escape hatches

- **WHEN** `apps/chat-api`'s `typecheck` target runs
- **THEN** it reports no diagnostic for the auth-metrics test
- **AND** the test achieves this without `any`, a double cast or a compiler
  suppression comment
