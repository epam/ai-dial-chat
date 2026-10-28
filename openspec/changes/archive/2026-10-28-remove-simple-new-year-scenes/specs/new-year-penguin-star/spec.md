## MODIFIED Requirements

### Requirement: Resources and existing event behavior remain bounded

The scene MUST use one lazy-loaded Lottie player, at most one short WAAPI animation, at most 140 generated SVG artwork nodes, 32 animated properties, 80 keys per property and 120 KB serialized composition data. It MUST use no external asset, filter, mask, per-frame host measurement or React update. All observers, listeners, timers and animations MUST be released on stop. Gift activation SHALL select only PenguinStar; the `happy new year` secret phrase SHALL select only GiftWrapping. Existing event selection and translated notifications SHALL remain available. Snow, Confetti and Sleigh SHALL no longer be registered.

#### Scenario: Host disables PenguinStar

- **WHEN** the host excludes PenguinStar from the event selection
- **THEN** the gift cannot activate another scene, while the secret phrase still activates GiftWrapping if it is enabled
