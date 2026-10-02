## ADDED Requirements

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
