# celebration-migration-baseline Specification

## Purpose

The revision-pinned migration baseline for celebrations: counting rules, per-scene inventory, payload rules, deterministic browser scenarios, evidence locations and the regression suites that define behavior to preserve. Defined and captured by S0 (#9219).

The baseline is S0's own deliverable. It is a point-in-time measurement, so it is **published on issue #9219, not committed**: numbers committed to the repository would go stale with the next scene edit. What the repository keeps is what makes the baseline repeatable at any revision: the counting rules in this spec, the browser harness in `libs/celebrations/browser-tests/`, and a short summary in `design.md` §Baseline.

## Requirements

### Requirement: Revision-pinned baseline record

The baseline SHALL be published as comments on #9219 ("baseline comments"). They SHALL record:

- the `ai-dial-chat` implementation revision and its date
- the planning reference revision
- the `epam/ai-dial-chat-themes` revision
- the resolved `lottie-web` and Playwright versions
- the Node version
- whether `libs/celebrations`, `apps/chat/src/context`, `apps/chat-api/src/themes` and `libs/chat-overlay` had uncommitted changes

The implementation baseline SHALL be `1cfb11468` (`development`, 21 scenes, PenguinStar merged in #9217). The planning reference `62b34e244` (20 scenes) SHALL be reported separately. A number SHALL never be shown without its revision.

#### Scenario: A reader compares LOC
- **WHEN** someone cites the source size of the celebrations library
- **THEN** the figure is tied to a revision: 22,779 physical lines at `62b34e244`, or 24,785 at `1cfb11468`. The 24,785 figure is not presented as the 20-scene `62b34e244` reference, even though the earlier feature tree had the same value

### Requirement: Source inventory counting rule

Source size SHALL be counted from git objects at a named revision (`git ls-tree` / `git show`), so the working tree cannot affect the result. The rule:

- **Included:** `.ts`, `.tsx`, `.scss` and `.css` files under `libs/celebrations/src`.
- **Excluded:** paths containing `tests/`, `stories/` or `test-utils/`; files matching `*.spec.*` or `*.stories.*`; `test-setup.ts` and `vite-env.d.ts`.
- **Grouping:** by first path segment `halloween`, `new-year`, or else `shared`.
- **Output:** files, physical lines and non-empty lines per group.

JSON and SVG files SHALL be reported separately as assets, not as source. The baseline comment SHALL include the exact script used, so the count can be repeated without the repository carrying it.

#### Scenario: Re-running the count
- **WHEN** the published script runs at `62b34e244` and at `1cfb11468`
- **THEN** it reproduces the published totals: 124 files / 22,779 / 22,026 and 133 files / 24,785 / 23,996

### Requirement: Per-scene inventory

The baseline comment SHALL list one row for each of the 21 scene IDs at the implementation baseline, and SHALL mark which 20 belong to the planning reference. Each row SHALL record:

- event and ID
- story (one line)
- trigger pool (click or secret)
- `durationMs` and the scene's internal clock
- renderer technique (CSS keyframes, WAAPI, canvas, Lottie)
- host anchors read, and whether host controls are measured, copied or moved live
- reduced-motion, missing-target and unsupported-API fallback
- interrupt triggers
- `Math.random` call sites
- own production files with physical lines

Shared files and decorations SHALL be listed apart from scenes. Every cell SHALL cite `path:line` at the baseline revision, or say "unverified".

#### Scenario: PenguinStar's live-control movement
- **WHEN** the inventory row for `penguin-star` is read
- **THEN** it records that the scene applies WAAPI to a live starter or model-selector control (`libs/celebrations/src/new-year/utils/penguin-star-selector.ts`) instead of a copy, and that it is outside the S0 pilot set

### Requirement: Asset payload measurement rule

Asset payloads SHALL be reported as raw bytes, gzip bytes (Node `zlib.gzipSync`, level 9) and Brotli bytes (`zlib.brotliCompressSync`, quality 11). The measured files are:

- every git-tracked file under `libs/celebrations/src/**/assets/`
- `node_modules/lottie-web/build/player/lottie_light.min.js` and `lottie.min.js`, for reference

The report SHALL state that file compression is not Vite chunk size. It SHALL report chunk sizes separately, from `npm exec nx run @epam/ai-dial-celebrations:build` and from the `@epam/chat` build's emitted chunks for the `new-year` and `halloween` entries and the `lottie_light` chunk.

#### Scenario: GiftWrapping artwork is not a Lottie composition
- **WHEN** the payload of `gift-wrapping-elves.json` (157,360 bytes raw) is reported
- **THEN** the report says it is a rig of artwork contours (`master`, `helper`, `bow`) that `gift-wrapping-composition.ts` turns into Lottie at runtime, not an exported Lottie file

### Requirement: Deterministic browser scenarios

Browser baselines SHALL run against the static Storybook build of `@epam/ai-dial-celebrations`. Its `StoryHostPage` fixture provides every `CelebrationAnchors` hook (`libs/celebrations/src/stories/StoryHostPage.tsx:5-13`).

The runner is the committed Node test `libs/celebrations/browser-tests/celebrations-baseline.browser.spec.mjs`, using Playwright Chromium. It is exposed as Nx target `@epam/ai-dial-celebrations:test-baseline-browser`, which depends on `build-storybook`, so S1–S4 can repeat the same matrix at their own revision.

The matrix SHALL cover three scenes:

- Scenes: `sleigh` (`new-year-scenes--sleigh`), `gift-wrapping` (`new-year-scenes--gift-wrapping`), `cat` (`halloween-scenes--cat`).
- Viewports: desktop 1440 × 900 at DPR 1; mobile 390 × 844 at DPR 3 with touch; narrow mobile 360 × 780.
- Direction: `dir="ltr"` and `dir="rtl"` on `<html>`.
- Motion: `reducedMotion: 'no-preference'` and `'reduce'`.
- Missing anchors: composer removed before activation, for `gift-wrapping` and `cat`.
- Cancellation: a `pointerdown` during the load/prepare phase, and another 50 % into playback.
- Replay: 20 consecutive activate→complete and activate→cancel cycles per scene.

A cell SHALL be recorded as not applicable only with its reason. For example, `sleigh` reads no anchors, so it has no missing-anchor cell.

#### Scenario: Cancelling GiftWrapping while the player loads
- **WHEN** `pointerdown` fires after activation and before the `lottie_light` chunk resolves
- **THEN** no SVG renderer node is inserted afterwards, and the scene layer is empty when the provider deadline passes

### Requirement: Capture controls and measurements

Each scenario run SHALL record these controls:

- browser and version, OS, viewport and DPR
- network: unthrottled, plus one "Slow 4G" CDP profile run for `gift-wrapping`
- randomness control: `Math.random` replaced before page scripts with a seeded generator, with the seed recorded
- activation procedure: the story's own scene trigger, not a random click pool
- capture points: activation, renderer ready, 25 %/50 %/75 % of `durationMs`, end, and 500 ms after end

The authoritative cleanup sample is 500 ms after the end. The end sample itself falls exactly on the provider deadline, so it can observe either side of it.

Each run SHALL capture:

- transferred bytes per request
- generated DOM element count inside the scene layer at each capture point
- frame timings (p50/p95 frame duration and long tasks, from a `PerformanceObserver` and a rAF sampler)
- resources after cleanup: scene-layer children, detached `svg` nodes, remaining `document.getAnimations()`, and the JS heap after forced GC where Chromium exposes it

The run SHALL save screenshots at every capture point and a Playwright trace for each run. Results SHALL state the hardware they ran on. They are not FPS guarantees.

#### Scenario: Resource retention after replay
- **WHEN** 20 activate→cancel cycles of `cat` complete
- **THEN** the published results show the remaining scene-layer children, live animations and copied-control nodes after the last cycle, so any growth across cycles is visible

### Requirement: Evidence locations and integrity

S0 evidence SHALL be kept in these locations:

- **Measurements:** the published #9219 baseline comments.
- **Binary artefacts** (traces, frames): written by the harness to Git-ignored `tmp/celebrations-baseline/<revision>/`, together with `artefacts.sha256`. That file is written by `libs/celebrations/browser-tests/summarize-baseline.mjs`.
- **Integrity:** the comment SHALL state the artefact count and the SHA-256 of `artefacts.sha256`.

A scenario without captured evidence SHALL stay unchecked in `tasks.md`. Source inspection SHALL NOT be reported as a browser measurement.

#### Scenario: Capture could not run
- **WHEN** the browser runner cannot run in the available environment
- **THEN** the comment states why, and the task stays pending, with no estimated values filled in

### Requirement: Regression suites define the behavior to preserve

The following existing suites SHALL pass at the baseline revision, and their per-file counts SHALL be published with the baseline. They are run with `npm run test:file -- <paths>`, which uses Nx projects `@epam/ai-dial-celebrations` and `@epam/chat`, target `test`:

- `libs/celebrations/src/context/tests/CelebrationRuntime.spec.tsx`
- `libs/celebrations/src/context/tests/CelebrationSelection.spec.tsx`
- `libs/celebrations/src/new-year/components/NewYearGiftWrapping/tests/NewYearGiftWrapping.spec.tsx`
- `libs/celebrations/src/new-year/utils/tests/gift-wrapping.spec.ts`
- `libs/celebrations/src/new-year/components/NewYear/tests/NewYear.spec.tsx`
- `libs/celebrations/src/halloween/components/Halloween/tests/HalloweenCatScene.spec.tsx`
- `libs/celebrations/src/halloween/utils/tests/halloween-cat-targets.spec.ts`
- `libs/celebrations/src/halloween/utils/tests/halloween-cat-animation.spec.ts`
- `libs/celebrations/src/halloween/tests/HalloweenEvent.integration.spec.tsx`
- `apps/chat/src/context/tests/CelebrationHost.spec.tsx`
- `apps/chat/src/context/tests/CelebrationHost.integration.spec.tsx`

Every follow-up stage SHALL keep these suites green, or change them only through its own spec delta.

#### Scenario: Baseline run
- **WHEN** the suites run at `1cfb11468`
- **THEN** the library run passes 9 files / 251 tests and the app run passes 2 files / 19 tests

### Requirement: Comparison captures never overwrite the baseline

A later stage (S1–S4) that re-runs `libs/celebrations/browser-tests/celebrations-baseline.browser.spec.mjs` SHALL write to its own capture identity under `tmp/celebrations-baseline/<captureId>/`:

- For a working tree with no tracked or untracked non-ignored changes, `captureId` SHALL be the 9-character revision.
- Otherwise it SHALL be `<revision>-wt-<fingerprint>`. The fingerprint is the first 8 hex characters of a SHA-256 over `git diff HEAD --binary` and the contents of every untracked, non-ignored file.

The harness SHALL refuse to start when the target directory already contains `artefacts.sha256`, which marks a finalized capture.

Each scene result SHALL carry its own environment record:

- capture ID, revision, dirty flag and fingerprint
- the modification time of the static Storybook `index.json`
- browser, OS, CPU, Node and seed
- `startedAt` and `finishedAt`

`summarize-baseline.mjs` SHALL print those records. It SHALL exit non-zero when the scenes merged into one capture disagree on revision or fingerprint.

It SHALL also exit non-zero, without writing, when an existing `artefacts.sha256` would change. A legacy capture that has only a top-level `environment` record SHALL still summarize.

The S0 matrix, metrics and cell names SHALL stay unchanged. A comparison SHALL report each cell as one of three kinds and SHALL NOT fill a missing cell with an inferred value:

- **observed**: the value was measured in this run
- **proposed check**: a comparison rule against the baseline
- **unmeasured**: the cell was not captured

#### Scenario: An uncommitted S1 run
- **WHEN** the GiftWrapping scene is captured while S1 changes are uncommitted on top of the revision
- **THEN** the results land in `<revision>-wt-<fingerprint>/`, and `tmp/celebrations-baseline/1cfb11468/` is left byte-identical, so its `artefacts.sha256` still verifies

#### Scenario: Rerun into a finalized capture
- **WHEN** the harness targets a directory that already holds `artefacts.sha256`
- **THEN** it exits with an error before launching a browser

#### Scenario: Mixed provenance
- **WHEN** a capture directory holds a `gift-wrapping` result recorded at one fingerprint and a `sleigh` result recorded at another
- **THEN** `summarize-baseline.mjs` exits non-zero and names both scenes

#### Scenario: Summarizing a finalized capture with changed artefacts
- **WHEN** `summarize-baseline.mjs` runs on a directory whose existing `artefacts.sha256` differs from the manifest it would write
- **THEN** it exits non-zero, and the existing file is left unchanged
