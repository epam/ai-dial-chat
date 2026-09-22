**Slicing strategy: risk-first.** The highest-risk and least-understood part is
not the two visible errors — it is that 29 of 32 typecheck targets cannot fail
on a test-file type error. Slice 1 removes the one genuine code defect so the
workspace can reach green; slice 2 proves the output/cache contract against a
disposable clean checkout before anything depends on it; slice 3 only then puts
a gate in front of it; slice 4 records the evidence. Each slice is independently
verifiable and independently revertible.

No UI, i18n, RTL or accessibility work is expected in this change, and no new
user-visible strings are introduced, so no i18n, RTL or a11y tasks appear below.
No `libs/*` runtime source is touched — only `tsconfig.lib.json` `outDir` /
`tsBuildInfoFile` values — so no host-owned integration detail can enter a lib;
task 2.3 carries that guard explicitly. No HTTP endpoint changes, so no
OpenAPI/generated-client tasks apply.

## 1. Fix the genuine type defect in auth-metrics

- [x] 1.1 In `apps/chat-api/src/auth/tests/auth-metrics.spec.ts`, add
      `type ExponentialHistogram` to the existing
      `@opentelemetry/sdk-metrics` import and declare the
      `AuthDataPoint` union (`DataPoint<number> | DataPoint<Histogram> |
      DataPoint<ExponentialHistogram>`) beside it, with a block comment
      explaining that `MetricData` is a union so `dataPoints` widens to a union
      of arrays. Use a `/* ... */` block comment per `AGENTS.md` §Code comments.
- [x] 1.2 In the same file, change the `never records a request-scoped
      identifier as an attribute value` test's
      `.flatMap((metric) => metric.dataPoints)` to
      `.flatMap<AuthDataPoint>((metric) => metric.dataPoints)`. Change nothing
      else: the `forbidden` fixture list, the `startsWith('dial.chat.auth.')`
      filter, the `Object.values(point.attributes)` traversal, the `.map(String)`
      and the `not.toContain` loop all stay byte-identical.
- [x] 1.3 Confirm no `any`, no double cast, no `@ts-ignore` and no
      `@ts-expect-error` was introduced: `git diff -- apps/chat-api | grep -nE
      '\bany\b|as unknown as|@ts-(ignore|expect-error)'` returns nothing new.

**Verification (slice 1)**

- [x] 1.4 `npm run test:file -- apps/chat-api/src/auth/tests/auth-metrics.spec.ts`
      — the whole suite passes, including the privacy assertion.
- [x] 1.5 `npm exec nx run @epam/chat-api:typecheck --skip-nx-cache` exits `0`
      with no `TS2322` and no `TS18046`.
- [x] 1.6 `npm run verify:changed`.

## 2. Repair the declaration-output contract

Tasks 2.1–2.4 land together: the single `outputs` glob in 2.4 is only correct
once 2.1–2.3 have unified the convention.

- [x] 2.1 Before editing, prove nothing consumes the current declaration
      locations: grep the workspace (excluding `node_modules`, `dist`,
      `out-tsc`) for `dist/libs/` and for `outDir` references in
      `package.json` `exports`/`types`, publish tooling under `tools/`, and the
      `vite.config.mts` files. Record the result in the change notes. Expected:
      only the `tsconfig.*.json` files themselves reference them; published
      declarations come from `vite-plugin-dts` into `libs/<name>/dist`.
- [x] 2.2 In each app's `tsconfig.app.json` — `apps/chat`,
      `apps/chat-overlay-sandbox`, `apps/chat-api`, `apps/mcp-app-sandbox` —
      set `"outDir": "out-tsc/app"` and
      `"tsBuildInfoFile": "out-tsc/app/tsconfig.app.tsbuildinfo"`, replacing the
      current `dist` values. Leave every other compiler option, `include` and
      `exclude` untouched.
- [x] 2.3 In every library's `tsconfig.lib.json` under `libs/*` **except
      `libs/chat-api-client`** (26 currently at `../../dist/libs/<name>`, plus
      `libs/settings-panel` and `libs/usage-dashboard` at `dist`), set
      `"outDir": "out-tsc/lib"` and
      `"tsBuildInfoFile": "out-tsc/lib/tsconfig.lib.tsbuildinfo"`.
      **`libs/chat-api-client` is excluded from this move** — discovered during
      implementation, not anticipated in design.md's table: unlike every other
      lib, its `build` target is inferred by `@nx/js/typescript` directly from
      this same `tsconfig.lib.json` (its `tsconfig.lib.json` has
      `"emitDeclarationOnly": false`, i.e. it is the actual `tsc`-compiled,
      npm-publishable output the `package.json` `main`/`types` fields point
      at — there is no separate bundler `build` target the way every other lib
      has via Vite). Moving its `outDir` away from `dist` makes Nx stop
      inferring a `build` target for it entirely (verified: `'build' in
      targets` flips to `false`), which would silently drop it from every
      `nx run-many -t build --all` and break its publishable output. Leave
      `libs/chat-api-client/tsconfig.lib.json` at `"outDir": "dist"`
      unchanged. Instead, add a project-level target override in
      `libs/chat-api-client/package.json`'s existing `"nx.targets"` block:
      ```json
      "typecheck": {
        "outputs": [
          "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
          "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}.map",
          "{projectRoot}/dist/tsconfig.lib.tsbuildinfo"
        ]
      }
      ```
      Project-level target config in `package.json` takes precedence over
      `nx.json` `targetDefaults` for the keys it specifies, so this keeps
      `typecheck`'s declared `outputs` matching where it actually emits
      (`dist`), while `inputs` and `dependsOn` continue to come from the
      corrected default (`dependsOn` is unaffected either way — it is not
      overridden here — and remains the pre-existing, already-sound
      `["build", "^typecheck"]`, verified unchanged after this override).
      **Architecture guard:** these edits change only TypeScript output paths
      and one Nx target-metadata override. Verify the diff for `libs/*`
      contains no source change and introduces no host-owned integration
      detail — no `/api` path, generated-client or `server-api` import, app
      context, auth/session/cookie/env access, feature flag, routing,
      analytics/telemetry, deployment/tenant detail, third-party SDK setup or
      app storage key. Do not hand-edit any generated file under
      `libs/chat-api-client/src`.
- [x] 2.4 In `nx.json`, add a `targetDefaults.typecheck` entry with **only**
      `inputs` and `outputs` (per design D3):
      `inputs: ["default", "^production", "{workspaceRoot}/tsconfig.base.json",
      {"dependentTasksOutputFiles": "**/*.{d.ts,d.cts,d.mts,tsbuildinfo}",
      "transitive": true}, {"externalDependencies": ["typescript"]}]` and
      `outputs: ["{projectRoot}/out-tsc/**"]`. Do **not** add `dependsOn` —
      that would clobber `chat-api-client`'s inferred
      `["build", "^typecheck"]` sequencing.
- [x] 2.5 Confirm `out-tsc` is covered by `.gitignore` for every touched
      project, and that no `dist` entry was removed from it.

**Verification (slice 2)**

- [x] 2.6 Task-graph guards: `npm exec nx show project chat-api-client --json`
      still reports `typecheck.dependsOn` as `["build", "^typecheck"]`;
      `@epam/chat-api` and `chat-overlay-sandbox` still report `["^typecheck"]`;
      every project reports `outputs: ["{projectRoot}/out-tsc/**"]`. Confirm
      `nx run-many -t typecheck --all --graph=stdout` contains no cycle and no
      `build` task.
- [x] 2.7 Duplicate-writer guard: no `typecheck` target's `outputs` intersect
      any `build` target's `outputs` for the same project.
- [x] 2.8 Clean-checkout proof, in a **disposable** `git worktree` with
      dependencies installed from the lockfile (`npm ci`) and never in the
      user's tree: with no `dist`, no `*.tsbuildinfo` and
      `NX_REJECT_UNKNOWN_LOCAL_CACHE=0 nx reset` run first,
      `npm exec nx run-many -- -t typecheck --all --skip-nx-cache` exits `0`
      for all 32 projects with no manual pre-build step.
- [x] 2.9 Negative proof — **production** source, in the same disposable
      worktree: run the full command to green, then introduce a real type error
      in a production source (e.g. `apps/chat-overlay-sandbox/src/env.ts`), and
      confirm `nx run-many -t typecheck --all` (cache **enabled**) exits
      nonzero. Restore the file and confirm it returns to `0`.
- [x] 2.10 Negative proof — **test** source, the regression this change exists
      for: with a warm successful cache, introduce a real type error in a test
      source (e.g. `apps/chat-overlay-sandbox/src/app/tests/app.spec.tsx` and,
      separately, a `libs/*` spec file) and confirm `nx run-many -t typecheck
      --all` (cache **enabled**) exits nonzero and reports **no cache hit** for
      that project. Restore and confirm green. Baseline to beat: this exits `0`
      with a cache hit today.
- [x] 2.11 Negative proof — affected: with the same injected test error,
      `npm run typecheck:affected` exits nonzero.
- [x] 2.12 Ordering proof: `build` then `typecheck`, and `typecheck` then
      `build`, both succeed for `chat-overlay-sandbox`, `libs/settings-panel`
      and `libs/usage-dashboard`; a cached `build` restore no longer removes a
      declaration the spec project references, and no `TS6305` appears.
      Repeat once more to confirm the warm path.
- [x] 2.13 Cleanliness: `git status --porcelain` reports no tracked-file change
      after every command above. Delete the disposable worktree; commit none of
      the deliberately invalid fixtures.
- [x] 2.14 Package-contract proof (the one place D2 could reach published
      output): `npm exec nx run-many -- -t build --all` succeeds, and
      `npm exec nx run @epam/ai-dial-chat-hooks:test-packed-smoke` plus
      `npm run publish:lib:coherent-release-test` still pass, showing
      `libs/<name>/dist` declarations and `exports.types` are unchanged.
- [x] 2.15 `npm run verify:changed`, then `npm run build:quiet` (bundling
      configuration is in scope for this slice).

## 3. Add the observable PR check

- [x] 3.1 Add a `typecheck` job to `.github/workflows/pr.yml`, mirroring the
      existing repository-owned jobs: `runs-on: ubuntu-24.04`, a timeout,
      `actions/checkout` and `actions/setup-node` pinned to the same SHAs
      already used in that file, `node-version: 24`, `cache: npm`, `npm ci`,
      then `npm exec nx run-many -- -t typecheck --all`. Name it
      `Workspace typecheck (all projects)`. Add a comment stating the scope
      (all projects with a `typecheck` target) and why it is repository-owned
      (the pinned `node_pr.yml@4.11.0` runs no typecheck).
- [x] 3.2 Confirm no redundancy: `node_pr.yml@4.11.0` → `node_test.yml` runs
      `npm run format`, `npm run lint` and `npm run test` only, and no existing
      repository job runs a `typecheck` target. Record this in the change notes
      with the pinned revision.
- [x] 3.3 Validate the workflow file parses (e.g. `actionlint`, or a YAML parse)
      and that the job id does not collide with an existing one.
- [x] 3.4 Record as an explicit **follow-up request to a repository
      administrator**, not as a completed task: marking
      `Workspace typecheck (all projects)` a required status check is a
      branch-protection setting administered outside this repository. Do not
      claim the check is enforced because the job exists, and keep local
      evidence separate from actual GitHub check runs.

## 4. Documentation and final evidence

- [x] 4.1 Update `docs/architecture.md` where it describes verification and
      typechecking: the typecheck target contract (inputs include test sources,
      outputs are `{projectRoot}/out-tsc/**`), the declaration-output
      convention and why it is separate from bundler output, and the new PR
      job. Follow the Docs section of `AGENTS.md`: state what the code does
      today, and keep the branch-protection gap stated as an open item.
- [x] 4.2 Update the root `README.md` and the `AGENTS.md` verification-command
      guidance if any documented command, output path or script changed.
- [x] 4.3 Refresh item 5 and the associated typecheck/verification sections in
      the local, git-excluded planning documents when present —
      `technical-debt-remediation-plan.md`, `refactoring.md`,
      `refactoring-backend.md`, `refactoring-frontend.md`,
      `tech-debt-infrastructure.md`. Keep them excluded through
      `.git/info/exclude` and **out of the commit**; they must not become a
      dependency of CI or of a reviewer's understanding. The evidence a
      reviewer needs is already in this change's tracked artifacts.
- [x] 4.4 Record the final evidence in the change notes: revision, Node and npm
      versions for every run, the target inventory (32 projects with a
      `typecheck` target out of 33), clean/warm/cache conditions, the exact
      commands and their results, and the before/after of the injected-error
      probes. Keep local evidence explicitly distinct from actual GitHub check
      execution and from branch-protection configuration.
- [x] 4.5 `npm run validate:docs` (documentation and manifests changed).
- [x] 4.6 Exactly one closing `npm run verify:full`.

## 5. Follow-ups (record only — do not implement here)

- [x] 5.1 Record that `node_test.yml@4.11.0` runs `npm run format`
      (`prettier --write`) and `npm run lint` (`--fix`), so neither the
      formatting nor the auto-fixable lint gate can fail a PR — the same class
      of hole as the typecheck gap, but in a pinned third-party workflow.
- [x] 5.2 Record whether a typecheck job should be proposed upstream in
      `epam/ai-dial-ci` so every DIAL repository benefits. Filed as
      [epam/ai-dial-ci#611](https://github.com/epam/ai-dial-ci/issues/611).
- [x] 5.3 Record any unrelated discoveries made during implementation. Do not
      mark any production-memory or other out-of-scope item complete.
- [x] 5.4 Recorded: `tools/attachment-canvas-consumer-fixture:build` fails
      independently of this change — `vite build` cannot resolve several
      `./icons/*.mjs` subpaths inside `node_modules/@tabler/icons-react/dist/esm/`
      (e.g. `IconCodeAsterisk.mjs`, `IconAuth2fa.mjs`, `IconCube3dSphere.mjs`).
      Confirmed pre-existing and unrelated: reproduced identically with every
      change in this proposal reverted via `git stash` and reset back to
      `13f09a8f8`. Encountered while running `nx run-many -t build --all`
      (task 2.14), `npm run test:changed` and `npm run build:quiet` (task
      2.15) — all three otherwise passed cleanly (typecheck and lint fully
      clean; the only failing task in each run was this one fixture, plus its
      dependents `attachment-canvas-consumer-fixture:test`/`:verify` skipped
      as a result). Likely an `@tabler/icons-react` version/export-map
      mismatch in that fixture's own dependency tree. Left unfixed per this
      change's boundaries (no unrelated dependency-ownership cleanup).
