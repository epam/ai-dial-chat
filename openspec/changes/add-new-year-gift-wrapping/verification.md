# Gift wrapping verification

## Scope and review

Reviewed the implementation against the approved five-beat plot and the proposal,
design and delta spec. New Year owns its artwork, geometry, animation and lifecycle;
the existing provider/host retains selection, labels, mobile state and anchors.
No external dependency, host mutation, API, navigation, telemetry or storage was
introduced. `NewYearLabels.giftWrappingToastMessage` is optional for compatibility.
The existing secret still plays confetti. The library README describes the new
enum member and actual fallback/cleanup behavior. No structural architecture
document change is needed.

Five-axis self-review: correctness (shared grip geometry, deadlines, cancellation,
StrictMode and fallback tests); readability (scene-local plan/target/art/runner
separation); architecture (existing host-supplied contract only); security (inert
artwork and no external I/O); performance (bounded SVG/WAAPI and measured playback).
Responsive parity and documentation accuracy were also checked.

Review fixes: use user-space gradient coordinates so horizontal ribbon segments
with zero-height bounds render; derive corner hand targets from the actual ribbon
corners; turn the helper toward departure; include focus-out cancellation; keep
the target ancestor scan bounded without an unbounded `closest` traversal.

## Automated verification

- OpenSpec validation passed.
- All 59 targeted scene, geometry, existing New Year and Storybook coverage tests
  passed. The complete celebrations project test target also passed in the
  affected and full workspace runs.
- The app's `CelebrationHost.integration.spec.tsx` expectation was extended to
  include the new notification in the click pool; all 7 integration tests passed
  on the targeted rerun. This was the one related failure discovered by the full
  app suite. Total focused coverage: 66 passing tests.
- Affected build passed (49.2 seconds).
- The final celebrations package build passed after the lifecycle corrections.
- Documentation validation passed: 49 Markdown files and the install matrix.
- Full-workspace typecheck passed for 34 projects and 20 dependencies.
- Full-workspace lint and formatting passed.
- The first affected verification stopped at formatting introduced during the
  visual fixes; the corrected run passed affected typecheck and lint.

The affected and full test commands were executed; the full verification command
was invoked exactly once. Their overall results are **not green**. After fixing
the host test's outdated scene list, remaining failures are outside this change:
consumer package fixtures cannot write to the
sandboxed `~/.npm` cache; backend integration tests cannot listen on localhost
(`EPERM`); attachment-canvas package-boundary setup fails; and app tests include
a Blob-content mismatch and unrelated timeouts. The affected run also hit worker
startup/time-limit failures. No unrelated application, backend or fixture code
was changed to suppress these failures. Full-test evidence:
`tmp/agent-logs/2026-09-30T12-39-47-326Z-test-full.log`.

Review verdict: scene implementation and its relevant tests/build are complete;
whole-repository verification has the above outstanding failures. This is not a
claim that the complete repository test suite passes.

## Browser evidence

Scripted local Chromium inspection used the existing Storybook, not an application
mock. Screenshots covered 360/900/1280/1920 CSS-pixel widths in LTR and RTL, plus
reduced motion, a missing composer and a dark surface. Mobile stories used the
composer-only host. All eight width/direction combinations selected the actual
composer, had no horizontal overflow and no page errors. Typing removed the scene,
left zero scene animations and preserved the new draft.

Actual-screen SVG transforms at 8.5, 8.8, 9, 9.3 and 12 seconds put the caught cap
within 0.54 CSS pixels of the knot and its supporting mitten within 0.25 pixels.
The reference key poses coincide exactly in the pure geometry tests. Screenshots
at 4.4, 8.5 and 14.8 seconds were inspected for corner contact, the caught-hat gag
and the final worn bow. Static art and the independent parcel fallback were also
inspected. The same SVG remains legible on light and dark backgrounds.

Final structural counts: 2 elves; 0 snapshots/particles; 143 SVG descendant nodes
total; 58 descendants per elf (59 including its root); 27/29 paths and 120/125 path
commands; 2 gradients per elf; no masks/filters. There are 24 animations and 365
keyframes on either layout, below the respective 32/24 and 640/480 budgets.
Mobile reduces size, travel and secondary gesture amplitudes while retaining both
characters and every story beat.

Browser files are stored outside source in `/private/tmp/gift-wrapping/`:
`browser-check.json`, width/direction screenshots, `reduced.png`, `fallback.png`,
`dark.png`, full-speed recordings under `video/`, and Chromium traces.
Capture scripts: `/private/tmp/gift-browser-check.mjs` and
`/private/tmp/gift-profile.mjs`. Screenshots use `caret: initial`: Playwright's
default caret hiding changes the live textarea style and correctly cancels the
scene as a source mutation.

## Playback profile

Normal-speed headless Chromium playback was recorded for the full scene at
1280×900 with native CPU and 360×800 with CDP CPU throttling ×4. At both sizes:
no long tasks; zero host `getBoundingClientRect` calls after preparation; no
remaining scene/animations after the deadline; the draft remained unchanged.

Final measured frame interval p95 was 9.2 ms at both sizes; maximum intervals
were 9.6/9.5 ms with none above 33.4 ms. Desktop trace totals were approximately
52 ms layout, 169 ms style and 180 ms paint; mobile ×4 totals were 206 ms layout,
669 ms style and 542 ms paint over the entire scene. SVG animation does trigger
browser layout/paint work; this is not a GPU-only rendering claim. These are local
headless/emulation measurements, not physical-phone FPS guarantees. The final
profile and complete browser traces are in the artifact directory above.
