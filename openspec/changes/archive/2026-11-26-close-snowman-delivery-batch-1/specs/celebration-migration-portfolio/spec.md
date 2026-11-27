# Spec Delta

## MODIFIED Requirements

### Requirement: Every migration batch produces the same evidence

A batch SHALL pass the affected scene's component, target, animation and event integration suites. It SHALL pass browser checks on mobile and desktop, LTR and RTL, with reduced motion, missing targets, replay and interruption. It SHALL record contact frames, browser profiles and resource retention against the current artwork baseline. Batch 1 (`snowman-delivery`) is the one approved exception, described in its scenario (issue owner, 2026-11-22).

#### Scenario: Continuous playback
- **WHEN** a batch claims visual parity
- **THEN** a reviewer has watched full playback at normal speed, and that assessment is recorded separately from still frames, geometry tests and performance figures

#### Scenario: Existing evidence
- **WHEN** a batch cites the #9920 artwork evidence or any earlier still frames
- **THEN** it does not count them as a continuous-playback review

#### Scenario: Frames of an anchored scene on mobile
- **WHEN** a batch captures frames of a scene that cancels on viewport resize in a mobile-emulated context
- **THEN** it captures through the DevTools protocol without re-applying device metrics, and asserts that the stage is present in every frame, so a silently cancelled scene fails instead of producing empty frames

#### Scenario: Batch 1 evidence on data
- **WHEN** batch 1 records its evidence
- **THEN** it records the data-level checks of its gate and full asset, states that no browser run was made, and lists the browser evidence S8 must produce before rolling out the external SnowmanDelivery

#### Scenario: Batch 1 rollback evidence on a local stand
- **WHEN** batch 1 records its publication and rollback evidence (issue owner, 2026-11-26)
- **THEN** it records a local stand that serves the merged Themes tree of the published `new-year-default` default through the Chat BFF, names the Chat and Themes revisions and the index revision served, records normal-speed recordings of the `ledge-card` section and of a section with no copied card (`platform`, accepted by the issue owner in place of `rim`) and the rollback outcome, and lists a run in a deployed environment and a `rim` recording among the items S8 must produce

### Requirement: Batches stay independently reversible

Each migrated scene SHALL be disableable alone, by removing its `eventId/sceneId` from `UI_EVENT_EXTERNAL_SCENES` and bumping `UI_EVENT_DELIVERY_REVISION`. Its compiled or poster fallback SHALL stay available through the support window. Reverting one batch SHALL NOT change another.

#### Scenario: Rolling back batch 1
- **WHEN** `new-year/snowman-delivery` is removed from the allowlist and the revision is bumped while it plays
- **THEN** active playback is cleaned up and the borrowed card is restored, the next gift click picks from the remaining gift-click pool and plays the compiled SnowmanDelivery when chosen, and every other external New Year scene still on the allowlist (for example `gift-wrapping`, `santa-history-delivery`, `snow-circus`, `bullfinch-couriers` and `polar-bears-workshop` under `new-year-default@1.5.1`) stays external
