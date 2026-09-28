# Witches spell lesson verification

## Browser evidence

Local Storybook `halloween-scenes--witches`, Chromium through Playwright, 2026-09-27. The existing host story was used without editing its user-owned changes. Scripts, JSON measurements and representative PNG frames are retained locally under `tmp/witches-evidence/` (ignored working artifacts).

| Viewport | Direction | Motion | Button copies | Scene animations | Result |
| --- | --- | --- | --- | --- | --- |
| 360 × 900 | LTR, RTL | Enabled | 1 | 25 | Passed |
| 900 × 900 | LTR | Enabled | 1 | 25 | Passed |
| 1280 × 900 | LTR, RTL | Enabled | 2 | 30 | Passed |
| 1920 × 900 | LTR | Enabled | 2 | 30 | Passed |
| 360 × 900 | RTL | Reduced | 0 | 0 | Passed |
| 1280 × 900 | LTR | Reduced | 0 | 0 | Passed |

Assertions cover no horizontal overflow, unmirrored button text, bounded resources, preserved draft on input, three replay/cancel cycles without residual scene animations/copies, and the two-character fallback after removing the composer anchor. No browser page errors occurred. Representative frames at 3.5, 7.2, 10.3, 13.1, 15.5 and 18.1 seconds show levitation, frog buttons, broom herding, the enchanted broom, correction and departure. Mobile/desktop/RTL and reduced-motion captures were inspected visually.

Screenshots use `caret: 'initial'`: Playwright's default caret hiding writes to textarea styles and correctly triggers the scene's source-mutation cancellation.

## Performance evidence

| Sample | JS geometry reads after preparation | Long tasks | p95 frame interval | Browser layout time |
| --- | --- | --- | --- | --- |
| 360px, normal CPU, initial 6 seconds | 0 | 0 | 9.2ms | 28.5ms total |
| 360px, 4× CPU slowdown, scene seconds 6–14 | 0 | 0 | 9.2ms | 82.1ms total |
| 1280px, normal CPU, scene seconds 6–14 | 0 | 0 | 9.3ms | 40.7ms total |

The warm mobile setup-to-first-frame sample was 8.6ms. Playback uses 25 mobile / 30 desktop WAAPI animations, below the 48-animation budget. Target traversal and track lengths have explicit limits and regression coverage.

These are local development Storybook/headless Chromium measurements on the host machine, with frame sampling performed by the verification script. They are not physical-phone or production GPU benchmarks and do not establish a universal FPS guarantee. SVG articulation still causes browser style/layout work; the claim is **no per-frame JavaScript layout reads or React updates**, not zero browser layout. Setup, native rendering and cancellation all contribute to cost. Detailed counters are in `results.json` and `active-profile.json` in the evidence directory.

## Checks

- Focused target/plan, component/playback, event lifetime, bat fallback, generic flight and story-coverage tests passed through `npm run test:file`.
- Nx library typecheck/lint/test passed before the separate local Witches-only click-pool edit. Focused scene tests passed with the current pool; final affected and full typecheck/lint passed after adding the runtime lifetime regression.
- `npm run validate:docs` passed, including all 49 markdown files and the install matrix.
- `npm run build:quiet` passed: 36 projects and 33 dependency tasks, including the celebrations package and affected apps.
- `openspec validate halloween-witches-spell-scene --strict` and `git diff --check` passed.
- `npm run verify:changed`: typecheck and lint passed. Tests encountered sandbox restrictions (`~/.npm` writes and localhost listeners), the local click-pool override and unrelated attachment-canvas bundle budgets.
- `npm run verify:full` was run once: full typecheck and lint passed, but formatting stopped the chain at the unchanged `apps/chat-api/README.md`. The complete test stage was then run separately with access to the package cache and local test servers; it finished with the failures detailed below.

The working tree's `HALLOWEEN_CLICK_BURSTS` was separately narrowed to Witches during the initial implementation. That local preview configuration was preserved at the time; six Extras registration cases and the Secrets eleven-scene pool assertion consequently failed. During the refinement's final verification, the working tree again contained the ordinary pool, and the complete celebrations suite passed. The scene implementation does not require changing that pool.

The attachment-canvas eager-entry budget assertions report 65,617 raw bytes versus 57,000 allowed and 17,097 gzip bytes versus 16,000 allowed. Its unpacked artifact also exceeds the existing limit: 243,202 versus 230,000 bytes. Neither attachment-canvas nor the backend README was modified by this change; `git diff --exit-code` confirmed both paths are unchanged. No unrelated fixes or changes to test expectations were made.

The initial full celebrations suite had 766 passing tests and the seven temporary click-pool failures described above. The refinement's celebrations suite passes with the ordinary pool. Consumer package-install fixtures pass when run outside the restrictive sandbox.

The initial full backend suite had 4,063 passing tests and one unrelated failure in `apps/chat-api/src/app-config/tests/app-config.service.spec.ts:81`: `aiTextRefinementAvailable` is true where the fixture expects false. The entire `apps/chat-api` tree is unchanged. That full test run therefore reported three failing projects: attachment-canvas (three size budgets), celebrations (seven temporary local click-pool assertions), and chat-api (one app-config assertion); 72 other tasks succeeded. Logs are retained under `tmp/agent-logs/`, including `2026-09-27T18-07-14-670Z-test-full.log`.

The personal `celebration-scene-ideas` skill was updated with required numeric performance budgets, browser profiling and the `opsx-propose` → `apply` implementation workflow. Its skill validator passed. It lives outside this repository.

## Motion-quality refinement

The motion guidance was applied to this same change through updated proposal,
design, spec and implementation tasks. The personal skill now includes the
motion audit, character-animation principles and performance review in
`references/motion-quality.md`; its validator passed.

The before/after browser audit found spell centers approximately 20–25px away
from the posed hands and a brief dimming of returned button labels. Spell
origins now follow the artwork's arm pivot and held casting pose, and returned
copies remain opaque until the snapshot helper fully restores their sources.
Flight arcs, anticipation, ballistic hops, landing recovery and delayed
hat/cloak movement distinguish the two characters without adding animations.

Local evidence is in `tmp/witches-polish/`: `before.json`, `after.json`, PNG
comparisons, `checks.json`, `results.json` and `active-profile.json`. The checks
cover 360/900/1280/1920px and mobile/desktop RTL. Spell-to-hand and broom-impact
errors are below 0.006px in the rendered SVG coordinate system; every sampled
source/copy handoff retains an opaque control. The responsive, reduced-motion,
input preservation, cancellation/replay and no-composer checks passed again
with no page errors or horizontal overflow.

Uninterrupted mobile and desktop playback was recorded as
`360-playback.webm` and `1280-playback.webm`. Automated assertions confirmed
natural scene completion with no residual copies or owned animations. Timed
before/after frames were inspected visually; the recorded videos are available
for normal-speed review but were not visually reviewed here.

| Active phase, scene seconds 6–14 | JS geometry reads | Long tasks | p95 frame interval | Browser layout time | Animations |
| --- | --- | --- | --- | --- | --- |
| 360px, 4× CPU slowdown | 0 | 0 | 9.2ms | 60.9ms total | 25 |
| 1280px, normal CPU | 0 | 0 | 9.3ms | 36.8ms total | 30 |

Animation counts are unchanged and remain below the 48-animation limit. The
same headless development-build measurement limits apply; these individual
samples do not establish a statistically significant speed improvement.

All 32 focused plan, playback and component tests passed after the refinement,
including a regression that compares copy removal with the actual snapshot
helper's source restoration. Nx library typecheck, lint and build passed.
Documentation validation passed (49 markdown files and the install matrix).
The complete celebrations suite also passed in affected verification with the
ordinary click pool. Final affected and full typecheck/lint passed. The final
`verify:full` stopped at the existing formatting issue in the unchanged
`apps/chat-api/README.md`, so its subsequent test stage did not run; the earlier
complete repository test results above remain the baseline for unchanged code.
The final `verify:changed` completed with only the existing attachment-canvas
size budgets and backend app-config assertion failing; 73 other tasks succeeded.
The backend again reported 4,063 passing tests and one failure. Both affected
paths remain unchanged. Final logs are
`2026-09-27T18-56-14-578Z-test-changed.log` and
`2026-09-27T18-56-53-989Z-format-check.log` under `tmp/agent-logs/`.
The final review found no new correctness, readability, architecture, security,
performance, responsive-parity or documentation findings in this refinement.

## Review: Witches spell lesson

### Context

- [x] Read the OpenSpec artifacts and checked implementation against the six story beats and budgets.

### Correctness

- [x] Exact button return, gesture/contact order and finite tracks covered.
- [x] Input, focus, selection, interruptions, source mutation/resize, unsupported/reduced motion, StrictMode, setup failure and repeated cleanup covered.
- [x] Runtime gives Witches its own 20.5-second deadline; the shared bat/New Year flight renderer remains available.

### Readability

- [x] Target selection, pure choreography, playback ownership and artwork have separate responsibilities.
- [x] Performance limits and duration are named; timeline numbers describe story poses rather than a general animation framework.

### Architecture

- [x] No host routes, classes, app contexts, feature flags, storage, API clients or i18n imports in the library. Anchors and mobile preference arrive through the existing environment.
- [x] No public API, dependency, manifest, provider or structural architecture change.
- [x] Relative code imports are extensionless; articulated parts use a string enum.

### Security

- [x] No new network requests, dependencies, secrets or persistent state.
- [x] Copies are inert, aria-hidden and pointer-transparent; the real composer is never cloned.

### Performance

- [x] Bounded targets, subtree copying, animations and keyframes; precomputed transform/opacity tracks.
- [x] Browser evidence and cancellation/replay checks recorded with their measurement limits.

### Responsive parity

- [x] 360/900 mobile and 1280/1920 desktop, LTR/RTL and reduced motion checked.
- [x] Existing mobile environment and named Tailwind breakpoint used; no new breakpoint detection.

### Documentation accuracy

- [x] README and enum documentation describe implemented behavior and budgets.
- [x] Docs validation passed; no structural architecture documentation update is needed.

### Verification

- [x] Focused tests, affected typecheck/lint/build and docs validation passed.
- [x] Final full-repository verification assessed, with external/local-configuration failures recorded above.

### Verdict

No blocking Witches implementation findings from the five-axis review. The celebrations suite passes with the current ordinary click pool. The repository as a whole is not green because of unrelated size/app-config failures and backend README formatting. This records implementation completion and its verification limits, not merge approval. The change remains unarchived.
