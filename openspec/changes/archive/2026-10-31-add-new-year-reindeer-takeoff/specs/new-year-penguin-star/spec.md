## MODIFIED Requirements

### Requirement: Resources and existing event behavior remain bounded

The scene's resources SHALL be bounded:

- one lazy-loaded Lottie player;
- at most one short WAAPI animation;
- at most 140 generated SVG artwork nodes;
- at most 32 animated properties and 80 keys per property;
- at most 120 KB of serialized composition data.

It MUST use no external asset, filter, mask, per-frame host measurement or React update. All observers, listeners, timers and animations MUST be released on stop.

The gift click pool SHALL contain PenguinStar and SnowmanDelivery, and a gift click SHALL pick between the enabled ones at random. The `happy new year` secret phrase SHALL select enabled GiftWrapping or ReindeerTakeoff without consecutive repeats, independently of gift clicks. Existing event selection and translated notifications SHALL remain available. Snow, Confetti and Sleigh SHALL no longer be registered.

#### Scenario: Host disables PenguinStar

- **WHEN** the host excludes PenguinStar from the event selection
- **THEN** the gift plays only SnowmanDelivery when it is enabled, and nothing otherwise
- **AND** the secret phrase still selects enabled GiftWrapping or ReindeerTakeoff without consecutive repeats
