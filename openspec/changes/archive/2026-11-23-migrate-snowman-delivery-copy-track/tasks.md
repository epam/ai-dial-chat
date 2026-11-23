# Tasks

**Slicing strategy: risk-first, then vertical.**

1. Group 1 records the Themes retention date, which is the only calendar dependency.
2. Groups 2–3 prove the riskiest part, the generic grammar on the real host, through a spike and a gate before anything is enabled.
3. On go, groups 4–6 widen one vertical path at a time:
   - the library capability
   - the full asset and its evidence
   - Themes publication
4. Group 8 applies only on no-go.
5. Group 9 holds the integration checks.

The compiled SnowmanDelivery and `interaction-cat-borrow-v1` behaviour must stay unchanged throughout. Their suites run in every slice that touches shared modules.

**Architecture guard (every `libs/celebrations` task).** The lib gains no `/api` path, generated-client or `server-api` import, app context, env or feature-flag read, routing, telemetry, storage key or URL construction. The adapter reads only `CelebrationAnchors` class names and the supplied direction. Check with `git diff -- libs/celebrations | grep -nE "/api|chat-api-client|server-api|process\.env|localStorage|fetch\("`, which must print nothing new.

**Verification.** Run single test files with `npm run test:file -- <path>`. Run `npm run verify:changed` once per completed group, and `npm run verify:full` once, in group 9.

## 1. Themes: retention date (design D13)

- [x] 1.1 Record when `new-year-default@1.0.0` becomes deletable, under the reading the issue owner approved on 2026-11-22: 30 days after the last index revision whose `defaults` named it. No Themes pull request is opened now, because the checker requires every version directory to stay listed until it is deleted.
  - Verification: tracing `defaults.new-year` across every `static/celebrations/index.json` revision on `origin/development` shows it last named `1.0.0` before `aafdbd2` (2026-11-18), and D13 states the date 2026-12-18

## 2. Generic modules for a second consumer (design D6–D9)

- [x] 2.1 Extend `libs/celebrations/src/utils/lottie-anchor-binding.ts` with multiple `ct-track:*` layers, the stretch rule and `ct-follow:*` translation (D6). Keep the existing single-null call for the Cat as a thin wrapper.
  - Add cases to `libs/celebrations/src/utils/tests/lottie-anchor-binding.spec.ts`:
    - a stretched key keeps its proportion between two anchors
    - follow moves a group rigidly
    - an unbound key throws
    - times, easing and count are unchanged
    - σ mirroring applies to stretch
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/lottie-anchor-binding.spec.ts`, plus the cat-borrow adapter spec unchanged and green
- [x] 2.2 Extend `libs/celebrations/src/utils/lottie-time-remap.ts` with splice pairs, where each fill replaces its equal-length cut, and treadmill cycle repetition inside a composition window, where `k = max(1, round(D / stride))` is capped at 24 (D5, D8). Add cases to `libs/celebrations/src/utils/tests/lottie-time-remap.spec.ts`:
  - beats after a splice keep their composition time
  - an unequal splice is rejected
  - k cycles fill a window exactly
  - the inverse mapping is monotone
  - the existing section and elastic cases still pass
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/lottie-time-remap.spec.ts`
- [x] 2.3 Add a 2-D, restore-ended mode to `libs/celebrations/src/utils/lottie-track-keyframes.ts`: x, y, rotation and opacity, ending at `ct:restore` with no physics, emitting each key once per remap piece that shows it (D9). Add an optional linear wrapper track (the `ct-travel` translation) to `libs/celebrations/src/utils/celebration-snapshots.ts`, covered in `celebration-snapshots.spec.ts`. Keep the release mode for the Cat. Add cases to `libs/celebrations/src/utils/tests/lottie-track-keyframes.spec.ts`:
  - y is carried
  - holds become `steps(1, end)`
  - Bézier easing becomes `cubic-bezier`
  - offsets are monotone
  - the release mode is unchanged
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/lottie-track-keyframes.spec.ts`
- [x] 2.4 Move the text-run measurement and copy out of `libs/celebrations/src/new-year/utils/reindeer-text.ts` into a shared internal module `libs/celebrations/src/utils/text-run-copy.ts`, exposed as a prepare, attach, start and stop session. `reindeer-text.ts` delegates to it with no behaviour change.
  - Move the existing tests with the code, and add a session test: the textarea's value, selection, focus and attributes are untouched, and stop removes the span and the cover.
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/text-run-copy.spec.ts`, then ReindeerTakeoff's suites under `libs/celebrations/src/new-year/` (`reindeer-*.spec.ts` and `NewYearReindeerTakeoff.spec.tsx`) unchanged and green
- [x] 2.5 Add the copy-track vocabulary and types:
  - `libs/celebrations/src/constants/copy-track.ts`: the `ct:` markers, section kinds, anchors, contact kinds, eligibility constants and the width band (0.75–1.5 since 2026-11-23)
  - `libs/celebrations/src/types/copy-track.ts`: string enums for slots, kinds and roles
  - `libs/celebrations/src/models/copy-track.ts`: interfaces with JSDoc
  - Add a marker-grammar test: a valid asset parses; an unknown kind or role is rejected; an orphan fill is rejected; the order is enforced.
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/copy-track-markers.spec.ts`, then `npm run verify:changed`

## 3. Spike and gate (design D10, D11)

- [x] 3.1 Implement the stage templates and the span solver in `libs/celebrations/src/utils/copy-track-stages.ts` (D4, D7). Add `libs/celebrations/src/utils/tests/copy-track-stages.spec.ts`, porting the geometry cases from `snowman-delivery-targets.spec.ts`:
  - ledge, RTL ledge, rim and rim with no copy
  - platform with crowded cards
  - no fit leads to no qualifying stage
  - card eligibility (disabled, focused, transformed, aria-hidden, snapshot, 40 nodes, size, clipping, scan limit, width band)
  - span bounds at 360, 900, 1280 and 1920 px
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/copy-track-stages.spec.ts`
- [x] 3.2 Implement the spike adapter in `libs/celebrations/src/utils/copy-track-adapter.ts`:
  - validate the asset
  - choose the section
  - splice the remap
  - bind, stretch and follow
  - repeat the cycles
  - set `ct-if:` opacity
  - prepare the copy through `prepareCelebrationSnapshots` or the text-run session
  - attach it on `onAnimationCreated`, start it on `timelineZeroMs`, observe the targets, and cancel on an early stop

  Run it through a story-only capability context in `LottieScene`. `SUPPORTED_CELEBRATION_CAPABILITIES` stays unchanged.

  Add `libs/celebrations/src/utils/tests/copy-track-adapter.spec.ts`:
  - malformed slots and markers fail before playback
  - the first qualifying section wins
  - the copy starts on `timelineZeroMs`
  - every termination restores once
  - typing during a word copy cancels it
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/copy-track-adapter.spec.ts`
- [x] 3.3 Bootstrap the spike asset with a throwaway scratchpad script, as D11 describes, for the D10 ranges: the trunk up to the lodge, the `rim` pickup fill and one return cycle. Also build a minimal `rim-word` probe asset. Do not commit the script.
  - Commit the outputs as fixtures: `libs/celebrations/src/stories/fixtures/copy-track-snowman-spike.lottie.json` and `copy-track-word-probe.lottie.json`.
  - Add a unit test asserting their `sha256`, and that they parse under the copy-track grammar.
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/copy-track-fixtures.spec.ts`
- [x] 3.4 Add `libs/celebrations/src/utils/tests/copy-track-gate.spec.ts`. It prepares the spike fixture through `prepareCopyTrackScene` against synthetic hosts at 1024/1280/1440/1920 px, LTR and RTL, for the `ledge-card` and `platform` sections, evaluates the prepared properties at the marker frames, and asserts every data row of D10: binding exactness, head flight, planted feet, card return and the word probe. No browser and no story (issue owner, 2026-11-22).
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/copy-track-gate.spec.ts` passes, or the failing rows are what 3.6 records
- [x] 3.5 Count the code row with the batch 0 counting script: the new adapter plus the new or changed generic non-empty lines, against 3,123. Project the full-asset size, layers, keyframes and vertices per variant.
  - Verification: both figures are recorded with their revision in the "Gate result" draft
- [x] 3.6 Record the gate under "Gate result" in `design.md`: every D10 row with its measurement, the rows dropped with the browser run, and go or no-go.
  - Draft the #9226 gate comment, and post it only after the user approves it.
  - On go, add a `celebration-migration-portfolio` delta to this change. The "New Year decisions" scenario for ReindeerTakeoff records that its reopen condition is met.
  - Verification: `openspec validate migrate-snowman-delivery-copy-track --strict` passes, and the decision line names go or no-go

## 3a. Gate amendments (go with amendments, 2026-11-22)

- [x] 3a.1 Add a `celebration-pack-contracts` delta to this change that raises the Lottie layer cap to the measured structure plus headroom, and update `MAX_LAYERS` in `/Users/Valery_Dluski/projects/dial/ai-dial-chat-themes/scripts/check-celebration-packs.mjs` in the task 6.1 pull request.
  - Verification: `openspec validate migrate-snowman-delivery-copy-track --strict` passes, and the themes checker test covers a scene at the new cap
- [x] 3a.2 Change the throwaway bootstrap to encode fills by splitting the boundary Bézier segments exactly, and to key only the properties that differ from the trunk.
  - Verification: one fill costs at most a third of the 1,568 keyframes measured at the gate, and the gate spec still passes on the regenerated fixture
- [x] 3a.3 Match the reference card to the production starter size measured on the `ConversationInput` host, and add a height band to `COPY_TRACK_STARTER_CARD` in `libs/celebrations/src/constants/copy-track.ts`.
  - Verification: `copy-track-stages.spec.ts` covers the height band, and the gate spec's contact pairs pass with real-size cards

## 4. Library capability (on go; design D12)

- [x] 4.1 Refactor `PackScenePreparation.borrow` into an adapter-owned `companion` payload, and add the supplied direction to `PackSceneAdapterEnvironment` (from `LottieScene`'s `context.direction`). Update `cat-borrow-adapter.ts` mechanically.
  - Verification: `npm run test:file -- libs/celebrations/src/components/LottieScene/tests/LottieScene.spec.tsx`, plus the cat-borrow adapter and pack-scene specs unchanged and green
- [x] 4.2 Replace the spike branch with a `resolvePackSceneAdapter` copy-track branch, and remove the story-only context.
  - Add `CelebrationCapability.InteractionCopyTrackV1` to `libs/celebrations/src/types/celebration-pack.ts` and to `SUPPORTED_CELEBRATION_CAPABILITIES`.
  - Extend `isCelebrationSceneSupported`: anchored only, `direction: none`, at most one `interaction-*`, and the Web Animations requirement.
  - Add cases to `libs/celebrations/src/utils/tests/celebration-pack-scene.spec.ts` and `LottieScene.spec.tsx`:
    - supported
    - viewport is unsupported
    - two adapters are unsupported
    - a missing `animate` shows the poster
    - the copy starts on the Lottie clock
    - a starter anchor change ends the scene
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/celebration-pack-scene.spec.ts`
- [x] 4.3 Document the capability:
  - `libs/celebrations/README.md`: the supported set, a "Copy-track scenes" section with slots, markers, stages, roles and limits, and the enum member
  - `docs/architecture.md`: the celebrations pack adapters
  - Verification: `npm run validate:docs` passes, and `npm run verify:changed`

## 5. Full SnowmanDelivery asset and evidence (on go; design D11, portfolio evidence protocol)

- [x] 5.1 Extend the throwaway bootstrap to the full scene: trunk, fills for `rim-card`, `rim` and `platform`, and every cycle window, for the desktop and mobile variants. Export the poster from `SnowmanDeliveryStill` as SVG. Run the copy-track grammar and the profile subset check on the outputs.
  - Verification: both variants parse, pass the caps (≤ 512 KiB, ≤ 48 layers, ≤ 4,000 keyframes, ≤ 8,000 vertices, poster ≤ 100 KiB), and the pose checks at every boundary pass
- [x] 5.2 Commit the variants and the poster as fixtures under `libs/celebrations/src/stories/fixtures/`, with a `sha256` test, and add them to `.prettierignore`.
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/copy-track-fixtures.spec.ts`
- [x] 5.3 Extend `libs/celebrations/src/utils/tests/copy-track-gate.spec.ts` to the full asset, on data and without a browser (issue owner, 2026-11-22):
  - the desktop and mobile variants, at 1024–1920 and 360–900 px, in LTR and RTL
  - every section: `ledge-card`, `rim-card`, `rim`, `platform`
  - reduced motion (poster only, no load) and missing composer and starters, through `LottieScene.spec.tsx`
  - stage choice parity with `getSnowmanDeliveryTargets` for the same host geometry
  - amendments the parity and mobile cells required (issue owner, 2026-11-23; design D5–D8, deltas V2, V3, V8, V9):
    - section overrides `<base>#<kinds>` for the stretchable references, a follow group's position and the travel; the drawn-sled sections authored at the rig's sled size in one shared story fill
    - the `rim-card` slot return fill
    - the stride scale in repeated cycles
    - mobile card sections from 140 px
  - Verification: `npm run test:file -- libs/celebrations/src/utils/tests/copy-track-gate.spec.ts`, plus the compiled scene's suites under `libs/celebrations/src/new-year/` unchanged and green
- [x] 5.4 Write `openspec/changes/migrate-snowman-delivery-copy-track/evidence/full-scene.md` with the data-level results, and the structural check of both variants. State that no browser run was made, and list the browser evidence S8 must produce: browser checks, frames, profiles, retention, preparation p95, long-task recovery, normal-speed review and the pinned-player review.
  - Verification: the file exists and cites its revisions

## 6. Themes publication (on go, from the date in 1.1; design D13)

- [x] 6.1 Extend `scripts/check-celebration-packs.mjs`:
  - add `interaction-copy-track-v1` to `CAPABILITIES`
  - change the combination rules to at most one `interaction-*`, with anchored placement and `direction: none` for copy-track
  - add `checkCopyTrack`: slots, grammar, splice pairing, bind coverage, references and section overrides, cycle closure, pose match, caps
  - add cases to `scripts/check-celebration-packs.test.mjs`, and a "Copy-track scenes" section in `README.md`
  - Verification: `node --test scripts/check-celebration-packs.test.mjs` passes, including cases with a malformed fixture for each rule
- [ ] 6.2 From 2026-12-18 (task 1.1), or earlier after an exception the Themes owner approves explicitly, delete `new-year-default/1.0.0` and its index entry in their own pull request. Then, in the next pull request, publish `new-year-default@1.2.0`: the existing scenes plus `snowman-delivery` with its variants, poster and placement (scale 0.9 / 0.68, `direction: none`, 25,000 / 27,500 ms). Point `defaults.new-year` at 1.2.0 and bump the revision.
  - Show the diff and the pull-request text to the user, and push only after approval.
  - Verification: `node scripts/check-celebration-packs.mjs` passes, and the published hashes equal the fixture hashes from 5.2

## 7. Deployed evidence, rollback and accounting (on go)

- [ ] 7.1 In a test environment, set `UI_EVENT=new-year`, `UI_EVENT_DELIVERY_MODE=prefer-external` and `UI_EVENT_EXTERNAL_SCENES=new-year/gift-wrapping,new-year/snowman-delivery`. Capture normal-speed recordings of the `ledge` and `rim` sections.
  - Remove `new-year/snowman-delivery` from the allowlist and bump `UI_EVENT_DELIVERY_REVISION` during playback. The card must be restored, the next gift click must play the compiled scene, and GiftWrapping must stay external.
  - Verification: `evidence/deployed.md` records the environment, revisions and outcomes
- [ ] 7.2 Run the batch 0 counting script at the merge revision. Record SnowmanDelivery's scene-specific lines, the copy-track adapter, the generic changes, and the asset raw, gzip and Brotli sizes. Draft the #9226 comment with Chat and Themes revisions, and post it only after the user approves it.
  - Verification: the comment is approved, and every figure carries its revision

## 8. No-go cleanup (only if 3.6 records no-go)

- [x] 8.1 Not applicable: the gate decided go (2026-11-22), so no cleanup ran. Delete the spike adapter, the story-only context, the spike fixtures, the stories and `copy-track-spike.browser.spec.mjs`. Keep generic changes from group 2 only where an existing caller uses them; otherwise revert them. Record the measurements and failing rows on #9226 (after approval), and add a `celebration-migration-portfolio` delta returning `snowman-delivery` to `retain` with reason `adapter-pending`.
  - Verification: `git grep -n copy-track -- libs` lists only the code that was kept on purpose, and the cat-borrow and compiled snowman suites are green

## 9. Integration checks

- [x] 9.1 Run `npm run spec:impact` and confirm that only this change's capabilities are reported for the files it touched. Then run `npm run validate:specs` and `openspec validate migrate-snowman-delivery-copy-track --strict`.
  - Verification: all three pass, or every report is explained in the PR description
- [x] 9.2 Run `npm run build:quiet` and compare the `@epam/chat` entry and the `new-year` and `packs` chunk sizes with `f416f8c69`.
  - Verification: the entry and the `new-year` chunk are unchanged within 1 %, and the `packs` growth is recorded in the PR description
- [x] 9.3 Run `npm run verify:full` once.
  - Verification: it passes, or unrelated local failures are recorded with their output

## Workflow follow-up

- Archive with `/opsx:archive` after review. That merges `celebration-copy-track` and the modified specs.
- Production rollout of the external SnowmanDelivery and the authoring-tool review are S8 (#9227).
- The compiled SnowmanDelivery is removed only under "Compiled duplicates are removed only after the gate".
- ReindeerTakeoff's migration is a later batch, on the released `composer-word` role.
