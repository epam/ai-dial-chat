# Spec Delta

## MODIFIED Requirements

### Requirement: Deterministic browser scenarios

Browser baselines SHALL run against the static Storybook build of `@epam/ai-dial-celebrations`. Its `StoryHostPage` fixture provides every `CelebrationAnchors` hook (`libs/celebrations/src/stories/StoryHostPage.tsx`).

The runner is the committed Node test `libs/celebrations/browser-tests/celebrations-baseline.browser.spec.mjs`, using Playwright Chromium. It is exposed as Nx target `@epam/ai-dial-celebrations:test-baseline-browser`, which depends on `build-storybook`, so S1–S4 and the S7 batches can repeat the same matrix at their own revision.

The matrix SHALL cover three scenes:

- Scenes: `penguin-star` (`new-year-scenes--penguin-star`), `gift-wrapping` (`new-year-scenes--gift-wrapping`), `cat` (`halloween-scenes--cat`). The S0 capture at `1cfb11468` used `sleigh` (`new-year-scenes--sleigh`) in the first slot. That scene was removed in #9631, so its S0 results stay historical and are not re-captured.
- Viewports: desktop 1440 × 900 at DPR 1; mobile 390 × 844 at DPR 3 with touch; narrow mobile 360 × 780.
- Direction: `dir="ltr"` and `dir="rtl"` on `<html>`.
- Motion: `reducedMotion: 'no-preference'` and `'reduce'`.
- Missing anchors: composer removed before activation, for every scene that reads anchors (`penguin-star`, `gift-wrapping` and `cat`).
- Cancellation: a `pointerdown` during the load/prepare phase, and another 50 % into playback.
- Replay: 20 consecutive activate→complete and activate→cancel cycles per scene.

A cell SHALL be recorded as not applicable only with its reason. For example, the former `sleigh` read no anchors, so the S0 capture has no missing-anchor cell for it.

#### Scenario: Cancelling GiftWrapping while the player loads
- **WHEN** `pointerdown` fires after activation and before the `lottie_light` chunk resolves
- **THEN** no SVG renderer node is inserted afterwards, and the scene layer is empty when the provider deadline passes

#### Scenario: PenguinStar fills the removed slot
- **WHEN** the matrix runs at a revision after #9631
- **THEN** it captures `penguin-star` with missing-composer cells, and it never requests the removed `new-year-scenes--sleigh` story

### Requirement: Comparison captures never overwrite the baseline

A later stage (S1–S4, or an S7 batch) that re-runs `libs/celebrations/browser-tests/celebrations-baseline.browser.spec.mjs` SHALL write to its own capture identity under `tmp/celebrations-baseline/<captureId>/`:

- For a working tree with no tracked or untracked non-ignored changes, `captureId` SHALL be the 9-character revision.
- Otherwise it SHALL be `<revision>-wt-<fingerprint>`. The fingerprint is the first 8 hex characters of a SHA-256 over `git diff HEAD --binary` and the contents of every untracked, non-ignored file.

The harness SHALL refuse to start when the target directory already contains `artefacts.sha256`, which marks a finalized capture.

Each scene result SHALL carry its own environment record:

- capture ID, revision, dirty flag and fingerprint
- the modification time of the static Storybook `index.json`
- browser, OS, CPU, Node and seed
- `startedAt` and `finishedAt`

`summarize-baseline.mjs` SHALL print those records for every scene present in the capture, including both the current matrix scenes and the former `sleigh` in legacy captures. It SHALL exit non-zero when the scenes merged into one capture disagree on revision or fingerprint.

It SHALL also exit non-zero, without writing, when an existing `artefacts.sha256` would change. A legacy capture that has only a top-level `environment` record SHALL still summarize.

The S0 matrix, metrics and cell names SHALL stay unchanged, except that `penguin-star` replaces the removed `sleigh`. A comparison SHALL report each cell as one of three kinds and SHALL NOT fill a missing cell with an inferred value:

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
- **WHEN** a capture directory holds a `gift-wrapping` result recorded at one fingerprint and a `penguin-star` result recorded at another
- **THEN** `summarize-baseline.mjs` exits non-zero and names both scenes

#### Scenario: PenguinStar provenance is checked
- **WHEN** a capture at `f585b223a` holds `penguin-star`, `gift-wrapping` and `cat` results
- **THEN** `summarize-baseline.mjs` prints all three environment records and includes `penguin-star` in the provenance check, rather than skipping it because only `sleigh` is listed

#### Scenario: Summarizing a finalized capture with changed artefacts
- **WHEN** `summarize-baseline.mjs` runs on a directory whose existing `artefacts.sha256` differs from the manifest it would write
- **THEN** it exits non-zero, and the existing file is left unchanged
