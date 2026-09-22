# reusable-workflows-consumer-fixture

A single script (`scripts/run.mjs`) that proves `@epam/ai-dial-skills`'s and
`@epam/ai-dial-prompts`'s published package boundaries actually hold, per
`openspec/changes/extract-reusable-chat-workflows/design.md`'s Decision 5.

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
   Nothing is skipped with `--legacy-peer-deps`.
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
- The bundle's main chunk contains no `ag-grid-community` — the string
  literal AG Grid's own compiled source carries verbatim, so it survives
  minification. `usePromptSelectorOverlay` renders `PromptParametersPopup`
  (which reaches `@epam/ai-dial-catalog`'s AG-Grid-backed `ListView`) behind a
  `React.lazy()`/`Suspense` boundary; a regression that inlines it back into
  `usePromptSelectorOverlay`'s eager import graph would put AG Grid in every
  consumer's initial chunk even when the parameters popup never opens.
- At least one _other_ emitted chunk **does** contain `ag-grid-community` —
  proving the split actually happened, rather than the marker being absent
  for an unrelated reason (e.g. the entry never reaching
  `usePromptSelectorOverlay` at all).

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
