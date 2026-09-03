# Packed-package consumer fixtures

Proves `@epam/ai-dial-chat-hooks`'s published `exports`/`peerDependenciesMeta`/
`sideEffects` contract from the outside: each fixture `npm install`s the
**packed tarball** — never the monorepo's `@epam/source` resolution condition,
which points straight at `src/` and bypasses the packaging boundary entirely —
into its own isolated `node_modules`, then typechecks and production-bundles a
small consumer file against it. See
`openspec/changes/modularize-chat-hooks-package-exports/design.md` D5 for the
full rationale.

## Running

The PR workflow runs the bounded smoke suite:

```sh
npm exec nx run @epam/ai-dial-chat-hooks:test-packed-smoke
```

It installs three representative consumers: `minimal`, `oauth`, and
`negative-oauth`. Together they verify the complete packed-file/export map,
minimal optional-peer isolation, the OAuth side-effect path, the complete
audited `sideEffects` manifest (including the file-manager chunk), and the
exact missing-peer diagnostic. This keeps the network-bound PR gate focused
while retaining coverage of the package contract's highest-risk behavior.

Run the complete matrix locally or from a release check with:

```sh
npm exec nx run @epam/ai-dial-chat-hooks:test-packed
```

The full target adds every published subpath and the legacy-root consumer. It
is intentionally not a required PR check; it is reserved for a future nightly
job, whose scheduling is outside the scope of the current change. Both targets
run after `build`, so `dist/` is always fresh. To debug a single run without Nx:

```sh
node libs/chat-hooks/e2e-fixtures/run.mjs
```

Use `--suite=smoke` for the same selection as PR CI, or
`--only=minimal,oauth` to debug an explicit subset. Unknown fixture names fail
instead of silently producing a partial run.

Set `KEEP_FIXTURES=1` to skip the final cleanup and inspect a fixture's
`node_modules`, `tsconfig.json`, or `dist-check/out.js` by hand — the run
prints the exact path, e.g. `<os temp dir>/ai-dial-chat-hooks-e2e-fixtures-<random>/
fixtures/<name>/`.

Fixtures are created **outside this repository checkout** (under the OS temp
directory), not in a git-ignored folder underneath it. This is load-bearing,
not incidental: Node/Rollup/tsc module resolution walks every ancestor
directory looking for a `node_modules` that has the specifier it wants, so a
fixture nested anywhere inside this checkout would silently resolve an
"uninstalled" peer from the workspace's own root `node_modules` (which really
does have every peer installed, for `apps/chat`) instead of failing the way
an external consumer's install actually would. An early version of this
harness nested fixtures under `libs/chat-hooks/e2e-fixtures/.tmp/` and the
negative fixture (task 6.5) passed without the missing peer ever being
installed, for exactly this reason.

## What each fixture proves

- **`minimal`** — installs only the `react` runtime peer (plus consumer-owned
  `@types/react` tooling) and imports `./viewport-layout` (zero documented
  feature peers). Typecheck and bundle must succeed with no optional feature
  peer present, and the bundle must contain neither side-effect marker
  (`new EventTarget()`, `LRUCache`) — proving no cross-entry leakage.
- **One fixture per published subpath** — installs that entry's complete
  documented runtime and type-only peer set (see `fixtures.mjs`) plus their
  own full transitive peer closure (see below), verifies every package imported
  by the entry's rolled-up declaration exists, then asserts the consumer
  typecheck and production bundle both succeed.
- **`legacy-root`** — installs all 16 declared optional peers and imports
  from the unchanged root entry (`.`), proving the root entry's public
  surface and peer contract are unaffected by the new subpaths.
- **`negative-oauth`** — installs every documented `./oauth` peer except
  `@epam/ai-dial-chat-shared`, then asserts the build fails and names exactly
  that missing direct peer — the OpenSpec negative scenario.
- **Packed exports check** — compares every path in the publish-transformed
  `package.json#exports` map and every emitted `dist/` file with `npm pack
--json`'s actual file list.
- **Side-effect checks** — compare the audited marker files with the
  publish-transformed `sideEffects` patterns, then rebuild `./oauth` and
  `./file-manager` from side-effect-only imports and check their emitted
  bundles for the two real module-scope effects: a literal
  `new EventTarget()` call (the singleton in `./oauth`) and the bundled
  `lru-cache` implementation (the two cache instances in `./file-manager`,
  detected via its `Symbol.toStringTag` string literal — the only part of
  its own construction that survives this workspace's identifier-renaming
  production build; see `fixtures.mjs`'s `SIDE_EFFECT_CHECKS` comment).
  Present in their owning entry's bundle, absent from `minimal`'s.

The consumer typecheck is strict and keeps `skipLibCheck: false`, so missing
type-only peers fail the same way they would for a strict consumer. Fixture-only
compatibility declarations bridge peer-owned React-18 global `JSX` types to
React 19, declare Vite-handled stylesheet modules, and map Monaco's extensionless
declaration import to its installed `.d.ts`. A second narrow bridge redirects the
currently published catalog peer's monorepo-relative `publish-panel/src/index.ts`
declaration import to the installed `@epam/ai-dial-publish-panel` package. The
harness also scans the selected `chat-hooks` rolled-up declaration and requires
every external package it imports to have an installed `package.json`.

## Why `export * from`, not `import * as mod; export default mod`

Each fixture's `entry.ts` is a one-line `export * from '@epam/ai-dial-chat-hooks/<subpath>';`
— not `import * as mod from '...'; export default mod;`, which was tried
first. A bundler treats an entry's own `export * from` names as its public
API and never tree-shakes them; a default-exported namespace _object_ has no
such protection; Rollup/Rolldown, correctly honoring this package's now-real
`sideEffects` metadata, tree-shook the entire unused namespace — imports and
all — out of the bundle. Every fixture "passed" that way, including the
negative fixture: the import requiring its missing peer was simply never
reached, so nothing ever failed to resolve.

## Why Vite, not a bare bundler CLI

The "production bundle" step uses Vite's library mode (`vite build`), the
same bundler every real consumer of this package in this workspace uses —
not a standalone Rollup/Rolldown CLI invocation. Some peers' compiled output
imports CSS at module scope (e.g. a markdown renderer's stylesheet reachable
transitively from the root entry); only Vite's built-in CSS handling, not the
bare `rolldown` binary, understands that import without extra configuration.
The harness uses Vite's `native` config loader because the generated config is
already ESM; this avoids making Vite's optional `esbuild` peer an accidental
fixture-runner dependency.

## Fixtures install the full transitive peer closure, not just chat-hooks' documented peers

A fixture declares `@epam/ai-dial-chat-hooks`'s documented direct runtime and
type-only peers for its entry (per `fixtures.mjs`) **and** whatever _those_
peers themselves require — `resolvePeerClosure` in `harness.mjs` walks each
package's own `peerDependencies` recursively via `npm view`, memoized across
the whole run. Modern npm may auto-install peers, but the explicit closure
pins a mutually compatible set instead of leaving npm to choose versions
independently, so
`@epam/ai-dial-quotations` needing `@tabler/icons-react`/`react-markdown`, or
`@epam/ai-dial-chat-shared` needing `@epam/ai-dial-ui-kit`, are exactly as
mandatory as chat-hooks' own documented peers. Omitting them from a fixture
wouldn't test "chat-hooks' peer list is sufficient" — it would just produce a
build that fails on an unrelated, undocumented specifier, which is exactly
what an earlier version of this harness did.

## Peer versions: the `development` npm dist-tag, not `latest`

Fixtures install every `@epam/ai-dial-*` peer from the `development` dist-tag
(`npm install <peer>@development`-equivalent), not `latest`/`*`. This
package family's `latest` tags are **not** kept mutually compatible with each
other across independent release cadences — e.g. the published
`@epam/ai-dial-chat-shared@1.0.6` declares a peer range on
`@epam/ai-dial-ui-kit` (`^0.14.0-dev.15`) that `ui-kit`'s own `latest`
(`0.13.0`) never satisfies. `development` is the one set that is kept
mutually compatible, confirmed by this workspace's own two peers that are
genuinely installed from the registry (not workspace-symlinked) —
`@epam/ai-dial-react-file-manager` and `@epam/ai-dial-ui-kit` — both pinned
in the root `package.json` to a `-dev.N` prerelease of that same set. `npm
install` deliberately uses npm's normal peer handling. The minimal fixture
also inspects its isolated `node_modules` and the installed manifest to prove
that no optional feature peer was auto-installed and every non-React peer is
still marked optional.
