## Context

### Measurement conditions

All findings below were reproduced on revision `13f09a8f8` (branch
`docs/update_obs_docs`, one commit ahead of the audited `3d3e8c202`), macOS
(Darwin 25.6.0), **Node v20.19.5, npm 11.16.0**. The 2026-09-21 audit used Node
24.14.0; PR CI passes `node-version: 24`. The local/CI Node difference did not
change any result reported here, but no claim in this document is a claim about
an actual GitHub check run — everything marked "measured" is local evidence.

### Target inventory

`nx show projects --with-target=typecheck` reports **32 projects** (33 projects
exist in total). `nx run-many -t typecheck --all` schedules 32 tasks plus 1
dependency task. Two fail today:

| Project | Diagnostics |
| --- | --- |
| `@epam/chat-api` | `TS2322` at `apps/chat-api/src/auth/tests/auth-metrics.spec.ts:697:28`, `TS18046` at `:698:41` |
| `chat-overlay-sandbox` | 7 × `TS6305` |

The other 30 report no diagnostics. That is *not* evidence of correctness — see
"The cache is unsound" below.

### Two kinds of typecheck target

The targets are inferred by two different Nx plugins, and the difference is the
whole problem:

| | Projects | `inputs` | `outputs` |
| --- | --- | --- | --- |
| `@nx/js/typescript` | 3 — `@epam/chat-api`, `chat-api-client`, `mcp-app-sandbox` | explicit, **includes `src/**/*.spec.ts`**, tsconfigs, `dependentTasksOutputFiles` | explicit — `dist/**/*.d.ts`, `out-tsc/vitest/**`, tsbuildinfo |
| `@nx/vite` | **29** — everything else | `["production", "^production", {externalDependencies:["typescript"]}]` | **none** |

The `production` named input in `nx.json` explicitly *excludes* spec files.
Every one of the 29 Vite-derived targets runs `tsc --build --emitDeclarationOnly`
against a `tsconfig.json` that references both `tsconfig.app.json`/
`tsconfig.lib.json` **and** `tsconfig.spec.json` — so it *does* compile the test
sources, but their content is not a cache input.

### The cache is unsound (measured)

Injecting `const __probe: number = "nope";` and running the project's typecheck
target with caching enabled:

| Project | File broken | Exit | Cache hit |
| --- | --- | --- | --- |
| `chat-overlay-sandbox` (Vite) | production source | **1** | no |
| `chat-overlay-sandbox` (Vite) | **test source** | **0** | **yes** |
| `@epam/chat-api` (`@nx/js`) | test source | **1** | no |

A type error in a test file of any of the 29 Vite-derived projects passes as a
cache hit. The working tree was restored and verified clean after each probe.

Because no `outputs` are declared, Nx also cannot restore what the target
produced. With `apps/chat-overlay-sandbox/dist` deleted entirely, the target
still reports `existing outputs match the cache, left as is` and succeeds —
leaving the declarations a dependent project references absent from disk.

### Root cause of the 7 × `TS6305`

`apps/chat-overlay-sandbox/tsconfig.app.json` sets `outDir: "dist"` and
`tsBuildInfoFile: "dist/tsconfig.app.tsbuildinfo"`. The project's Vite `build`
target writes the *same* `dist` with `emptyOutDir: true`, and its Nx `outputs`
are `{projectRoot}/dist`, so a cached build restore replaces that directory
wholesale. Measured: after `nx run chat-overlay-sandbox:build` served from
cache, `dist/` contained only `assets favicon.ico index.html` — every `.d.ts`
and the tsbuildinfo were gone.

`tsconfig.spec.json` references `./tsconfig.app.json`, so the spec project
resolves `../../app/app` to `dist/app/app.d.ts`. When the declarations are
absent but the tsbuildinfo survives, `tsc --build` reports
`Project 'tsconfig.app.json' is up to date because newest input 'src/test-setup.ts' is older than output 'dist/tsconfig.app.tsbuildinfo'`
(captured with `tsc --build --dry --verbose`) and never re-emits — so the spec
project reports `TS6305` on every subsequent run, permanently.

Two facts confirm the diagnosis:

- `tsc -p tsconfig.app.json --emitDeclarationOnly --outDir <tmp>` compiles
  cleanly and emits all 12 declarations — **the sandbox sources have no type
  error**, and `libs/chat-overlay` is not at fault.
- `tsc --build --emitDeclarationOnly --force` regenerates them and the project
  goes green; a plain re-run then also reports 0 errors.

So this is a stale-state defect, not a clean-checkout defect. A pristine
checkout passes; the failure appears once `build` has run. That makes it a
*duplicate writer* problem, and it is latent in three more projects whose tsc
`outDir` collides with a bundler output directory:

| Project | tsc `outDir` | Bundler outDir | spec→lib/app reference? | Status |
| --- | --- | --- | --- | --- |
| `apps/chat-overlay-sandbox` | `dist` | `./dist` | **yes** | failing now |
| `libs/settings-panel` | `dist` | `./dist` | **yes** | latent |
| `libs/usage-dashboard` | `dist` | `./dist` | **yes** | latent |
| `apps/chat` | `dist` | `./dist` | no | latent, cannot `TS6305` today |
| `apps/chat-api`, `apps/mcp-app-sandbox` | `dist` | `dist` (webpack, independent of tsc `outDir`) | n/a | safe to migrate — see correction below |
| `libs/chat-api-client` | `dist` | *(none — `tsc` itself is the publishable build)* | n/a | **excluded from D2**, see correction below |
| 26 other libs | `../../dist/libs/<name>` | `./dist` | — | safe by convention |

**Correction found during implementation (task 2.3):** applying D2 uniformly
broke `libs/chat-api-client` specifically. Unlike every other row in this
table, `libs/chat-api-client` has no separate bundler `build` target — its
`tsconfig.lib.json` sets `"emitDeclarationOnly": false`, which is the
`@nx/js/typescript` plugin's signal that this project's `build` target *is*
`tsc --build tsconfig.lib.json` itself, writing the npm-publishable
`main`/`types` output straight into `dist`. Moving its `outDir` to
`out-tsc/lib` made Nx stop inferring a `build` target at all (verified: `nx
show project chat-api-client --json` drops `build` from `targets` entirely),
which would silently remove it from `nx run-many -t build --all` and break its
published output — a regression D2/D3 exist to prevent, not cause.
`apps/chat-api` and `apps/mcp-app-sandbox`, by contrast, build through a
webpack target with its own hardcoded `path: join(__dirname, 'dist')` that
never reads the tsconfig's `outDir`; moving their tsc `outDir` was verified
safe (`build` target unaffected) and they keep the uniform default.

The fix: leave `libs/chat-api-client/tsconfig.lib.json` at `outDir: "dist"`,
and give it a project-level override in its `package.json` `"nx.targets"`
block for only the `typecheck` target's `outputs` (pointing at the `dist`
paths it actually emits), letting `inputs` and everything else still inherit
the corrected `targetDefaults.typecheck`. Project-level `package.json` target
config takes precedence over `nx.json` `targetDefaults` per key, so this is a
narrow, additive exception — verified afterward that `typecheck.dependsOn`
still reports the pre-existing, already-sound `["build", "^typecheck"]`
unchanged, and `build`'s own target definition is untouched.

### Root cause of the `chat-api` errors

`MetricData` in `@opentelemetry/sdk-metrics` is a discriminated union, so
`metric.dataPoints` widens to
`DataPoint<number>[] | DataPoint<Histogram>[] | DataPoint<ExponentialHistogram>[]`.
`Array.prototype.flatMap`'s signature cannot infer a single element type across
a union of array types (`TS2322`), and the resulting element degrades to
`unknown` (`TS18046`). This is a genuine typing defect in the test's traversal
— not a compiler or configuration problem.

### PR CI does not typecheck (verified against the pinned revision)

`.github/workflows/pr.yml` delegates its main checks to
`epam/ai-dial-ci/.github/workflows/node_pr.yml@4.11.0`. That tag was cloned and
read. It calls `node_test.yml`, whose three jobs are:

| Job | Runs | Can it fail on a type error? |
| --- | --- | --- |
| `format_checks` | `npm run format` → `prettier --write` | No — it *writes*, so it cannot fail on formatting either |
| `style_checks` | `npm run lint` → `nx run-many --target=lint --all --fix && npm run format` | No — `--fix` |
| `code_checks` | `npm run test` → `nx run-many -t test --all` | No — Vitest/esbuild strips types without checking them |

Plus `docker_build`/Trivy and ORT. **No job runs `tsc` or any `typecheck`
target.** The repository's own jobs (`validate_agent_docs`, the chat-hooks
packed-package jobs, `publish_lib_coherent_release`) do not either — the
closest is `publish:lib:coherent-release-test`, which typechecks *packed
consumers* of four libraries, not the workspace. There is therefore no
redundancy risk in adding a workspace typecheck job.

## Goals / Non-Goals

**Goals:**

- `npm run typecheck:full:quiet` is trustworthy: it fails on a real type error
  in any production *or* test source of any of the 32 configured projects,
  warm cache or cold.
- The full command succeeds from a clean checkout with no `dist`, no
  `tsbuildinfo` and no Nx cache, producing whatever declarations it needs
  itself.
- No bundler target and no typecheck target write the same directory.
- A repository-owned PR job runs it.

**Non-Goals:**

- NestJS migration, dependency upgrades, dependency-ownership cleanup, Knip,
  Vitest-config consolidation, frontend refactoring, the production memory
  issue. Recorded as follow-ups.
- Changing runtime behavior, published package contracts, the generated
  `chat-api-client`, bundler module resolution, or extensionless relative
  imports.
- Setting branch protection. Adding a job does not make it required; that is
  administered outside this repository.
- No UI, i18n, RTL or accessibility surface is touched by this change. No new
  user-visible strings.

## Decisions

### D1 — Fix the auth-metrics traversal with an explicit element type

Give `flatMap` the element type the union actually produces, and keep every
assertion byte-identical:

```ts
import {
  type DataPoint,
  type ExponentialHistogram,
  type Histogram,
  MeterProvider,
  MetricReader,
} from '@opentelemetry/sdk-metrics';

/* `MetricData` is a union, so `dataPoints` widens to a union of arrays. */
type AuthDataPoint =
  | DataPoint<number>
  | DataPoint<Histogram>
  | DataPoint<ExponentialHistogram>;

const authAttributeValues = resourceMetrics.scopeMetrics
  .flatMap((scope) => scope.metrics)
  .filter((metric) => metric.descriptor.name.startsWith('dial.chat.auth.'))
  .flatMap<AuthDataPoint>((metric) => metric.dataPoints)
  .flatMap((point) => Object.values(point.attributes))
  .map(String);
```

**Verified:** applied in a disposable worktree,
`tsc --build tsconfig.json --emitDeclarationOnly --force` in `apps/chat-api`
reports **no diagnostics**. The widening is sound — every union member is
assignable to `AuthDataPoint` — so it needs no `any`, no cast and no
suppression. The `forbidden` fixture list and the `not.toContain` loop are
unchanged, so the privacy guarantee is untouched.

*Alternative rejected:* narrowing per metric kind with a `switch` on
`descriptor.type`. Type-safe too, but roughly 20 lines to express the same
traversal, and it would need editing whenever OpenTelemetry adds a data-point
kind.

### D2 — One declaration output directory, never shared with a bundler

Move every `typecheck` declaration output into `{projectRoot}/out-tsc/`, which
no bundler target writes and which `.gitignore` already covers. Concretely, for
each project's `tsconfig.app.json` / `tsconfig.lib.json`:

```jsonc
"outDir": "out-tsc/lib",                          // was "dist" or "../../dist/libs/<name>"
"tsBuildInfoFile": "out-tsc/lib/tsconfig.lib.tsbuildinfo"
```

This is the decision that makes the outputs contract in D3 expressible at all,
because a single `targetDefaults` entry cannot interpolate a library's
directory name (project names are `@epam/ai-dial-chat-shared` while the
directory is `libs/chat-shared`, so `{projectName}` does not resolve to the
current `../../dist/libs/<name>` paths).

It is safe with respect to publishing: a library's **published** declarations
are emitted by `vite-plugin-dts` during the Vite `build` into
`libs/<name>/dist`, which is what `package.json` `exports.types` points at
(`libs/chat-shared/package.json` → `"types": "./dist/index.d.ts"`). The
`tsc --build` declarations are consumed only by the TypeScript project-reference
graph. Moving them changes no package contract. The `test-packed-*` and
`publish_lib_coherent_release` jobs exercise the published surface and must
stay green as proof.

*Alternative rejected (conservative):* repoint only the four colliding
projects at `../../dist/<path>` to match the 26-library majority. Smaller, and
it does fix today's `TS6305` — but it leaves two output conventions in the
workspace, so `targetDefaults.typecheck.outputs` still cannot be written once,
and the cache stays unsound. It fixes the symptom the audit saw and none of the
reason it was invisible.

*Alternative rejected:* `tsc --noEmit` per project instead of `--build`.
`composite: true` in `tsconfig.base.json` forbids `noEmit`, and dropping
composite would discard project references and incremental reuse across the
whole workspace.

### D3 — Correct the target contract in one `targetDefaults.typecheck` block

```jsonc
"typecheck": {
  "inputs": [
    "default",
    "^production",
    "{workspaceRoot}/tsconfig.base.json",
    { "dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}", "transitive": true },
    { "externalDependencies": ["typescript"] }
  ],
  "outputs": ["{projectRoot}/out-tsc/**"]
}
```

`default` is `{projectRoot}/**/*` plus `sharedGlobals`, so it includes test
sources and every tsconfig — closing the invalidation gap. `^production` keeps
upstream production sources in the hash without dragging in upstream tests.
`dependentTasksOutputFiles` makes a dependency's regenerated declarations part
of this task's hash, matching what `@nx/js` already infers for the three sound
projects.

**Verified in place (with immediate restore, `git status` clean afterwards):**
an `inputs`/`outputs`-only `targetDefaults.typecheck` *does* override the
plugin-inferred `inputs` and `outputs` on both plugin families, and — critically
— **preserves each project's inferred `dependsOn`**:

| Project | `dependsOn` after the override | `outputs` after the override |
| --- | --- | --- |
| `chat-api-client` | `["build", "^typecheck"]` ✅ preserved | `{projectRoot}/out-tsc/**` |
| `@epam/chat-api` | `["^typecheck"]` | `{projectRoot}/out-tsc/**` |
| `chat-overlay-sandbox` | `["^typecheck"]` | `{projectRoot}/out-tsc/**` |

So `chat-api-client`'s required build-before-typecheck sequencing survives
untouched, and ordinary typechecking still never regenerates OpenAPI (its
`build` compiles already-committed generated sources; `openapi` is a separate
target nothing here depends on). No `dependsOn` is added by this change.

**No cycle, no duplicate writer, no bundling.** The only task edges are the
pre-existing `^typecheck` (and `chat-api-client`'s inferred `build`).
`build → ^build, ^typecheck` already exists and is untouched; because
`typecheck` gains no edge to `build`, the `typecheck → build → ^typecheck`
cycle that a blanket dependency would create never forms. After D2 the
`typecheck` output set (`out-tsc/**`) and every `build` output set (`dist`) are
disjoint, so no two tasks write the same path and a cached `build` restore can
no longer delete a `typecheck` artifact.

*Alternative rejected:* per-project `project.json` files declaring inputs and
outputs. No project in this workspace has a `project.json` today — all 32
targets are inferred — so this would introduce 32 new files to express one
uniform rule.

### D4 — Full vs affected behavior

Both existing commands keep their shape and their `run-quiet` wrapper; only
their trustworthiness changes.

- Full: `npm run typecheck:full:quiet` → `nx run-many -t typecheck --all`.
- Affected: `npm run typecheck:affected` → `nx affected --target=typecheck --base=origin/development`.

With D3's `inputs`, a changed test file now both invalidates its own project's
result and marks that project affected, so the two commands agree. Declaration
artifacts a run needs are produced by the run itself through `^typecheck`, and
on a cache hit they are restored because they are now declared outputs — the
measured "cache hit with `dist/` absent" behavior becomes impossible.

### D5 — A repository-owned `typecheck` PR job

Add to `.github/workflows/pr.yml`, alongside the existing repository-owned
jobs and mirroring their shape (`ubuntu-24.04`, `actions/setup-node` with
`node-version: 24` and `cache: npm`, `npm ci`):

| Property | Value |
| --- | --- |
| Job id | `typecheck` |
| Job name | `Workspace typecheck (all projects)` |
| Scope | all 32 projects with a `typecheck` target |
| Runtime | Node 24, matching every other PR job |
| Command | `npm exec nx run-many -- -t typecheck --all` |

It runs the plain Nx command rather than `typecheck:full:quiet` so that CI logs
carry the full compiler diagnostics. It is placed in this repository, not
proposed upstream to `ai-dial-ci`, because the gap is in a pinned third-party
workflow this repository does not control.

**Branch protection is out of scope and must not be conflated with this job.**
Adding the job makes the check *appear* on pull requests; making it *required*
is a repository-settings change administered outside this repository. The
implementation records this as an explicit follow-up request rather than
claiming enforcement.

## Risks / Trade-offs

- **[D2 touches ~32 tsconfig files]** → Mechanical, one-line-pair edits with no
  semantic content. `nx run-many -t build --all` plus the four packed-package
  CI jobs prove no published artifact moved. Slice 2 lands and verifies it on
  its own.
- **[Moving `outDir` breaks a consumer that reads `dist/libs/<name>`]** →
  Searched: nothing in `package.json` `exports`, the publish tooling or the
  Vite configs reads it; it exists solely for the project-reference graph. The
  implementation re-checks with a workspace grep before editing, and
  `npm run validate:docs` plus `publish:lib:coherent-release-test` back it.
- **[`inputs: "default"` widens the hash, so more tasks re-run]** → Accepted
  deliberately: the current narrow hash is exactly the unsoundness. Measured
  cost to beat: a full uncached `run-many -t typecheck --all` is ~13 s wall
  clock on this machine.
- **[Existing developer machines carry the poisoned `dist` state]** → After
  D2 the stale directory is simply unused, so the state self-heals on the next
  run rather than needing a manual `--force`. The change notes call this out.
- **[The new job turns red on merge day for in-flight PRs]** → Intended: those
  PRs contain real type errors. The two known failures are fixed in slice 1,
  before the job is added in slice 3.
- **[Node 24 in CI vs Node 20 locally]** → Every measurement in this document
  is Node 20.19.5. TypeScript's diagnostics do not depend on the Node major,
  but the verification slice re-runs the full command on Node 24 before the
  job is declared done.
- **[`out-tsc/**` as an output captures more than declarations]** → That
  directory is exclusively tsc-owned and gitignored, so over-capture costs
  cache size, not correctness.

## Migration Plan

Four slices, each independently verifiable and independently revertible:

1. **Fix the real defect** — D1 only. `@epam/chat-api` typecheck and the
   auth-metrics suite go green. No config touched.
2. **Repair the output contract** — D2 + D3 together (they are not separable:
   D3's single `outputs` glob is only correct once D2 has unified the
   convention). Proven against a disposable checkout with no `dist`, no
   `tsbuildinfo` and no Nx cache.
3. **Add the PR job** — D5, once the workspace is green.
4. **Documentation and final evidence** — `docs/architecture.md`, root
   `README.md`, `AGENTS.md`; `npm run validate:docs`.

**Rollback:** every change is configuration or test typing with no runtime
effect. Reverting the commit restores previous behavior exactly; the only
consequence is that PR typechecking stops. The CI job can be removed alone
without reverting D1–D3, and D1 stands alone without D2/D3.

## Open Questions

- **Who sets branch protection?** The job can be added, but marking the
  `Workspace typecheck (all projects)` check required needs a repository
  administrator. Tracked as a follow-up request, not a task this change can
  complete.
- **Should `ai-dial-ci` add a typecheck job upstream?** Doing so would benefit
  every DIAL repository, but it is a third-party change on a pinned tag and
  cannot gate this one. Raised as
  [epam/ai-dial-ci#611](https://github.com/epam/ai-dial-ci/issues/611).
- **Unrelated discoveries, recorded not acted on:** `node_test.yml@4.11.0` runs
  `npm run format` (`prettier --write`) and `npm run lint` (`--fix`), so
  neither the format nor the auto-fixable lint gate can fail a PR. This is a
  real hole in the same family as the typecheck gap, but fixing it means
  changing a third-party workflow or shadowing it locally, which is outside
  this change's boundary.
