# reusable-workflows-consumer-fixture

A single script (`scripts/run.mjs`) that proves `@epam/ai-dial-skills`'s and
`@epam/ai-dial-prompts`'s published package boundaries actually hold, per
[`extract-reusable-chat-workflows` design](../../openspec/changes/archive/2026-09-21-extract-reusable-chat-workflows/design.md)'s
Decision 5. The client application adoption map built on it is
[`docs/reusable-chat-workflows.md`](../../docs/reusable-chat-workflows.md).

## Reusable controller coverage

The fixture also packs `chat-hooks` and `attachment-canvas`, explicitly
re-exporting all new controller functions and reachable option/result types
from their documented subpaths and package root, plus `useLatestCanvasRequest`. The existing
real typecheck, production bundle, stylesheet and lazy engine checks remain.
`REUSABLE_CONTROLLER_EXPORTS` in `libs/chat-hooks/e2e-fixtures/fixtures.mjs`
is shared with the per-entry fixture runner. This proves artifact readiness
only when installation and all checks pass; it never proves client adoption.

## Why this exists

Every in-repo consumer of `@epam/ai-dial-skills`/`@epam/ai-dial-prompts`
(`apps/chat`, each lib's own Vitest suite) resolves the bare specifier
straight to `libs/skills/src/index.ts` / `libs/prompts/src/index.ts` through a
`resolve.alias` — never through either package's own `exports` map. This
fixture is the one place in the workspace that installs both packages the way
a real downstream consumer would and then typechecks and builds against them.

## What this does and does not prove

This fixture proves **package consumption**: that both packages' publish-ready
`exports` map, their full dependency **and peer** closure, each package's
`./styles.css`, and `usePromptSelectorOverlay`'s lazy-loading boundary around
`PromptParametersPopup` all resolve and build correctly for a consumer
installing the packed tarballs with an **explicit, fully resolved dependency
tree** — not one that happens to work only because the workspace root already
has every peer installed for `apps/chat`.

It does **not** prove **workflow behavior**. The packed artifacts are
typechecked and bundled; nothing here is executed by a test runner, and this
fixture installs no Vitest/jsdom/Testing Library. Successful/rejected skill
import, constrained file selection, and parameterized prompt insertion are
proven by each workflow's own library test suite instead:

- `libs/chat-hooks/src/skill/useSkillArchiveImport/tests`
- `libs/chat-hooks/src/files/useFileAttachmentPicker/tests`
- `libs/prompts/src/hooks/usePromptSelectorOverlay/tests`

`chat-hooks`' two new exports (`useSkillArchiveImport`, `useFileAttachmentPicker`)
need no fixture of their own here: they are reachable through the existing
`chat-hooks/skill-editor` and `chat-hooks/file-manager` entries, already
covered by `libs/chat-hooks/e2e-fixtures`' `skill-editor` and `file-manager`
subpath fixtures.

## Isolation: an explicit dependency tree, not ancestor resolution

`scripts/run.mjs` reuses `libs/chat-hooks/e2e-fixtures/harness.mjs` rather than
reimplementing it — that module already solves this exact problem for
`@epam/ai-dial-chat-hooks`'s own packed-consumer suite:

1. The fixture is materialized under the OS temp directory
   (`createTmpRoot`/`createFixtureDir`), **outside this repository checkout**.
   Node/tsc/Rollup module resolution walks every ancestor directory looking
   for a `node_modules` that satisfies a bare specifier, so a fixture nested
   anywhere inside this checkout — even a git-ignored folder — would silently
   resolve an "uninstalled" peer from the workspace root's own `node_modules`
   instead of failing the way an external consumer's install actually would.
2. `createFixtureDependencyResolver` computes the **full** dependency and peer
   closure starting from `@epam/ai-dial-skills` and `@epam/ai-dial-prompts`
   themselves: every workspace-sibling package either depends on
   (`@epam/ai-dial-catalog`, `@epam/ai-dial-publish-panel`,
   `@epam/ai-dial-conversation-input`, `@epam/ai-dial-attachment-input`) is
   packed from this checkout's `dist/` output through the same
   `tools/publish-lib.mjs` transform a real `npm publish` uses; every
   _required_ peer — `react`, `@epam/ai-dial-chat-shared`,
   `@epam/ai-dial-ui-kit`, and, transitively, `@epam/ai-dial-chat-shared`'s own
   required peers `@epam/ai-dial-react-file-manager`/`ag-grid-community` — is
   either packed (if it's a workspace lib) or pinned to the exact version this
   workspace's own `package-lock.json` resolves it to (if it's external).
   Nothing is skipped with `--legacy-peer-deps`. Packing uses private temporary
   copies of `dist/`; shared build manifests stay untouched even when other
   consumer fixtures run concurrently with a different synthetic version.
3. One `npm install` (`npmInstallFixture`) installs that fully declared
   dependency set with npm's normal peer-dependency resolution.
4. `typecheckFixture` runs a real `tsc --noEmit` against an `entry.ts` that
   re-exports both packages' full public surface (`export * from`, so every
   reachable declaration is actually resolved, not merely imported and
   ignored).
5. `bundleFixture` builds that same entry with Vite library mode — the same
   bundler every real consumer in this workspace uses.

The one exception to "everything is installed, nothing is bridged":
`typecheckFixture` still carries `libs/chat-hooks/e2e-fixtures/harness.mjs`'s
pre-existing `@epam/ai-dial-catalog` declaration-import bridge
(`writeCatalogPeerCompatibility`) and its Monaco/React-JSX type-only
compatibility shims. Those bridge declaration-only defects that already exist
in `@epam/ai-dial-catalog`'s and `@epam/ai-dial-ui-kit`'s currently-installed
versions (not something this fixture or `@epam/ai-dial-skills`/
`@epam/ai-dial-prompts` introduced) and affect `tsc`'s type resolution only —
never a runtime dependency this fixture fails to install. The equivalent
defect this workspace's own `@epam/ai-dial-chat-shared` dependency used to have
in `@epam/ai-dial-skills`'/`@epam/ai-dial-prompts`' own emitted declarations
was a real bug in those two packages' `vite.config.mts` (a `resolve.alias`
scoped too broadly, corrupting `vite-plugin-dts`'s declaration output) and is
fixed at the source — this fixture needs no compensating bridge for it.

## What it checks

Beyond typecheck/bundle success, `scripts/run.mjs` asserts:

- The bundle's stylesheet(s) contain each package's required CSS custom
  property (`--fs-header-text` for `@epam/ai-dial-skills`,
  `--fp-header-text` for `@epam/ai-dial-prompts`), proving each package's
  `./styles.css` actually reached the build rather than resolving to an empty
  or wrong file.
- No eagerly loaded chunk — the main chunk plus every chunk it reaches
  through static imports, including shared chunks such as the one carrying
  `@epam/ai-dial-catalog` — contains `ag-grid-community`. A regression that
  pulls a grid-backed component (e.g. `@epam/ai-dial-catalog`'s `ListView`)
  into the eager import graph would put AG Grid in every consumer's initial
  load.
- The main chunk reaches a chunk exporting `PromptParametersPopup` only
  through a dynamic `import()`, and that chunk is outside the static-import
  closure — proving `LazyPromptParametersPopup`'s `React.lazy()`/`Suspense`
  split actually survives into a consumer's build. The check does not
  require AG Grid in the lazy chunk: the popup uses only `AppIdentity`,
  `ContentTab` and `DeploymentSize` from `@epam/ai-dial-catalog`, so a
  bundler that tree-shakes the unused `ListView` correctly emits no AG Grid
  at all.

## Running it

```bash
npm exec nx run reusable-workflows-consumer-fixture:verify
```

This builds `@epam/ai-dial-skills`, `@epam/ai-dial-prompts`, and
`chat-api-client` first (via Nx's project-to-project `dependsOn`). The fixture
packs the generated API client as part of the dependency and peer closure,
so its build is explicitly required even when no source import pulls it into
the other packages' build graph. This also works on a clean CI checkout
without an existing `libs/chat-api-client/dist`.

The root test command runs the same verification as part of the normal CI
test stage:

```bash
npm test
```

Set `KEEP_FIXTURES=1` when running `node scripts/run.mjs` directly to skip the
final cleanup and inspect the isolated fixture's `node_modules`/typecheck/
bundle output by hand.

## Remaining reuse contracts

The fixture additionally packs quotations and chat-shared roots, imports the external-services
subpath, executes public contract smoke tests and two-instance JSON/incremental title tests
against installed artifacts. Vitest, jsdom and Testing Library are fixture-only dependencies
pinned from the workspace lockfile. No source aliases or package overrides are used in the
isolated install. Publication and downstream application verification are not performed.
