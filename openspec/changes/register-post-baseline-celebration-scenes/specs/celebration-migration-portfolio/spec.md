## MODIFIED Requirements

### Requirement: The candidate set is fixed at a pinned revision

The register SHALL cover the 20 bundled scene IDs and the decoration behaviours of `ai-dial-chat` `f585b223a`, judged against `epam/ai-dial-chat-themes` `bdd2feb`. Delivered pilots and retired scenes SHALL be listed apart from candidates. External additions and external-only events SHALL be counted separately and never as candidates. The S0 record SHALL be cited, never overwritten.

#### Scenario: Counting the bundled inventory
- **WHEN** the register is compared with the scene enums `HalloweenScene` and `NewYearScene` at `f585b223a`
- **THEN** it lists 16 Halloween IDs (11 pumpkin-click, 5 secret) and 4 New Year IDs (2 gift-click, 2 secret), and every ID appears exactly once

#### Scenario: Items that are not candidates
- **WHEN** the register is read for `snow`, `confetti`, `sleigh`, `bullfinch-couriers`, `polar-bears-workshop`, `santa-history-delivery`, `snow-circus`, `company-anniversary` or `new-year-polar-bears`
- **THEN** it lists:
  - the first three as retired (removed in #9631);
  - `bullfinch-couriers`, `polar-bears-workshop` (#9973, #9990), `santa-history-delivery` (#9983) and `snow-circus` (#9998) as external scene additions in `new-year-default`, all four present in `new-year-default@1.5.1` at Themes `57643b3`;
  - `company-anniversary` and `new-year-polar-bears` as external-only events.
- **AND** none of them carries a migrate or retain decision

#### Scenario: The historical baseline stays intact
- **WHEN** a reader compares the 20-scene register with the 21-scene S0 inventory at `1cfb11468`
- **THEN** both are cited with their own revisions, and the S0 numbers are not restated as current

### Requirement: New Year decisions

The New Year rows SHALL record:

- `penguin-star`: `retain`, `live-control`
- `gift-wrapping`: `delivered-pilot`, S3
- `snowman-delivery`: `migrate`, batch 1
- `reindeer-takeoff`: `retain`, `adapter-pending`
- `elf-fireworks` (addendum): `retain`, `adapter-pending`
- `cat-bauble` (addendum): `retain`, `adapter-pending`

Pool membership is recorded under "New Year pools follow the code".

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
- **WHEN** the `reindeer-takeoff` row is compared with the code, `new-year-reindeer-takeoff` and the `NewYearScene.ReindeerTakeoff` documentation
- **THEN** the row follows the code and `new-year-reindeer-takeoff`, which catch a textarea word or the drawn ice catch, and the enum documentation describes the same catch; its former page-button wording was fixed by `fix-celebration-docs-drift`

#### Scenario: GiftWrapping
- **WHEN** the `gift-wrapping` row is read
- **THEN** it records S3 (#9222, #9920), `new-year-default@1.1.1` as the published version, and the compiled scene as the default and fallback
- **AND** it records the open items this change closes: the authoring-tool review and the merged-revision recount
- **AND** it records the items that block S8 rollout but not S7: normal-speed recordings of the external path, and the frame archive still to be attached to #9223

#### Scenario: ElfFireworks
- **WHEN** the `elf-fireworks` row is read
- **THEN** it records what the scene borrows, as specified in `new-year-elf-fireworks`:
  - one inert copy of the composer's inline-end-most button, the send button, at 24–120 × 24–64 px and at most 40 nodes, borrowed even when disabled;
  - a cane whose length is computed from the measured button hooks the copy;
  - the copy spins through two arcs and squashes vertically on eased segments;
  - a drawn detonator plays the same story when no button is eligible.
- **AND** it names `interaction-button-props-v1` as the closest released adapter and records what that adapter lacks:
  - a named composer control as the target, instead of its own choice of nearby buttons;
  - copies larger than its 64 × 56 px cap, and disabled targets;
  - rotation and vertical-scale channels;
  - eased segments, where it accepts only linear contact tracks;
  - a prop whose length follows the measured target.
- **AND** it reopens when one adapter that copies a named composer control with those channels is justified under "A scene migrates only when it fits the contract at lower cost". ElfFireworks and CatBauble are its two candidate scenes, so that adapter's own change reassesses this row

#### Scenario: CatBauble
- **WHEN** the `cat-bauble` row is read
- **THEN** it records what the scene borrows, as specified in `new-year-cat-bauble`:
  - one inert copy of the composer's model selector, found through the host anchor `composerModelSelector`, at 36–140 × 24–44 px and at most 40 nodes;
  - the copy is flicked onto the rim, slid into a drawn fir, hung on its hook as a swinging ornament, carried back by a grip in the cat's mouth, and lowered into its slot;
  - a drawn tangerine plays the same story when no selector is eligible.
- **AND** it names `interaction-button-props-v1` as the closest released adapter and records what that adapter lacks:
  - the named model-selector target;
  - copies wider than 64 px;
  - rotation for the pendulum and the carry;
  - eased segments;
  - a grip bound to a drawn hook.
- **AND** it reopens on the same condition as the `elf-fireworks` row
- **AND** copying the model selector does not by itself reopen the `penguin-star` row, whose condition remains a product decision accepting a copied control

## ADDED Requirements

### Requirement: Scenes added after the baseline are registered in a dated addendum

A 2026-11-26 addendum SHALL register the bundled scene IDs added after `f585b223a`, pinned at Chat `892cf97ef` and judged against Themes `57643b3`. Each addendum row SHALL carry exactly one decision under the baseline rules. It SHALL also name the borrowed control, the closest released adapter, what that adapter lacks, and where its scene-specific line count is published. Baseline rows SHALL NOT be rewritten.

#### Scenario: Counting the addendum
- **WHEN** the register is compared with `HalloweenScene` and `NewYearScene` at `892cf97ef`
- **THEN** the 16 Halloween IDs are unchanged, the New Year enum has 6 IDs, and the addendum lists `elf-fireworks` (#9976) and `cat-bauble` (#9996) exactly once each, while the baseline still counts 20 IDs at `f585b223a`

#### Scenario: An addendum row without a decision
- **WHEN** an addendum row has no decision, or has two
- **THEN** the addendum is incomplete and its change is not archived

#### Scenario: A scene added after the addendum
- **WHEN** a bundled scene ID lands after `892cf97ef`
- **THEN** it carries no decision until a later dated addendum, with its own revisions, registers it

#### Scenario: Line counts live with the evidence
- **WHEN** an addendum row's scene-specific code size is needed
- **THEN** it is read from the #9226 comment, which names the revision and the counting rule of "Source accounting separates what stays from what goes", not from this spec

### Requirement: New Year pools follow the code

No S7 batch SHALL change a pool. The register SHALL record the pools as the code builds them:

- the compiled gift-click pool `NEW_YEAR_CLICK_SCENES`;
- the compiled secret pool `secretTrigger.sceneIds`;
- admitted external scenes, as merged by `libs/celebrations/src/utils/celebration-descriptor-event.ts`.

A replacement keeps its bundled ID's pool. An addition joins the secret pool when `secretTrigger.externalSceneIds` lists it, and the gift-click pool otherwise.

#### Scenario: Compiled pools at the addendum revision
- **WHEN** `libs/celebrations/src/new-year/constants/new-year.ts` and `libs/celebrations/src/new-year/event.tsx` are read at `892cf97ef`
- **THEN** the gift-click pool is `penguin-star`, `snowman-delivery`, `elf-fireworks` and `cat-bauble`, the secret pool is `gift-wrapping` and `reindeer-takeoff`, and `externalSceneIds` is `santa-history-delivery` and `snow-circus`

#### Scenario: Admitted external scenes
- **WHEN** `new-year-default@1.5.1` is admitted with every scene allowed
- **THEN** the external `gift-wrapping` and `snowman-delivery` replace their bundled scenes in their existing pools, `santa-history-delivery` and `snow-circus` join the secret pool, and `bullfinch-couriers` and `polar-bears-workshop` join the gift-click pool

#### Scenario: A migration batch and the pools
- **WHEN** a migration batch replaces a compiled scene with an external one
- **THEN** the scene keeps its ID and its pool, and only that scene's own change can move it to another pool

### Requirement: Adapters added outside S7 batches are counted by the scenes that use them

For each generic adapter released outside an S7 batch, the register SHALL list the scenes that use it today. Scenes that could use it only after the adapter changes SHALL be listed separately and not counted. A count SHALL change only through a spec delta that names the scene and its evidence. These counts are the input to the "at least two scenes" reopen rule.

#### Scenario: Counts at the addendum revision
- **WHEN** the counts are read at Chat `892cf97ef` and Themes `57643b3`
- **THEN** each adapter is justified by one scene:
  - `interaction-composer-carry-v1` (`celebration-composer-carry`, #9973) by `polar-bears-workshop`;
  - `interaction-history-ladder-v1` (`celebration-history-ladder`, #9983) by `santa-history-delivery`;
  - `interaction-button-props-v1` (`celebration-button-props`, #9998) by `snow-circus`.

#### Scenario: Potential scenes are not counted
- **WHEN** the `interaction-button-props-v1` count is read
- **THEN** `elf-fireworks` and `cat-bauble` are listed as scenes that a widened button-copy adapter would serve, and are not counted toward `interaction-button-props-v1` as released

#### Scenario: A Halloween scene becomes the second user
- **WHEN** a later decision change shows that a Halloween scene fits one of these adapters as released
- **THEN** that change raises the count to two in its own delta, and reopens the row under "Retaining a scene is a recorded outcome"
