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

The browser harness hides the fixture's history below 1280 pixels and preserves
native `matchMedia` so media changes reach real listeners. Stock Storybook controls
do not model those conditions: its history remains open on mobile and its
`matchMedia` replacement has no-op listeners. This existing fixture limitation is
outside this fix. Screenshots use `caret: 'initial'` to avoid Playwright mutating
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
