# Snow Circus verification

## Delivered locally

- Chat: additive `interaction-button-props-v1` registration, bounded preparation, reversible copies, Storybook preview, unit/fixture/browser suites and documentation.
- Themes: native source under `authoring/snow-circus`, `new-year-snow-circus@1.0.0`, publication grammar/tests and a catalog entry. Existing defaults and old versions remain byte-for-byte unchanged. The new pack retains the three scenes from `new-year-default@1.2.0` because the app selects one pack per event.
- No commit, push, remote upload, deployment or archive was performed. The local capability and local catalog entry do not establish released-client or deployment support.

Preview: `http://localhost:6009/?path=/story/new-year-snow-circus--desktop` (local Storybook process). Other stories: `mobile`, `rtl`, `missing-targets`. Source identity is pinned in the fixture tests and Themes `source-inventory.json`.

## Structural and behavior evidence

- Each animation: 109,303 bytes, 30 native layers, 951 keys, 77 shape paths/primitives, 50 explicit path vertices. Poster: 1,882 bytes. One player; maximum observed generated SVG node count 220. All tighter scene budgets pass.
- Focused adapter and source-fixture tests: 13 passed. Existing `celebration-pack-scene.spec.ts` also passed. Coverage includes invalid tracks/transforms/return points, shared clock, original restoration, unchanged cache/draft and zero/one/two copies.
- Themes publication checker: valid, zero warnings. Full publication regression suite: 295 passed, including eight new button-props cases. Source identity checker passes against the actual neighboring Themes checkout.
- Production-player browser suite: three tests passed. Matrix: 360 and 900 px mobile, 1280 px RTL, 1920 px desktop, missing targets and reduced motion. One/two/zero copies as expected. Input cancellation preserves the draft; five pickup/replay cancellations by input or target mutation leave zero snapshots, SVG players and animations. Full mobile completion restores original opacity.
- `npm run verify:changed`: typecheck, lint and affected tests passed. `npm run build:quiet`: passed (108 s).
- `npm run validate:docs`: passed. `npm run validate:specs`: zero errors (204 existing advisory warnings). `openspec validate add-new-year-snow-circus --strict`: passed.
- Theming and i18n diff scanners: no candidates. Decorative artwork uses the library's explicit theming exception; the new toast is pack-owned in English/Russian. Story controls are test-only. No new host API, route, storage, analytics or translation dependency enters the library.

## Rendered artwork and performance

Inspected actual-size browser frames of pickup (1.8/2.5 s), juggling (6 s), cap impact (10.8 s), belly reaction (14 s), avalanche (19.9 s), moustache (20.8 s) and restoration/departure (24.6 s). Inspected the corresponding mobile frames, desktop RTL pickup and mobile static poster. The first representative pass exposed reversed shape ordering and null-opacity inheritance; both were corrected in native art. The near flipper was aligned to pickup/return prop positions. Juggling arcs were corrected to alternate continuously rather than reset horizontally. Final exit keys were extended and drawable-layer opacity now reaches zero before the deadline, avoiding an abrupt disappearance on wide screens.

Artifacts: `tmp/snow-circus/frame-*.png`, `tmp/snow-circus/video/`, and `tmp/snow-circus/browser/`. Video was recorded at normal playback speed. It was not watched continuously through a video-viewing tool: full-scene artistic/motion acceptance remains open. Frame inspection establishes poses, contact appearance and staging only; it is not a claim that the user will prefer the drawing or timing.

Headless Chromium, 26-second playback, screenshots included, no CPU throttling:

| Measurement | Desktop 1280 px | Mobile viewport 360 px |
| --- | --- | --- |
| Frame interval p50 | 16.7 ms | 16.7 ms |
| Frame interval p95 | 16.7 ms | 16.8 ms |
| Frame interval p99 | 16.8 ms | 16.8 ms |
| Tasks over 50 ms | 0 | 0 |

Mobile CDP cumulative durations during final playback: layout 0.074 s, style recalculation 0.300 s, script 0.366 s, task time 1.648 s. The desktop profile predates the final exit adjustment; the full browser suite and mobile profile were repeated after that adjustment. These are desktop-browser measurements with a mobile viewport, not physical-device guarantees. There are no per-frame host measurements or React updates in the adapter. Setup and rendering remain separate from source byte/shape budgets.

## Final verification

`npm run verify:full` passed the full TypeScript check (100.3 s) and full lint (74 tasks, 88.2 s), then stopped at the repository-wide formatting step. Seven existing, Git-ignored files under `celebrations-prompts/` fail Prettier: README.md and the README files in 9224-s5-themes, 9225-s6-overlay, 9226-s7-scenes, 9227-s8-rollout, 9960-defects and 9969-event-window. These files were not changed by this task. Formatting of the changed source/docs passes; native byte-pinned fixtures have explicit Prettier exclusions matching the existing fixture policy. The skipped full test phase was launched separately with `npm run test:full:quiet`. The sandboxed attempt stalled in backend workers and was terminated; a retry with local socket access completed in 301.3 s: 88 tasks, 83 succeeded, four failed and one skipped. No second full verification run was performed. Logs are under `tmp/agent-logs`, `/tmp/snow-circus-verify-full.log` and `/tmp/snow-circus-test-full-retry.log`.

Failures outside the changed scene files:

- `reusable-workflows-consumer-fixture:verify`: packaged quotations calls React `require` in an environment without `require`.
- `@epam/ai-dial-conversation-input:test`: one keyboard-open assertion in `AddAttachmentButton.prompts.spec.tsx` cannot find the prompts overlay.
- `@epam/ai-dial-attachment-canvas:test`: three package/entry size budget assertions fail (73,670 raw bytes versus 66,500; 19,540 gzip versus 19,500; 272,115 unpacked versus 258,000).
- `@epam/chat-api:test`: 211 failed tests across eight files; reported failures include `pairs.map is not a function` in managed-runtime settings.

Those modules were not edited. A separate pristine-baseline run was not performed, so this report records their scope rather than claiming baseline reproduction. The full repository gate remains failing; scene-scoped checks, the production build and browser suite pass.

Self-review covered correctness and cancellation, grammar validation, library isolation, bounded snapshots/rendering, mobile/RTL parity and documentation accuracy. No additional scene-scoped blocking finding remains. Full-scene artistic acceptance and the repository-wide failures above remain explicit limitations.

## Requested character redraw — local pack 1.0.1

The user rejected the original artwork after seeing it in Chat and asked for the SnowmanDelivery / polar-bear style. Compared the existing SnowmanDelivery render and polar-bear working pose at display size. The new native shapes use thin dark contours, broad cool blue crescent shadows and compact faces. Snowman now has three white balls, a burgundy scarf, twig arms and blue mittens; penguin has a connected pear silhouette, coherent white bib/face, softer flippers and a muted burgundy cap. The poster uses the same contours. Story, button contact endpoints, contact keys and final exit remain intact.

The maintained sources and new immutable `new-year-snow-circus@1.0.1` were applied in the neighboring Themes checkout. Version 1.0.0 and production catalog defaults were retained. A local-only catalog overlay selects 1.0.1 for the running app at `http://localhost:4207/`; normal gift click targets this scene. App-origin catalog, manifest and animation all returned HTTP 200, with catalog revision `local-snow-circus-art-v2` and 125,222 animation bytes. The user's environment files and authentication were preserved.

Current source budget: 125,222 bytes per variant, 30 layers, 951 keys, 98 paths/primitives and 205 explicit vertices; poster 11,359 bytes. Observed SVG nodes: 244 desktop / 252 mobile. All remain within the existing budgets. Animation SHA-256: `84c13465f13ebdaaf520f29ef3cb7ea9ce85e0a07f758588386eb92e4042a306`; poster: `86907b46bbdbd1e1d2885b5c36c0d1c1f941be9d00f70b9f9479fcb4e6df621b`.

Inspected desktop/mobile pickup (2.5 s), juggling (6 s), belly reaction (14 s), heap/moustache (20.8 s), plus a corrected dark-background capture at 14 s. Evidence is in `tmp/snow-circus/art-v2/`. An early dark capture was invalidated by an asset HMR restart; it was repeated after sources stabilized. These are pose/appearance observations, not continuous-motion artistic acceptance. Focused adapter and fixture tests passed, as did Themes source identity and publication checks (zero warnings). Final browser, local-app and documentation results follow below.

Revision checks completed: the production-player browser target (Storybook build plus three browser cases) passed in 54.4 s; reduced-motion poster inspected. Mobile viewport profile: p50/p95 16.7 ms, p99 16.8 ms, zero tasks over 50 ms; layout 0.084 s, style 0.290 s, script 0.361 s, total task duration 1.663 s. Same headless Chromium conditions as the previous profile; this is not a physical-phone benchmark. Real local Chat showed both revised characters at 14 s, one eligible copied button, one player and zero remaining copies after Escape, with no page errors. The browser used synthetic identity/model responses only; catalog, manifest and art came through the real local API, and no Core data was written. Documentation validation and strict OpenSpec validation passed. Runtime behavior was not edited for this art revision, so the prior repository-wide failures were not rerun.

## Smaller cast and penguin refinement — local pack 1.0.2

The user corrected the requested style target from snowman to penguin. Both actors and their authored stage-space props/effects are uniformly reduced to 75% about (260, 300), preserving the support line and synchronizing transformed reference centers with prop tracks. Real UI copies keep their original dimensions. Penguin coat and flipper shading were simplified, its navy softened and facial details reduced. Snowman shape arrays were checked equal to 1.0.1; only the shared reduction changes its display size. Existing timing, contact weights, stage/prop identities and cleanup behavior remain unchanged.

Maintained source and immutable version 1.0.2 are present in Themes; earlier versions and production defaults are retained. The running local app's catalog, manifest and animation returned HTTP 200 with revision `local-snow-circus-art-v3`, selected version 1.0.2 and 123,389 animation bytes. Preview still uses the gift on `http://localhost:4207/`.

Current budget: 123,389 bytes per animation; 30 layers, 951 keys, 92 paths/primitives and 190 vertices; 10,753-byte poster. Observed SVG nodes: 232 desktop and 240 mobile. Animation SHA-256: `9213b6a2bdcaba1985a243fa541ff4c28709c662554e815986e3b61b87bc15e3`; poster: `fc8fb7b6c7f0b5784557c27d5781938650a798b6b78115d4a8d59e6a53d0ece6`. All existing budgets are retained.

Inspected desktop contact (1.8 s) and reaction (14 s), plus the mobile reaction at 14 s; screenshots for pickup, juggling and restoration are in `tmp/snow-circus/art-v3/`. Focused adapter/fixture tests, Themes source identity and publication checks passed with zero warnings. Documentation and strict OpenSpec validation passed. Continuous-motion artistic acceptance remains open; this revision is supported by rendered poses and automated playback evidence, not a claim of user style approval.

Final revision checks: Storybook build and all three production-player browser cases passed (56.3 s); the complete 26-second mobile run restored the originals. Mobile viewport profile: p50 16.7 ms, p95/p99 16.8 ms, no tasks over 50 ms; layout 0.092 s, style 0.328 s, script 0.404 s and total task duration 1.861 s. These are headless desktop-browser measurements, not physical-device guarantees. Inspected the dark-background reaction and the actual local Chat frame with both smaller characters. Local Chat replay had one copied button, one player, zero copies after Escape and no page errors, using synthetic browser identity/model responses while real local API served all scene assets. No user data was written. Shared runtime code was unchanged; unrelated repository-wide failures from the original implementation were not rerun.

## Clear oversized-snowball ending — local pack 1.0.3

User feedback reopened the ending's readability. Before frames at 18.3/19.3/20.5 s showed the snowball hiding the hands/face, an abrupt disappearance and a disconnected flying mitten. The revised sequence forms the ball to the side, lifts it with both mittens visible on its lower rim, holds it above the head, winds up, releases, drops and settles into a heap. Three travelling snow clumps connect the impact to the penguin's moustache. The penguin stays back and holds its reaction. A separate head-only recovery layer emerges first; the body appears only after returning to the support line, avoiding feet sliding beneath the heap. The detached surprise mitten is removed. The smaller cast, illustration style, button-return interval and 26-second lifetime are retained.

Inspected successive desktop/mobile frames at 17.4, 18.3, 18.85, 19.25, 19.6, 19.85, 20.5 and 21.3 s in `tmp/snow-circus/motion-v4/`. These establish visible support, separation and recovery poses; they do not claim continuous-motion artistic acceptance. During iteration, fixed missing easing handles on the first newly animated scale keys and unwrapped the left arm's rotation to avoid a long spin. A dense read-only geometry check of the final carry interval found maximum grip/rim gaps of 0.88 and 0.68 stage units; both remain below one displayed pixel at the maximum scene scale. The last key refinement changed intermediate grip support only.

Current native budget: 144,980 bytes per animation; 33 layers, 1120 keys, 108 paths/primitives, 215 vertices; unchanged 10,753-byte poster. Observed SVG nodes: 270 desktop / 278 mobile. All existing caps remain unchanged. Animation SHA-256: `dd0ad55212653b88a2f9f8ddebf8dcbe9c84f30f2dfb32c7dd5e382884552f7c`.

Focused adapter/fixture tests and the production-player browser suite passed; Storybook build plus three browser cases completed in 55.2 s. The full mobile run restored controls and repeated cancellations left no copies. Profile: frame p50 16.7 ms, p95/p99 16.8 ms, zero tasks over 50 ms; layout 0.059 s, style 0.217 s, script 0.291 s, total tasks 1.289 s. These are headless desktop-browser measurements with a mobile viewport. Documentation, strict OpenSpec and Themes source/publication checks passed (zero warnings).

The running app's catalog selects 1.0.3 under revision `local-snow-circus-motion-v4`; catalog, manifest and 144,980-byte asset returned HTTP 200. To respect Themes' three-version catalog cap without discarding draft art, the never-published 1.0.0 was moved byte-for-byte to `authoring/snow-circus/preview-history/1.0.0` and removed from the served index. Versions 1.0.1–1.0.3 remain served, with production defaults unchanged. No released asset was deleted and no remote publication was performed.

Local Chat verification also passed: inspected the recovery frame at 20.5 s through the real app and real local asset API; one copied button and one player were present, Escape left zero copies, and there were no page errors. Identity/model responses were browser-only fixtures; no Core writes or user-session changes were made. Existing unrelated full-repository failures were not rerun for this authored-timeline revision.


## Standard New Year set (2026-11-25)

User requested inclusion in the ordinary set based on updated Themes development.
Fetched origin/development `e596746` (polar bears integration). The implementation
is in a separate persistent Themes worktree at Chat's `tmp/ai-dial-chat-themes-snow-circus`,
branch `feat/new-year-snow-circus`; the original neighboring working tree is intact.
The real catalog now selects `new-year-default@1.5.0`, containing the complete five
scenes from 1.4.0 plus Snow Circus. Existing descriptors, labels and asset bytes are
unchanged. The source descriptor/check now point at the standard pack. Standalone
preview versions are retained as authoring history, outside the served catalog.

There are three retained upstream versions. The checker permits only the exact
four-version set 1.2.0–1.5.0 for `new-year-default`; all other four-version sets and
any fifth version fail. This avoids deleting recently referenced immutable assets.
The exception must be removed in a separate eligible retention change.

Normal local Chat (4207), API (5000) and Themes (8090) were restarted without the
forced gift replay plugin or catalog response overlay. Process-only API policy
admits all six standard-pack scenes and preserves the user's stored environment.
An isolated Playwright browser used synthetic identity/model fixtures and a fixed
random value, while actual app routing and local API/catalog/assets stayed real.
It loaded the six-scene standard manifest, selected Snow Circus on the first gift
click and polar bears on the next, and returned one copied button with zero
leftover snapshots and zero page errors. Evidence: `tmp/snow-circus/standard/local-app.json`
and `.png`. The deterministic seed is confined to the test browser; normal clicks
remain random. Santa's secret-only routing is covered by the unit suite.

Chat descriptor/pool tests: 12 passed. Pack integrity and source budgets: passed,
zero warnings; animation bytes and profile costs are unchanged from the prior
motion revision. Documentation validation and strict OpenSpec change validation
passed. This slice changes delivery/pack composition, not artwork or motion;
previous browser profile and artistic-evidence limits still apply. No remote
publication, commit, push or deployment was performed.

Themes suite ran 299 cases: 298 passed; the new negative retention test initially
removed the same version its test helper rewrites, causing an ENOENT in test setup.
The helper now rewrites retained 1.5.0 for these cases. The focused standard-set
and retention group then passed all four cases. No validator failure remains.

## Secret phrase routing correction (2026-11-25)

The user's later instruction supersedes the earlier gift-pool decision. New Year's
`externalSceneIds` now includes both Santa and Snow Circus. The complete configured
event has five gift-click scenes and four secret-phrase scenes. Themes assets and
version remain unchanged; trigger routing belongs to Chat's event definition.
The descriptor integration test asserts both complete pools, verifies an ordinary
gift click does not notify Snow Circus, and then activates it using `happy new year`.
The focused suite (12 tests), formatting, documentation and strict change validation
passed. Local normal Vite serves the updated event; reload open tabs.

Updated isolated-browser check also passed against the real local catalog/API:
ordinary gift click loaded the bears, submitting `happy new year` loaded Snow
Circus, one player/one copy rendered, Escape left zero snapshots, no page errors.
Evidence: `tmp/snow-circus/standard/local-app.json`; deterministic random choice
and synthetic identity/model data remain confined to the test browser.

## Archive (2026-11-25)

Archived at the user's request with all 16 tasks complete. Both capability deltas
were synchronized into main specs and every requirement/scenario compared before
the move. OpenSpec validation passed all 480 main specs. Repository reference
validation reported 0 errors and 204 existing warnings. Archive preserves the
recorded runtime, visual-review and repository-wide verification limits above;
it does not imply a remote release.
