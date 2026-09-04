## Why

`@epam/ai-dial-chat-hooks` publishes one root entry (`.`) built from a single `src/index.ts`
barrel that re-exports all ~20 domain folders. A consumer who needs only `useViewportWidth`
(zero external dependencies) must still declare all 17 `peerDependencies` the monolith
requires — `@epam/ai-dial-react-file-manager`, `@epam/ai-dial-catalog`,
`@epam/ai-dial-skill-editor`, `fflate`, and thirteen more — because npm resolves a package's
declared dependencies before any bundler tree-shakes the code that would have used them.
The compiled artifact (`libs/chat-hooks/dist/index.js`, 560,642 bytes / 19,038 lines)
confirms this: its top-level imports name 14 external packages regardless of which hook a
consumer actually calls.

The delivery model for implementation-only dependencies is also inconsistent today:
`dompurify`, `lru-cache`, `mime-types`, and `yaml` are bundled into `dist/index.js` (not
externalized in `vite.config.mts`'s `rollupOptions.external`) **and** declared in
`dependencies`, so a consumer receives the code twice — once inlined, once installed.
`fflate` is the opposite problem: it is a pure implementation detail of two narrow features
(`conversation/conversation-transfer/zip-export.ts` and `skill/skill.ts`, both using it only
for zip codec calls) but is externalized and forced on every consumer as a mandatory peer.
`libs/chat-hooks/README.md`'s peer-dependency table has drifted from `package.json`: it is
missing six real peers (`@epam/ai-dial-catalog`, `@epam/ai-dial-chat-overlay`,
`@epam/ai-dial-deployment-creation-form`, `@epam/ai-dial-publish-panel`,
`@epam/ai-dial-scheduled-tasks`, `@epam/ai-dial-skill-editor`) and documents one peer,
`ag-grid-community`, that appears nowhere in `package.json` and is imported by zero source
files.

One existing live spec already asserts the outcome this change delivers and is currently
false against the code: `chat-hooks-scroll-anchoring`'s "Library isolation" requirement
states that "The `libs/chat-hooks` package SHALL declare `react` as its only runtime
`peerDependency`" — true of `useConversationScroll`'s own implementation, false of the
17-peer `package.json` it ships inside today.

## What Changes

- Add explicit ESM subpath entry points, each with its own build output and rolled-up
  `.d.ts`, grouping domains by their actual dependency footprint per the investigation in
  `design.md`: a dependency-light `./viewport-layout` and `./scroll-anchoring` (React only),
  and dependency-scoped `./conversation`, `./conversation-transfer`,
  `./conversation-sources`, `./file-manager`, `./catalog`, `./skills-state`,
  `./skill-editor`, `./oauth`, `./scheduled-tasks`, `./sharing`, `./attachments`, and
  `./utils`.
- `tools/publish-lib.mjs`'s `rewriteExportsObj` already rewrites nested/conditional
  `exports` maps recursively — verified against the current script, no change needed there.
  It does **not** currently rewrite a `sideEffects` array through the same `./dist/` prefix
  stripping that `main`/`module`/`types`/`exports` get; this change extends it to do so.
- Preserve `@epam/ai-dial-chat-hooks`'s root (`.`) entry behavior and existing exports, and
  restore the documented backward-compatible `useGridEditingScroll` re-export from
  `@epam/ai-dial-chat-shared`. No consumer migration is required by this change; `apps/chat`
  moves a representative sample of imports to subpaths to exercise the new contract. The
  optional `@epam/pdf-highlighter-kit` declaration records a type specifier already present in
  the rolled-up public declarations.
  **BREAKING** at the granular peer level only: every `@epam/ai-dial-*` peer moves from a
  mandatory `peerDependency` to an optional one via `peerDependenciesMeta`; `fflate` is removed
  as a peer and bundled, while the existing public declaration reference to
  `@epam/pdf-highlighter-kit` is recorded as an optional type peer (`react` remains the only
  mandatory peer). A consumer that already installs the full
  peer set observes no change; a consumer relying on `npm install` to force-install every
  peer for a package it only partially uses will no longer get that side effect.
- Give every implementation-only dependency exactly one delivery model: `dompurify` (used
  by `./conversation`), `lru-cache` and `mime-types` (used by `./file-manager`), and `yaml`
  (used by `./skill-editor`) are bundled into their owning entry's output and removed from
  `dependencies` — not both. `fflate` (used by `./conversation-transfer` and
  `./skill-editor`) is bundled into both owning entries and removed from `peerDependencies`
  entirely — it is never a package-wide mandatory peer again.
- `ag-grid-community` is removed from `vite.config.mts`'s external list and from the README's
  peer table — it has no import site and no `package.json` peer entry; the README's
  documented peer set is corrected to match `package.json` exactly (plus the new, accurate,
  per-entry peer table).
- Add an accurate `sideEffects` array (not `sideEffects: false`) covering the two
  side-effectful entry facades, the legacy root, and the content-hashed shared chunks where
  the multi-entry build emits the module-scope `EventTarget` and `LRUCache` instances. Every
  unrelated compiled output is declared side-effect-free.
- Add packed-package consumer fixtures (minimal, one per dependency-heavy entry, legacy
  root, and a negative case for a missing required peer) that install the packed tarball —
  never the monorepo's `@epam/source` condition — and assert against the installed
  dependency tree and the emitted production bundle. PR CI runs a bounded smoke selection
  (`minimal`, `oauth`, and the negative OAuth case) that still checks the complete packed
  export/file manifest, the complete audited `sideEffects` manifest, and one representative
  side-effectful consumer. The full
  per-subpath plus legacy-root matrix remains available as a separate Nx target for future
  nightly or release wiring; adding that schedule is outside this change.

## Capabilities

### New Capabilities

- `chat-hooks-package-distribution`: the modular npm packaging contract for
  `@epam/ai-dial-chat-hooks` — dependency-isolated ESM subpath entry points with matching
  type declarations, a backward-compatible root umbrella, optional feature peers via
  `peerDependenciesMeta`, one delivery model per implementation-only dependency, accurate
  `sideEffects` metadata, and packed-artifact consumer verification.

### Modified Capabilities

- `chat-hooks-scroll-anchoring`: the "Library isolation" requirement's claim that "the
  `libs/chat-hooks` package SHALL declare `react` as its only runtime `peerDependency`" is
  corrected to describe the `./scroll-anchoring` entry point specifically (the only place
  that claim is actually true), rather than the package as a whole — which by design now
  needs many peers to serve its other entries.

## Impact

- **Affected code**: `libs/chat-hooks/package.json`, `libs/chat-hooks/vite.config.mts`,
  `libs/chat-hooks/tsconfig.lib.json`, new barrel files under
  `libs/chat-hooks/src/entry-points/`, `libs/chat-hooks/README.md`, `tools/publish-lib.mjs`
  (`sideEffects` rewriting), new packed-package fixture tests.
- **Affected apps**: `apps/chat` (126 files currently import `@epam/ai-dial-chat-hooks`); a
  representative subset is repointed to the new subpaths to exercise them, the rest are
  unaffected and keep importing the root entry.
- **Dependencies**: no new third-party implementation code is introduced.
  `@epam/pdf-highlighter-kit`, already exposed by the rolled-up declarations, is newly declared
  as an optional type peer. `fflate` moves from mandatory peer to bundled-only;
  `dompurify`/`lru-cache`/`mime-types`/`yaml` move
  from dependency-and-bundled (double delivery) to bundled-only; `ag-grid-community` is
  removed from build config and docs entirely (dead reference).
- **Breaking for external consumers**: only in the sense described above (peers become
  optional, not removed) — no export is removed, renamed, or behaviorally changed.
- **Rollback**: revert to the single-entry `vite.config.mts`, the single-entry
  `package.json#exports`, and the prior `dependencies`/`peerDependencies` manifest. The root
  entry never changes shape, so rollback does not require reverting any consumer source
  migration.
