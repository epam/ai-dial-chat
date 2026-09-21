# Final evidence — `make-typecheck-reproducible`

Recorded per task 4.4. This is local evidence of what was run and observed
during implementation; it is distinct from actual GitHub check execution and
from branch-protection configuration, neither of which this record claims.

## Environment

- Implementation base revision: `13f09a8f8` (branch `docs/update_obs_docs`).
- Mid-implementation, the checked-out branch moved externally (not by this
  session) to `development` and fast-forwarded to `e73f87d84`, picking up
  two unrelated upstream commits (`847540d3b`, `e73f87d84`). Uncommitted
  work carried over intact and was moved onto branch
  `feat/make-typecheck-reproducible`. Slice-2 clean-checkout/negative-proof
  verification (tasks 2.8–2.13) was performed before that branch move, in a
  disposable `git worktree` created from `13f09a8f8`.
- OS: macOS (Darwin 25.6.0). Node `v20.19.5`. npm `11.16.0`.
  (The 2026-09-21 audit that motivated this change used Node `24.14.0`; PR CI
  runs on Node 24. TypeScript diagnostics do not depend on the Node major, and
  the full workspace typecheck was re-confirmed green on the final revision
  before this record was written.)

## Target inventory

`nx show projects --with-target=typecheck` reports **32 of 33** projects.
Before this change: 3 projects (`@epam/chat-api`, `chat-api-client`,
`mcp-app-sandbox`) had `@nx/js/typescript`-inferred, already-sound explicit
`inputs`/`outputs`; the other 29 (`@nx/vite`-inferred) declared
`inputs: ["production", …]` (excluding test files) and no `outputs` at all.

## Slice 1 — auth-metrics fix

| Check | Result |
| --- | --- |
| `npm run test:file -- apps/chat-api/src/auth/tests/auth-metrics.spec.ts` | PASS (task 1.4) |
| `nx run @epam/chat-api:typecheck --skip-nx-cache` | 0 diagnostics, was `TS2322`@697:28 + `TS18046`@698:41 (task 1.5) |
| `npm run verify:changed` | typecheck:affected PASS, lint:affected PASS, test:changed PASS (task 1.6) |
| Escape-hatch grep (`any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error`) | none introduced (task 1.3) |

## Slice 2 — declaration-output contract

### Discovery made during implementation

Applying the planned uniform `out-tsc` migration to `libs/chat-api-client`
broke it: its `build` target is inferred by `@nx/js/typescript` directly from
the same `tsconfig.lib.json` (no separate bundler build — this is the one
project where `tsc`'s own output *is* the publishable `dist`). Moving its
`outDir` made Nx drop the inferred `build` target entirely (`'build' in
targets` → `false`), which would have silently removed it from
`nx run-many -t build --all`. Fix: left `libs/chat-api-client/tsconfig.lib.json`
at `outDir: "dist"` and added a project-level `typecheck.outputs` override in
its own `package.json`'s `"nx.targets"` block. `apps/chat-api` and
`apps/mcp-app-sandbox` were verified safe to migrate (their `build` targets
are independent webpack targets that never read the tsc `outDir`).
`design.md` and `proposal.md` were updated in place to record this.

### Task-graph guards (2.6–2.7)

| Project | `typecheck.dependsOn` | `typecheck.outputs` |
| --- | --- | --- |
| `chat-api-client` | `["build", "^typecheck"]` (unchanged) | `dist`-based (project-level override) |
| `@epam/chat-api` | `["^typecheck"]` | `{projectRoot}/out-tsc/**` |
| `chat-overlay-sandbox` | `["^typecheck"]` | `{projectRoot}/out-tsc/**` |
| all other 29 | `["^typecheck"]` | `{projectRoot}/out-tsc/**` |

Task graph for `nx run-many -t typecheck --all`: 33 tasks (32 typecheck + 1
build — `chat-api-client:build`, pre-existing and expected). No cycle (Nx
computed the graph without error). One pre-existing, sequenced-safe output
overlap found: `chat-api-client`'s `typecheck` and `build` both list
`dist/tsconfig.lib.tsbuildinfo`, confirmed byte-identical to the pre-change
state and safe because of the unaffected `dependsOn: ["build", …]`
sequencing (tsc's incremental build never wipes the directory the way Vite's
`emptyOutDir: true` does). Zero new overlaps among the other 31 projects.

### Clean-checkout and negative proofs (2.8–2.13)

Performed in a disposable `git worktree` at `13f09a8f8` with the uncommitted
diff applied via `git apply`, and a real independent `node_modules` (an APFS
clone, **not a symlink** — a symlink to the main tree's `node_modules` caused
a false-positive: TypeScript resolved the same file through two different
absolute paths and produced spurious `TS2550`/`TS4113` errors unrelated to
this change; also, an `NX_WORKSPACE_ROOT_PATH` environment variable pinned to
the main tree caused every "worktree" Nx invocation to silently operate
against the main tree's cache until unset). Both are recorded here so a
future clean-checkout proof in this workspace doesn't repeat them.

| Proof | Result |
| --- | --- |
| Cold run, no `dist`/`out-tsc`/`tsbuildinfo`/cache, no manual pre-build (2.8) | All 32 projects pass, 0/33 cache hits |
| Warm cache, then inject a **production**-source error (2.9) | `chat-overlay-sandbox` fails with `TS2322` at the exact line, no cache hit for it; restoring returns to `33/33` cache hits |
| Warm cache, then inject a **test**-source error, sandbox (2.10) | Fails with `TS2322`/`TS6133`, no cache hit — the exact regression this change fixes (previously exited `0` with a cache hit) |
| Warm cache, then inject a **test**-source error, `libs/chat-shared` spec (2.10) | `@epam/ai-dial-chat-shared:typecheck` fails; every dependent correctly skipped rather than cache-hit-passing |
| `npm exec nx affected --target=typecheck --base=origin/development`, same injected test error (2.11) | Fails with the same diagnostic |
| `build` → `typecheck`, cold, for the 3 previously-colliding projects (2.12) | All succeed |
| `typecheck` → `build` (reverse order), cold (2.12) | All succeed; re-running `typecheck` afterward reports 0 errors, no `TS6305` |
| `git status --porcelain` after every command above (2.13) | Only the intended 34-file diff; worktree deleted afterward |

### Package-contract proof (2.14)

`nx run-many -t build --all`: 32/33 succeed; the one failure
(`attachment-canvas-consumer-fixture:build`, `@tabler/icons-react` module
resolution) reproduced identically with this entire change reverted via
`git stash` — confirmed pre-existing and unrelated (recorded as task 5.4).
`@epam/ai-dial-chat-hooks:test-packed-smoke` PASS. `publish:lib:coherent-release-test`
PASS (both subtests). Published declarations and `exports.types` unaffected.

### `npm run verify:changed` / `npm run build:quiet` (2.15)

`typecheck:affected` PASS. `lint:affected` PASS. `test:changed` and
`build:quiet`: same isolated, pre-existing `attachment-canvas-consumer-fixture`
failure as above; every other task passed.

## Slice 3 — CI job

- Added `typecheck` job to `.github/workflows/pr.yml`, mirroring the shape of
  the existing repository-owned jobs (Node 24, `npm ci`,
  `nx run-many -t typecheck --all`).
- Confirmed via a direct clone-and-read of `epam/ai-dial-ci@4.11.0` (its
  `node_pr.yml` → `node_test.yml`) that no existing job — in that pinned
  reusable workflow or in this repository's own `pr.yml` — runs `tsc` or an
  `nx typecheck` target. `publish_lib_coherent_release`'s "coherent-release
  install" step typechecks 4 packed libraries together, a narrower and
  different check.
- YAML validated with `js-yaml` (`require('js-yaml').load(...)`); 9 unique
  job ids, no collision.
- **Not claimed:** that this check is required. Making it required is
  branch-protection configuration administered outside this repository —
  recorded as a follow-up request in `proposal.md` and `design.md`.

## Slice 4 — documentation

- `docs/architecture.md`: added a "Typechecking and verification" subsection
  and Decision Log row 21 (open — branch-protection follow-up).
- Root `README.md` / `AGENTS.md`: no change needed — no documented command
  name, output path, or npm script changed at the interface level.
- Local git-excluded planning docs (`technical-debt-remediation-plan.md`,
  `refactoring.md`, `refactoring-backend.md`, `refactoring-frontend.md`,
  `tech-debt-infrastructure.md`): item 5 and its cross-references updated to
  **Done**, confirmed still excluded via `.git/info/exclude` after editing.

## Follow-ups (not implemented here, see tasks.md §5)

1. `node_test.yml@4.11.0` also runs `npm run format` (`--write`) and
   `npm run lint` (`--fix`) as its format/style gates — neither can fail a PR,
   the same class of gap as the typecheck one, but in the pinned third-party
   workflow.
2. Whether `epam/ai-dial-ci` should gain a typecheck job upstream — filed as
   [epam/ai-dial-ci#611](https://github.com/epam/ai-dial-ci/issues/611).
3. `tools/attachment-canvas-consumer-fixture:build`'s pre-existing
   `@tabler/icons-react` resolution failure (task 5.4).
4. Ask a repository administrator to mark `Workspace typecheck (all
   projects)` a required status check.

## Closing `npm run verify:full` (task 4.6)

Run once, on the final revision, after the two upstream commits landed:

| Step | Result |
| --- | --- |
| `typecheck:full:quiet` (`nx run-many -t typecheck --all`) | **PASS** — all 32 projects, no diagnostics |
| `lint:check:quiet` → `lint` | **PASS** — all projects |
| `lint:check:quiet` → `format:check` | Fails on **one file**: `apps/chat-api/README.md`. Confirmed pre-existing and unrelated — reproduces identically with this entire change reverted via `git stash`. Not touched (out of scope; unrelated README content). |
| `test:full:quiet` (run separately since the `&&` chain stopped at the format failure above) | Fails on **one task**: `attachment-canvas-consumer-fixture:build` (the same `@tabler/icons-react` resolution failure recorded in tasks.md §5.4, confirmed pre-existing). Every other of 39 test tasks passed. |

Both residual failures are pre-existing, confirmed unrelated to this change,
and out of its boundaries (dependency-ownership cleanup and unrelated README
content are explicit non-goals). No task in this change depends on either.
