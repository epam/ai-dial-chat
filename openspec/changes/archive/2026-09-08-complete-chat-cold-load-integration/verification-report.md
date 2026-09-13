# Chat cold-load integration verification

Final registry-release verification on 2026-09-08 with UI Kit `0.14.0-dev.36`.

## Result

The scoped optimization passes with the published UI Kit: initial
JavaScript excludes AG Grid, Monaco/UIW editors, PDF.js, KaTeX and
react-syntax-highlighter. Grid remains reachable through dynamic imports and
works after activation. No additional UI Kit implementation task was found in
these consumer scenarios.

| Initial static assets | Raw bytes |  Gzip bytes |   Gzip budget |
| --------------------- | --------: | ----------: | ------------: |
| JavaScript            | 2,145,236 |     615,272 |     1,100,000 |
| CSS                   |   218,308 |      37,530 |        60,000 |
| Total                 | 2,363,544 | **652,802** | **1,160,000** |

This is 62.1% below the original archived baseline of 1,724,639 gzip bytes and
38.7% below the pre-integration measurement of 1,065,089 bytes. It is only 687
bytes above the preceding local-artifact result (652,115 bytes). The reachable
AG Grid implementation is in `assets/ai-dial-react-file-manager.es-CEgIQTH3.js`.

Actual startup asset requests, including immediate conversation prefetches,
total **665,037 gzip JS + 38,831 gzip CSS = 703,868 bytes** at all tested widths.
These are locally calculated gzip sizes of requested files; the mock server
serves uncompressed content. They are not on-wire transfer sizes, LCP, chat-ready
latency or production RUM measurements.

## Artifact

- Root dependency: `^0.14.0-dev.36`; lockfile and installed version: `0.14.0-dev.36`.
- Source: npm registry, `@epam/ai-dial-ui-kit`; no local package substitution.
- Integrity: `sha512-y4vSDB4/qY4xHvDJsIZ+i3hkywiektRAwsUscQTIg8x7X9PZhf49aTvTLjVr1MdqXgYB7tdR3+sJ2+p2t/M00Q==`.
- The installed dependency lock records the same version and integrity as the root lockfile.
- Toolchain: Node 24.13.0, npm 11.6.2, Vite 8.0.16, Rolldown 1.0.3, React 19.2.8.
- No dependencies or manifests were changed during this final verification.

The release contains the section 9 fix from UI Kit's archived
`2026-09-08-isolate-heavy-feature-modules` change. The earlier release/lockfile
follow-up is complete; `npm ci` now resolves dev.36. Compared with the previous
verification, the user's dependency update also changed PDF-highlighter from
dev.28 to dev.29 and two nested optional WASM runtimes from 1.1.6 to 1.2.3.
The measurements above describe this current dependency set, not an isolated
UI Kit size comparison. Vite, Rolldown and React versions remain unchanged.

## UI Kit section 9 regression

A separate Vite 8.0.16 consumer eagerly retains root `Button` and all three root
editor loaders, alongside a lazy `/grid` feature. It verifies that each loader
is identical to its `/editors` export. Initial JS is 284,511 raw / 91,763 gzip
bytes, with no Grid or editor engine in the initial graph or startup requests.

In Chromium, clicking the Grid action renders `Smoke row`; invoking both the
current and legacy root Markdown loaders renders editors that accept text.
There are no page errors. The JSON loader's identity and initial isolation are
covered here; its Monaco editing behavior was not separately browser-tested
in this release check.

The timeout reported by the UI Kit owner was previously reproduced and diagnosed: the
local chat test expected `/Good .*Smoke/`, but the afternoon greeting is
`Afternoon, Smoke`. Runtime errors were empty. Waiting for the name-bearing
greeting independently of the time of day fixed the temporary test; application
code did not need a workaround.

## Verification

- Production Nx build and all 55 prerequisite tasks passed, including chat and
  affected-library typechecks and shared subpath declarations/styles.
- A second ordinary Nx app build, without any diagnostic plugin or report flag,
  passed. Its HTML and every emitted asset are byte-identical to the measured
  build (SHA-256 comparison); `dist/bundle-graph.json` is absent.
- Chromium smoke passed at 1440x1000, 390x844 and 360x800: startup network
  isolation, file-manager row, catalog list row, and actual prompt Markdown
  editing in one session. APIs are mocked and routes are activated in the
  client; these checks cover module execution, not backend integration or a
  comprehensive responsive/accessibility audit.
- Nine focused test files passed: 263 tests covering conversation publication,
  prompt/skill editor pages, catalog ListView and editor/scheduled-task libraries.
- Lint passed for all eight affected projects, with existing warnings only.
- Five temporary graph-checker regression cases passed: transitive eager leaks,
  dynamic boundaries, backtick imports, orphan chunks and development React.
- Documentation validation passed for 41 Markdown files. Changed delivery files
  are formatted and `git diff --check` passes.

`npm run verify:full` was repeated against dev.36 and failed at global
typecheck in two unchanged projects: `mcp-app-sandbox` (`src/main.ts:28`, an
optional port passed to `listen`) and `@epam/chat-api` (existing source and
declaration/test errors). These are the same blockers recorded in the preceding
integration run; no backend or generated-client files were changed. The full
gate therefore did not advance to lint/tests. Focused lint/tests above were run
separately with the current registry artifact. The earlier complete unit-test run
passed all 29 test projects; it is historical evidence, not a full-suite rerun
against this newer artifact.

The final typecheck log is
`tmp/agent-logs/2026-09-08T13-36-55-702Z-typecheck-full.log`.

## Delivered scope and cleanup

Retained production changes are public `/grid` and `/editors` imports and their
matching test mocks; UI Kit subpath externalization and compatible peers;
optional shared `/file-manager` exports/aliases; audited side-effect metadata;
lazy conversation publishing with a translated loading state; removal of
obsolete manual chunk grouping; and matching documentation.

Removed from the delivery: the local-package installer, bundle graph plugin,
graph checker and its fixture tests, mock browser server/tests, added npm/Nx
commands, diagnostic cache inputs and tsconfig entries. Also removed a redundant
shared-root barrel rewrite and unrelated npm peer-classification changes. The
old UI Kit instruction prompt was moved to ignored `tmp/` because its work is
complete. No application or repository task depends on these temporary files.

Pre-existing changes to `.claude/settings.json`,
`.claude/skills/lean-verification/SKILL.md` and `.mcp.json` were preserved; they
are outside the optimization delivery and should be reviewed separately.

The scoped five-axis review found no blocking optimization defect. Public
exports remain compatible, library changes add no host integration knowledge,
and no debug statements, private UI Kit aliases or local-package paths remain
in the production diff. The repository-wide typecheck failures above still
prevent claiming an entirely green merge gate.

## Local evidence

Investigation tools, backups, logs and screenshots are ignored under
`tmp/cold-load/release36/`. Key files are `graph.json`, `root-graph.json`,
`browser.log`, `root-browser.log`, `build.log`, `production-build.log`,
`production-proof.log`, `tests.log` and `lint.log`. These local artifacts are
not required by the production build and are not part of the deliverable.

Rechecking another unpublished artifact requires building and packing UI Kit,
temporarily replacing only its installed directory, and repeating an uncached
production build plus static-graph and browser checks. Set
`NODE_ENV=production` explicitly; a local package can retain version `0.0.0`
while its contents change. The temporary Vite wrapper only collects module
metadata and does not alter production chunk settings.
