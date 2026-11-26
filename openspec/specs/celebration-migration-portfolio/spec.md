# celebration-migration-portfolio Specification

## Purpose

The S7 (#9226) decision register for bundled celebration scenes and decorations. It defines the candidate set, the allowed decisions and the rules behind them, and the evidence every later migration batch must produce. It also defines when a compiled duplicate may be removed. Batch 0 (`decide-celebration-scene-migrations`) records the decisions; each `migrate` decision is carried out by its own change.

## Requirements

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

### Requirement: Every candidate has exactly one decision

Each candidate SHALL carry exactly one decision: `migrate`, which names a numbered batch; `retain`, which names a reason code and a reopen condition; `delivered-pilot`, which names its stage and its open acceptance items; or `retired`. A decision SHALL change only through a spec delta that cites the new evidence.

#### Scenario: A row without a decision
- **WHEN** a candidate has no decision, or has two
- **THEN** batch 0 is incomplete and the change is not archived

#### Scenario: A batch reverses a decision
- **WHEN** a migration batch reaches no-go
- **THEN** its change amends that row to `retain` with the measured reason, and the compiled scene stays the only implementation

### Requirement: A scene migrates only when it fits the contract at lower cost

A `migrate` decision SHALL require:

- the story, contacts and fallbacks fit released placements and adapters, or one new adapter whose compiled code is smaller than the scene-specific code it replaces
- the asset fits the pack caps
- no live host control is moved
- the scene needs no capability outside the pack contract, such as audio

Authored assets SHALL stay the source; the runtime generator SHALL NOT move into the themes repository.

#### Scenario: A new adapter is proposed
- **WHEN** a batch needs an interaction adapter that is not released
- **THEN** its change compares the adapter's non-empty lines with the scene-specific lines it makes removable, counted under "Source accounting separates what stays from what goes", and justifies the adapter in its design before any asset is published

#### Scenario: Generator relocation
- **WHEN** a proposal would run the current composition or plan generator inside the themes repository or inside a generic adapter
- **THEN** it does not satisfy this rule, and the row stays `retain`

### Requirement: Retaining a scene is a recorded outcome

A `retain` decision SHALL name one reason code and a reopen condition. The reason codes are:

- `live-control`: the story moves a live host control
- `audio`: the scene needs sound
- `adapter-pending`: it needs an unreleased adapter that is not yet justified
- `procedural`: per-activation geometry or physics generation is the story
- `decoration-template`: no pack decoration template can express it
- `cost`: the compiled version is cheaper and correct

#### Scenario: Retained scene keeps its behaviour
- **WHEN** a scene is retained
- **THEN** its ID, pool, timing, toast label and fallbacks stay as they are, and its existing spec and suites are unchanged

#### Scenario: Reopening
- **WHEN** a reopen condition becomes true, for example an adapter is released by another batch
- **THEN** the row is reassessed in a new change with its own evidence, not silently treated as `migrate`

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

### Requirement: Halloween decisions

The Halloween rows SHALL record:

- `cat`: `delivered-pilot`, S4
- `train`: `retain`, `audio`
- `web`, `candy` and `bowling`: `retain`, `procedural`
- `ghost`, `bats`, `witches`, `portal`, `ravens`, `footprints`, `skeletons`, `spiders`, `cauldron`, `mimic` and `mummy`: `retain`, `adapter-pending`

IDs, click and secret pools, and the Train soundtrack SHALL be preserved.

#### Scenario: Borrowing scenes share a reopen condition
- **WHEN** an `adapter-pending` Halloween row is read
- **THEN** it names the copies it borrows, and it reopens when one generic copy-track adapter is justified by at least two scenes under "A scene migrates only when it fits the contract at lower cost"

#### Scenario: Train
- **WHEN** the `train` row is read
- **THEN** it records that the scene reads no host anchor, hides the decoration's pumpkin while a fresh pumpkin rides the train, and plays an optional soundtrack, and that packs have no audio contract

#### Scenario: Skeletons
- **WHEN** the `skeletons` row is read
- **THEN** it records that the scene hides the last word of the live greeting with a CSS custom highlight while a re-rendered copy is carried away, and that a pack has no contract for highlighting host text

#### Scenario: Cat
- **WHEN** the `cat` row is read
- **THEN** it records S4 (#9223, #9956), the go-with-amendments gate, `halloween-default@1.0.0`, and the compiled Cat as default and fallback
- **AND** it records the open items this change closes: the authoring-tool review and the merged-revision recount
- **AND** it records the items that block S8 rollout but not S7: the full-scene browser and retention runs on the final tree, normal-speed and parity recordings, the rendering cost on the final tree, and the integration checks

### Requirement: Decoration decisions are made apart from scenes

Decoration artwork, reactive controllers and accessible activation SHALL each carry their own decision. Halloween artwork and its behaviours `spider-flee`, `spider-drop`, `spider-drum` and `pumpkin-wrap` SHALL be `retain`, `decoration-template`. The New Year garland and gift SHALL be `retain`, `cost`. Each `HalloweenDecorBehavior` SHALL stay individually disableable through the host's `selection`. The spider's pointer watch pose belongs to the artwork and has no switch.

#### Scenario: Disablement in DIAL Chat
- **WHEN** the decoration rows are compared with `apps/chat/src/context/CelebrationHost.tsx`
- **THEN** they record that DIAL Chat passes no `selection`, so the shipped app disables no behaviour, while the library keeps the switch for every host

#### Scenario: Pack decoration template
- **WHEN** a decoration row is compared with `static-trigger-v1`
- **THEN** the row records that the template renders one static image button, with no pointer, typing or idle behaviour and no anchor that scenes such as Train target

#### Scenario: Accessible activation
- **WHEN** the activation row is read
- **THEN** it records that bundled events keep their compiled trigger buttons, and external-only events keep using `static-trigger-v1`

### Requirement: Source accounting separates what stays from what goes

Source counts SHALL be taken from git objects at a named revision, with the inclusion rules of `celebration-migration-baseline`. They SHALL be grouped as scene-specific compiled code, shared runtime and adapters, authoring tools and generators, and assets. Assets SHALL be reported in raw, gzip and Brotli bytes. GiftWrapping and the Cat SHALL be recounted at their merged revisions.

#### Scenario: Recounting GiftWrapping
- **WHEN** GiftWrapping's code is compared
- **THEN** the figures come from `2091a9876` and from `f585b223a`, not from the provisional S3 estimates

#### Scenario: Retained runtime is not hidden
- **WHEN** a batch reports a net removal
- **THEN** the adapter and generic runtime it keeps are reported next to the scene code it removes, and so is any generator kept only for authoring

### Requirement: Measurements are published on the issue with their revisions

Decisions and their reasons SHALL live in this spec. Sizes, payloads and browser measurements SHALL be published as #9226 comments, each tied to the Chat and Themes revisions and the counting script. Comments SHALL be posted only after the user approves the draft.

#### Scenario: A number without a revision
- **WHEN** a figure in a comment or design lacks its revision
- **THEN** it is not accepted as evidence

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

### Requirement: Batches stay independently reversible

Each migrated scene SHALL be disableable alone, by removing its `eventId/sceneId` from `UI_EVENT_EXTERNAL_SCENES` and bumping `UI_EVENT_DELIVERY_REVISION`. Its compiled or poster fallback SHALL stay available through the support window. Reverting one batch SHALL NOT change another.

#### Scenario: Rolling back batch 1
- **WHEN** `new-year/snowman-delivery` is removed from the allowlist
- **THEN** active playback is cleaned up, the compiled scene plays from the next activation, and an external GiftWrapping keeps playing

### Requirement: Compiled duplicates are removed only after the gate

A compiled scene with an external replacement SHALL be removed only when all three hold: the fallback contract no longer needs it, no public reference (README, enums, stories, specs) depends on it, and the S8 (#9227) compatibility and rollback window has ended.

#### Scenario: Removal before S8
- **WHEN** a batch proposes deleting a compiled scene before the S8 window ends
- **THEN** the deletion is out of scope for that batch

### Requirement: Published assets pass a pinned-player review

Every published pack scene asset SHALL have a person's review in the pinned player in a browser, plus a scripted structural check of its JSON. The record SHALL name the browser and player version, the reviewer, the asset hash before and after the review, and the findings per asset. An authoring-tool review moves to S8 (#9227).

#### Scenario: Approved replacement of the authoring-tool review
- **WHEN** batch 0 found no authoring tool that imports Bodymovin 5.x
- **THEN** this requirement replaces the authoring-tool review, as the issue owner explicitly approved on 2026-11-22

#### Scenario: What the browser review covers
- **WHEN** a reviewer reviews an asset in the pinned player
- **THEN** they watch continuous playback at normal speed, compare frames at the S0 capture points (25 %, 50 %, 75 %) with pre-rendered references, and inspect the layer tree and markers

#### Scenario: What the structural check covers
- **WHEN** the script checks an asset
- **THEN** it reports reserved layer names, markers, expressions, masks, track mattes, and every layer type and field that `celebration-lottie-authoring-profile` forbids

#### Scenario: Closing the pilot reviews
- **WHEN** batch 0 completes
- **THEN** the GiftWrapping variants in `new-year-default@1.1.1` and the Cat asset in `halloween-default@1.0.0` each have a recorded browser review and structural check

#### Scenario: Renders without a reviewer
- **WHEN** only automated pinned-player renders exist for an asset, and nobody has watched playback or compared the frames
- **THEN** the review is recorded as not done

#### Scenario: An asset with masks or mattes
- **WHEN** a later asset contains masks or track mattes
- **THEN** its review also covers them in an authoring tool, because `celebration-lottie-authoring-profile` requires that verification for masks and mattes in addition to the pinned player

### Requirement: Host knowledge stays in the app adapters

Migrations SHALL keep host policy and external integration in `apps/chat/src/context/CelebrationHost.tsx`, `apps/chat/src/hooks/celebration/useCelebrationPacks.ts` and `apps/chat/src/utils/celebration-pack.ts`. `libs/celebrations` SHALL receive only anchors, resolved loaders, descriptors and narrow callbacks. Batch 0 adds no user-visible string, UI, endpoint, cache, telemetry or feature gate.

#### Scenario: Adapter boundary in a batch
- **WHEN** a batch adds an interaction adapter to `libs/celebrations`
- **THEN** the adapter reads only `CelebrationAnchors` supplied by the host, and never a URL, route, environment value or app context

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
