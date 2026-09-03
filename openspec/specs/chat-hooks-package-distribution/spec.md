# chat-hooks-package-distribution Specification

## Purpose

`@epam/ai-dial-chat-hooks` (`libs/chat-hooks`) publishes its hooks as a dependency-isolated,
multi-entry-point package rather than a single rolled-up root module. Each feature area
(viewport layout, scroll anchoring, conversation, conversation transfer, conversation sources,
file manager, catalog, skills state, skill editor, OAuth, scheduled tasks, sharing, and
attachments/utils) is published as its own ESM subpath entry point with its own declaration
file, so a consumer that only needs one feature's hooks installs and bundles only that
feature's dependencies instead of the package's full peer set. The root (`.`) entry remains
available and backward compatible for consumers who have not migrated to subpath imports.
`react` is the package's only non-optional peer dependency; every `@epam/ai-dial-*` peer and
the type-only `@epam/pdf-highlighter-kit` peer are optional and scoped to the entry points that
actually need them. Implementation-only dependencies are delivered consistently — either
externalized as a declared peer or bundled into the entry that uses them, never both — and tree
shaking, `sideEffects` metadata, and the packed npm artifact are verified so the published
package behaves exactly as its manifest claims.

## Requirements

### Requirement: Dependency-isolated public entry points
`@epam/ai-dial-chat-hooks` SHALL publish, in addition to its root (`.`) entry, a fixed set of
ESM subpath entry points — `./viewport-layout`, `./scroll-anchoring`, `./conversation`,
`./conversation-transfer`, `./conversation-sources`, `./file-manager`, `./catalog`,
`./skills-state`, `./skill-editor`, `./oauth`, `./scheduled-tasks`, `./sharing`, and
`./attachments`, `./utils` — each resolvable as both a runtime ESM module and a TypeScript
declaration file. Each subpath's module graph SHALL reference only the runtime and type-only
dependencies documented for it in `README.md`'s entry-point-to-dependency matrix, plus shared
dependency-light internal modules; it SHALL NOT import, at runtime or as a type dependency,
any `@epam/ai-dial-*` package or third-party package outside that documented set.

#### Scenario: A subpath resolves to both a module and a declaration
- **WHEN** a consumer's bundler resolves `@epam/ai-dial-chat-hooks/viewport-layout` and a
  consumer's `tsc` type-checks the same import
- **THEN** both resolutions succeed against files that exist in the published package, with
  the declaration file describing the same exported names the runtime module provides

#### Scenario: A minimal hook import does not resolve unrelated feature packages
- **WHEN** a consumer's production bundler processes an entry file that imports only from
  `@epam/ai-dial-chat-hooks/viewport-layout`
- **THEN** the bundler's module graph contains no reference to
  `@epam/ai-dial-react-file-manager`, `@epam/ai-dial-attachment-canvas`,
  `@epam/ai-dial-catalog`, `@epam/ai-dial-scheduled-tasks`, `@epam/ai-dial-skill-editor`,
  `@epam/ai-dial-source-panel`, or any other feature-only package

#### Scenario: A feature entry references only its documented dependencies
- **WHEN** the module graph reachable from `@epam/ai-dial-chat-hooks/file-manager` is
  inspected
- **THEN** it references exactly the runtime/type-only peers `README.md` documents for
  `./file-manager` and no peer documented only for a different entry

### Requirement: Backward-compatible root entry
`@epam/ai-dial-chat-hooks`'s root (`.`) entry SHALL not remove or change the signature or runtime
behavior of any existing export, and SHALL continue to support the package's full documented
peer set. Adding a subpath entry SHALL NOT require any existing consumer of the root entry to
change an import. The newly declared type-only `@epam/pdf-highlighter-kit` peer records a module
specifier already exposed by the rolled-up root and `./file-manager` declarations.

#### Scenario: Existing root imports keep working
- **WHEN** a consumer with the full documented peer set installed imports any name from
  `@epam/ai-dial-chat-hooks`'s root entry, exactly as before this change
- **THEN** the import typechecks, bundles, and behaves identically to before this change

#### Scenario: Migrating one import to a subpath changes nothing but the import path
- **WHEN** a call site's import of `useViewportWidth` moves from
  `@epam/ai-dial-chat-hooks` to `@epam/ai-dial-chat-hooks/viewport-layout`
- **THEN** the hook's signature, return shape, and runtime behavior are identical; only the
  module specifier differs

### Requirement: Optional feature peers
`@epam/ai-dial-chat-hooks`'s `package.json` SHALL declare `react` as its only non-optional
`peerDependency`. Every other declared peer (every `@epam/ai-dial-*` package and the type-only
`@epam/pdf-highlighter-kit` peer exposed by `./file-manager` declarations) SHALL be declared in
`peerDependenciesMeta` with `optional: true`. `fflate` SHALL NOT appear in
`peerDependencies` at all.

#### Scenario: Installing for the minimal entry does not require unrelated peers
- **WHEN** a consumer runs `npm install @epam/ai-dial-chat-hooks react` and imports only
  `@epam/ai-dial-chat-hooks/viewport-layout`
- **THEN** the install succeeds with no unmet-peer warning for any `@epam/ai-dial-*` package

#### Scenario: Installing exactly a feature entry's documented peers succeeds cleanly
- **WHEN** a consumer installs `react` plus every peer `README.md` documents for
  `./skill-editor` and imports only from that subpath
- **THEN** the install produces no peer warning and the subsequent build resolves every
  import used by that subpath

#### Scenario: Omitting a genuinely required peer fails clearly, scoped to that peer
- **WHEN** a consumer imports `@epam/ai-dial-chat-hooks/oauth` without installing
  `@epam/ai-dial-chat-shared`
- **THEN** the consumer's build fails with an error naming `@epam/ai-dial-chat-shared`
  specifically, and does not report any of the other, unrelated `@epam/ai-dial-*` peers as
  missing

### Requirement: Consistent implementation dependency delivery
Every implementation-only dependency SHALL have exactly one delivery model: it is either (a)
externalized in the build and declared as a `peerDependency` (optionally, per the previous
Requirement) because the consumer's own module graph is expected to already carry it, or (b)
bundled into the entry point(s) that use it and absent from `dependencies`,
`peerDependencies`, and `peerDependenciesMeta` entirely. No dependency SHALL be both bundled
into an entry's output and separately declared in a runtime dependency field.

#### Scenario: A bundled dependency is not separately installable as a duplicate
- **WHEN** `libs/chat-hooks/package.json` (as published) is inspected for `dompurify`,
  `lru-cache`, `mime-types`, and `yaml`
- **THEN** none of the four appear in `dependencies`, `peerDependencies`, or
  `peerDependenciesMeta`, and each is present, compiled in, inside the entry output(s) that
  import it

#### Scenario: A consumer that does not use zip-backed features never needs `fflate`
- **WHEN** a consumer installs `@epam/ai-dial-chat-hooks` and imports only entries other than
  `./conversation-transfer` and `./skill-editor`
- **THEN** `npm install` never asks for `fflate`, and the consumer's build never references
  it, because no entry it imports bundles or externalizes it

### Requirement: Verified tree shaking and accurate side-effect metadata
A production bundle built from a single dependency-light entry point SHALL contain no code or
external `import` belonging exclusively to a dependency-heavy entry point.
`@epam/ai-dial-chat-hooks`'s `package.json#sideEffects` SHALL cover exactly the public entry
facades and emitted shared chunks that retain observable module-scope state, and no others;
any future module-scope effect added to an entry SHALL be reflected in that list in the same change that introduces
it, and SHALL be covered by a consumer test that would fail if the effect were dropped by an
overly aggressive `sideEffects: false` elsewhere in the manifest.

#### Scenario: A minimal-entry production bundle excludes heavy-entry code
- **WHEN** a consumer's bundler tree-shakes a production build that imports only
  `@epam/ai-dial-chat-hooks/viewport-layout`
- **THEN** the emitted bundle contains no code from `files/`, `catalog/`, `skill/`, `oauth/`,
  or any other entry-exclusive domain, and no external import exclusive to those entries

#### Scenario: The declared side-effect list matches the audited set
- **WHEN** `package.json#sideEffects` is compared against the module-scope side-effect audit
  in the library's design record
- **THEN** it lists the stable `./oauth`, `./file-manager`, and root facades plus the hashed
  chunks containing the `EventTarget` singleton and the two `LRUCache` instances — and no
  unrelated compiled output

#### Scenario: A side-effectful symbol is not eliminated by a consumer's bundler
- **WHEN** a consumer's production bundler processes an entry file importing
  `@epam/ai-dial-chat-hooks/oauth`
- **THEN** the emitted bundle retains the module-scope `EventTarget` construction, proving the
  bundler did not treat the file as side-effect-free

### Requirement: Packed-package verification
Every target named in `package.json#exports` SHALL resolve to a file that actually exists in
the packed (`npm pack`-produced) artifact. A minimal consumer fixture, one consumer fixture
per published subpath, a legacy-root consumer fixture, and a negative-case fixture
demonstrating a build failure for a genuinely missing required peer SHALL each install the
packed artifact — not the workspace's `@epam/source` resolution condition — and SHALL pass
TypeScript compilation and production bundling using only their documented dependency sets.
These fixtures SHALL assert against the installed `node_modules` dependency tree and the
emitted bundle's contents, not merely against `libs/chat-hooks`'s own build succeeding.
Every workspace peer in a fixture's transitive peer closure SHALL be packed from the current
checkout with the same synthetic version as chat-hooks. Every external peer SHALL be requested
at the exact version recorded in the root `package-lock.json`. Mutable registry selectors such
as `development`, `latest`, and open ranges SHALL NOT select the fixture dependency set.

PR CI SHALL run a bounded packed-package smoke suite containing the `minimal`, `oauth`, and
negative OAuth fixtures. The smoke run SHALL still perform the package-wide
packed-file/export-target check, the complete audited `sideEffects` manifest check (including
the file-manager marker-bearing chunk), and the OAuth side-effect-only consumer bundle check.
The complete per-subpath and legacy-root matrix SHALL remain runnable through a separate Nx
target for local, release, and future nightly execution; configuring a scheduled nightly
workflow is outside this change.

#### Scenario: Every exports target exists in the packed artifact
- **WHEN** `libs/chat-hooks`'s built `dist/` is packed with `npm pack` and the resulting
  tarball's file list is compared against every path named in `package.json#exports`
- **THEN** every named path (`import`, `types`, and `default` conditions, for every subpath)
  is present in the tarball, and every file emitted to `dist/` is included in the packed file
  list

#### Scenario: Each fixture builds and typechecks against an installed, packed artifact
- **WHEN** the minimal, per-subpath, and legacy-root fixtures each `npm install` the
  packed tarball plus their own documented peer set into an isolated `node_modules`
- **THEN** every external package imported by that entry's rolled-up declaration resolves,
  and the fixture's TypeScript compilation and production bundle both succeed

#### Scenario: Fixture versions follow the checkout and lockfile automatically
- **WHEN** a workspace library changes without a release, or an external dependency's locked
  version changes in the root `package-lock.json`
- **THEN** the next packed-fixture run uses the newly packed workspace artifact or exact new
  locked version without a manual fixture-version update

#### Scenario: The negative fixture fails for the right reason
- **WHEN** the negative-case fixture installs the packed tarball without one genuinely
  required peer for the entry it imports
- **THEN** its build fails, and the failure message names the missing peer

#### Scenario: Pull requests run the bounded packed-package smoke suite
- **WHEN** the repository's pull-request workflow validates `@epam/ai-dial-chat-hooks`
- **THEN** it runs the `minimal`, `oauth`, and negative OAuth fixtures, along with the
  package-wide packed export/file, complete audited side-effect manifest, and OAuth
  side-effect-only bundle checks

#### Scenario: The complete matrix remains available without blocking pull requests
- **WHEN** a maintainer invokes the full packed-package Nx target
- **THEN** every published subpath, the legacy root, and the negative fixture are exercised
- **AND** the pull-request workflow does not require that install-heavy full target while
  nightly scheduling remains unconfigured

### Requirement: Library isolation is preserved in every new entry point
Every new entry-point barrel file SHALL NOT import from `apps/*`, an application context,
routing, i18n, a configured `server-api` client instance, auth/session/config modules,
storage, analytics, or any UI-kit component-rendering module. Any hook reachable from a new
entry point that communicates with DIAL Core or invokes host behavior SHALL continue to
accept an already-configured client instance, a narrow structural interface, a callback, or a
resolved value as a parameter — never construct or resolve one itself.

#### Scenario: A new entry-point barrel imports only from within the library or its peers
- **WHEN** `libs/chat-hooks/src/entry-points/*.ts` is linted with
  `@nx/enforce-module-boundaries`
- **THEN** no violation is reported for importing an app, a configured client instance, or any
  host-owned module

#### Scenario: A DIAL-Core-facing hook in a new entry still receives its client as a parameter
- **WHEN** a hook exported from `./sharing`, `./file-manager`, `./catalog`, or any other new
  entry that calls a generated DIAL Core operation is inspected
- **THEN** the operation function itself is a parameter the hook receives, not a client the
  hook constructs, configures, or imports a singleton instance of
