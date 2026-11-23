# Spec Delta

## MODIFIED Requirements

### Requirement: New Year decisions

The New Year rows SHALL record:

- `penguin-star`: `retain`, `live-control`
- `gift-wrapping`: `delivered-pilot`, S3
- `snowman-delivery`: `migrate`, batch 1
- `reindeer-takeoff`: `retain`, `adapter-pending`

Click and secret pools SHALL stay unchanged.

#### Scenario: PenguinStar
- **WHEN** the `penguin-star` row is read
- **THEN** it records that the scene animates the live starter or model-selector control (`libs/celebrations/src/new-year/utils/penguin-star-selector.ts`), that no adapter may move a live control, and that it reopens only after a product decision accepting a copied control

#### Scenario: SnowmanDelivery
- **WHEN** the `snowman-delivery` row is read
- **THEN** it names batch 1, the `composer-anchor-v1` placement, and the generic `interaction-copy-track-v1` adapter built on the generic borrowing modules released by S4, whose spike passed its gate with amendments on 2026-11-22. It also requires the batch to preserve the stage choices of `SnowmanStage` (`ledge`, `rim`, `rim-sled`, `platform`, `static`) and the borrowed starter card's return

#### Scenario: ReindeerTakeoff
- **WHEN** the `reindeer-takeoff` row is read
- **THEN** it records the interactions to preserve. The ribbon, drawn in the composition, catches a word from the textarea value or placeholder. An inert copy of that word, with a cover over the original pixels, is lifted and returned, and the textarea is never touched. When no word can be measured safely, the ribbon catches a drawn ice catch instead
- **AND** its reopen condition is met: batch 1 reached go on 2026-11-22, and `interaction-copy-track-v1` covers a copied word on the composition's clock through its `composer-word` role. The row stays `retain` until a later batch's own change decides it

#### Scenario: No page button in ReindeerTakeoff
- **WHEN** the `reindeer-takeoff` row is compared with the `NewYearScene.ReindeerTakeoff` documentation, which mentions a page button
- **THEN** the row follows the code and `new-year-reindeer-takeoff`, which catch a textarea word or the drawn ice catch, and it records the enum documentation as drift to fix outside this change

#### Scenario: GiftWrapping
- **WHEN** the `gift-wrapping` row is read
- **THEN** it records S3 (#9222, #9920), `new-year-default@1.1.1` as the published version, and the compiled scene as the default and fallback
- **AND** it records the open items this change closes: the authoring-tool review and the merged-revision recount
- **AND** it records the items that block S8 rollout but not S7: normal-speed recordings of the external path, and the frame archive still to be attached to #9223

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
