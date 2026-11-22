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
- **WHEN** the register is read for `snow`, `confetti`, `sleigh`, `bullfinch-couriers` or `company-anniversary`
- **THEN** the first three are listed as retired (removed in #9631), `bullfinch-couriers` as an external scene addition in `new-year-default`, and `company-anniversary` as an external-only event, and none of them carries a migrate or retain decision

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

Click and secret pools SHALL stay unchanged.

#### Scenario: PenguinStar
- **WHEN** the `penguin-star` row is read
- **THEN** it records that the scene animates the live starter or model-selector control (`libs/celebrations/src/new-year/utils/penguin-star-selector.ts`), that no adapter may move a live control, and that it reopens only after a product decision accepting a copied control

#### Scenario: SnowmanDelivery
- **WHEN** the `snowman-delivery` row is read
- **THEN** it names batch 1, the `composer-anchor-v1` placement, and a card-borrowing adapter built on the generic borrowing modules released by S4, which that batch must justify. It also requires the batch to preserve the stage choices of `SnowmanStage` (`ledge`, `rim`, `rim-sled`, `platform`, `static`) and the borrowed starter card's return

#### Scenario: ReindeerTakeoff
- **WHEN** the `reindeer-takeoff` row is read
- **THEN** it records the interactions to preserve. The ribbon, drawn in the composition, catches a word from the textarea value or placeholder. An inert copy of that word, with a cover over the original pixels, is lifted and returned, and the textarea is never touched. When no word can be measured safely, the ribbon catches a drawn ice catch instead
- **AND** it reopens when batch 1 reaches go and its adapter, justified by SnowmanDelivery, also covers a copied word on the composition's clock

#### Scenario: No page button in ReindeerTakeoff
- **WHEN** the `reindeer-takeoff` row is compared with the `NewYearScene.ReindeerTakeoff` documentation, which mentions a page button
- **THEN** the row follows the code and `new-year-reindeer-takeoff`, which catch a textarea word or the drawn ice catch, and it records the enum documentation as drift to fix outside this change

#### Scenario: GiftWrapping
- **WHEN** the `gift-wrapping` row is read
- **THEN** it records S3 (#9222, #9920), `new-year-default@1.1.1` as the published version, and the compiled scene as the default and fallback
- **AND** it records the open items this change closes: the authoring-tool review and the merged-revision recount
- **AND** it records the items that block S8 rollout but not S7: normal-speed recordings of the external path, and the frame archive still to be attached to #9223

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

A batch SHALL pass the affected scene's component, target, animation and event integration suites. It SHALL pass browser checks on mobile and desktop, LTR and RTL, with reduced motion, missing targets, replay and interruption. It SHALL record contact frames, browser profiles and resource retention against the current artwork baseline.

#### Scenario: Continuous playback
- **WHEN** a batch claims visual parity
- **THEN** a reviewer has watched full playback at normal speed, and that assessment is recorded separately from still frames, geometry tests and performance figures

#### Scenario: Existing evidence
- **WHEN** a batch cites the #9920 artwork evidence or any earlier still frames
- **THEN** it does not count them as a continuous-playback review

#### Scenario: Frames of an anchored scene on mobile
- **WHEN** a batch captures frames of a scene that cancels on viewport resize in a mobile-emulated context
- **THEN** it captures through the DevTools protocol without re-applying device metrics, and asserts that the stage is present in every frame, so a silently cancelled scene fails instead of producing empty frames

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
