# Halloween interruption verification

## Scope and reproduced failures

The initial audit exercised all 16 registered Halloween scenes on Chromium at
360×800, 900×800, 1280×1000 and 1920×1000, with an additional 640×360 lifecycle
check and mobile/desktop RTL and reduced-motion checks. It found two defects:

- Portal kept two original history rows hidden after typing into a composer that
  was already focused before playback.
- Portal, Train and Web kept stale anchor coordinates after source/ancestor CSS
  changes without a window resize; Web also missed composer resizing.

The regression tests reproduced the Portal defects before implementation (six
failures). The fix changes cancellation and cleanup only. Scene selection, story
beats, keyframes, durations, artwork, notifications and mobile budgets are preserved.

## Browser verification after the fix

24 automated Storybook cases: Portal, Train and Web × 360, 900, 1280 and 1920 CSS
pixels × LTR/RTL, at 800 pixels high. Each case checked normal playback, source
translation by 90 pixels without window resize, replay and a live reduced-motion
media change. Portal additionally received real keyboard input in a pre-focused
composer. Selected mobile and desktop screenshots were inspected.

- Original elements were restored after cancellation; no borrowed WAAPI tracks
  remained. Web released its canvas surfaces on anchor changes.
- Normal playback retained four Portal row tracks with visible desktop history,
  no borrowed rows with closed mobile history, and three Train tracks.
- No JavaScript errors or horizontal document overflow occurred.
- After setup, each 1.4-second uninterrupted sample recorded zero geometry reads
  from the new observer and zero long tasks over 50 ms. This is a narrow regression
  sample, not an FPS or memory benchmark.
- Target-size notifications, ancestor mutations, removal, content replacement,
  unrelated toast removal, normal completion and idempotent disposal are also
  covered by unit/integration tests.

The initial browser harness hid the fixture's history below 1280 pixels and preserved
native `matchMedia` so media changes reached real listeners. The mobile follow-up
below fixes the fixture's history visibility. Stock Storybook's
`matchMedia` replacement still has no-op listeners, so live media changes require
the initial harness. Screenshots use `caret: 'initial'` to avoid Playwright mutating
the source textarea style and triggering cancellation itself.

Local audit artifacts: `/tmp/halloween-audit`; fix matrix, profiles and screenshots:
`/tmp/halloween-fix/browser.json` and `/tmp/halloween-fix/*.png`. These files are
local QA evidence, not required package assets.

Physical iOS/Android devices, Safari, real mobile keyboard/browser chrome and an
authenticated host-app session were not exercised. No claim is made about every
possible compositor-only position animation; cancellation covers relevant
target/ancestor mutations, structural changes and selected-target resizing.

## Automated checks

Commands use the isolated worktree as `NX_WORKSPACE_ROOT_PATH`, with
`NX_DAEMON=false NX_ISOLATE_PLUGINS=false`. Its dependency directory preserves
normal workspace-relative package links. Initial checks that accidentally resolved
the primary checkout or ran zero affected tasks are excluded from this evidence.

- `nx run-many -t lint,test,build -p @epam/ai-dial-celebrations`: passed;
  all 61 test files / 980 tests passed. Library typecheck also passed.
- `nx sync:check`: passed after preparing the worktree dependencies.
- `npm run validate:docs`, `npm run validate:agent-docs` and
  `openspec validate fix-halloween-scene-interruptions --strict`: passed.
- `npm run verify:changed`: affected typecheck passed; lint stopped at the existing
  `import/order` error in `apps/chat/src/components/CatalogView/CatalogView.tsx:18`.
  That file is identical to `origin/development`.
- `npm run test:changed`, run separately because lint stopped the chained command:
  celebrations passed; chat had 2632 passing tests, one skipped and one failure in
  `useSkillFileSystemPicker.spec.ts:75` (`[object Blob]` instead of `# Notes`). The
  same failing test was reproduced through Nx in the untouched primary checkout.
- `npm run verify:full` was invoked once. Its full typecheck reached the external
  scheduled-tasks consumer fixture, where npm registry resolution repeatedly
  failed with `ENOTFOUND` inside the sandbox. That npm process was stopped and the
  full typecheck stage was resumed separately with network access and passed
  for all 34 projects (54 tasks including dependencies). The chained
  full lint/format/test stages were not reached; affected checks above establish
  the relevant baseline failures.

## Quality review

- Correctness: pre-focused keyboard/IME input preserves draft, focus and selection;
  target changes cancel existing effects; cleanup is idempotent. Unrelated toast
  removal and scene-owned mutations keep normal playback running.
- Readability: one internal observer owns the common invalidation rule; each scene
  retains its existing stop callback and cleanup responsibilities.
- Architecture: library isolation checked explicitly. Only existing caller-supplied
  anchors and DOM elements cross the boundary; no app imports, external contracts,
  new public API, dependencies, persistence or telemetry.
- Security: no new HTML-copying path, network access or interactive cloned controls.
- Performance: at most one MutationObserver and ResizeObserver per affected scene,
  observing at most 12 selected targets; no new animation tracks or frame polling.
- Responsive parity: all four widths in both directions; mobile history absence,
  normal playback and reduced motion preserve their existing behavior.
- Documentation: README describes the new cancellation behavior and event-driven
  geometry checks. No structural architecture or public API change needs new docs.

No blocking code-review findings remain; cross-browser/device coverage is limited
to the environment stated above.

## Mobile playback follow-up — 2026-09-29

The user reported that the input-pushing mummy was entirely absent on mobile.
Normal touch and secret-phrase activation worked in Chromium and WebKit, including
with the real frontend and composer (API responses mocked locally). A controlled
360×800 → 360×600 resize 40 ms after submission reproduced the missing mummy:
all three WAAPI tracks were cancelled and the actor was hidden before its entrance.
This establishes an activation-time viewport defect, not the exact cause on the
user's unidentified physical device. Bowling independently remained static with
closed mobile history.

Mobile Mummy now prepares after a 120 ms quiet viewport interval, capped at 600 ms,
and still cancels pending work on user interaction. Bowling without history plays
its existing travel/spin tracks with no borrowed UI. Playback keyframes, artwork,
story beats and provider deadlines are unchanged. Storybook now hides history
below the real desktop breakpoint instead of masking this condition.

### Browser and performance evidence

- **128 cases passed:** each of Chromium and WebKit ran all 16 scenes at 360/900
  with touch and closed history (32 cases), plus Mummy/Bowling at
  360/900/1280/1920 × LTR/RTL × normal/reduced motion (32 cases). Normal changed-scene
  cases also tapped the live input and checked immediate animation/copy cleanup.
- Every normal scene had active scene-layer animation or Web's canvas; no page
  errors or horizontal document overflow. The mobile bowling fallback had exactly
  two tracks and zero snapshots. Changed scenes had no tracks/copies in reduced
  motion. Selected phone/tablet/desktop screenshots were visually inspected.
- Real-app secret-phrase reproduction passed in **Chromium and WebKit** after the
  same early resize: Mummy retained three WAAPI tracks and one inert composer copy
  at 2.5 and 7 seconds. Chromium additionally completed the provider deadline with
  no scene or copy remaining and the original composer visible with an empty draft.
- Four Chromium profiles (Mummy/Bowling × 360/1280) sampled two seconds after
  preparation: **zero geometry reads originating from either scene**; page task
  duration deltas were 6–18 ms and layout duration deltas 0.2–0.6 ms. These short,
  unthrottled desktop-host samples include the fixture/decor and are not phone FPS
  or memory benchmarks.
- The first matrix attempt passed all 64 mobile-scene cases, then stopped because
  a QA textarea selector matched both the original and inert copy. The remaining
  64 cases passed after changing the harness to the live textbox's accessible role.
  No product change was made for this harness error.

Local evidence: `/tmp/halloween-mobile-final/` (browser JSON, profiles and PNGs),
`/tmp/halloween-mobile-app-resize-fixed.log`,
`/tmp/halloween-mobile-app-resize-webkit-fixed.log` and
`/tmp/halloween-mobile-app-completion.log`. Physical iOS/Android, real software
keyboard transitions and an authenticated backend session remain untested.

### Regression checks and review

- New expectations failed before implementation (26 failures); the focused suite
  then passed all 46 tests. Full celebrations suite: **61 files / 1006 tests**.
- Celebrations lint, typecheck and build passed; docs and both strict change
  validations passed. Affected typecheck passed. Affected lint still reports only
  the previously established `CatalogView.tsx:18` baseline error; separately run
  affected tests still have the same chat Blob-content failure, 2632 passing and
  one skipped. The first-pass full-verification limitations above still apply.
- Correctness: bounded preparation, all input/IME/focus/scroll cancellation paths,
  missing history, natural completion, unmount and reduced-motion disposal are
  covered. Desktop collisions and Mummy keyframes are untouched.
- Readability/architecture: two small private lifecycle helpers remain owned by
  the corresponding scenes; host integration stays in existing anchors/isMobile.
  No app imports, public contract, dependency or localization changes.
- Security: no new snapshot path or interactive clone; no network/persistence.
- Performance: preparation owns at most two timers, removes listeners before
  playback and never polls geometry; standalone Bowling owns two tracks and one
  timer with idempotent cleanup. No blocking self-review findings.

### Archive verification

OpenSpec 1.3.1 native archive completed with validation and spec synchronization
enabled. Both complete changes were moved with their `.openspec.yaml` metadata.
All six delta requirements match the main Halloween spec, every unrelated
requirement was preserved, and `openspec validate --specs` passed all 352 specs.
