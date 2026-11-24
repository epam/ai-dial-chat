# Spec Delta

## ADDED Requirements

### Requirement: The external SnowmanDelivery tells the compiled story

When `new-year/snowman-delivery` is delivered externally, the scene SHALL be played by `interaction-copy-track-v1`. It SHALL keep the compiled story's beat order, stage choice, causal impact, head flight and recovery, and the borrowed card's exact return. Differences SHALL be limited to the visual deltas recorded in the batch 1 design and accepted in review.

#### Scenario: Default production layout
- **WHEN** the starters render below the composer and an eligible bottom-row card has a free band beneath
- **THEN** the external scene plays its `ledge` card section, the snowman jumps to grip the card copy, and the composer is not covered

#### Scenario: No eligible card
- **WHEN** no starter card qualifies and the composer is a safe stage
- **THEN** the external scene plays its `rim` section with the drawn sled, and no host element is copied or hidden

#### Scenario: Unsuitable geometry
- **WHEN** no authored section qualifies
- **THEN** the external scene shows its poster for the poster duration, and no host element is copied or hidden

#### Scenario: Stage choice matches the compiled scene
- **WHEN** the external and the compiled scene measure the same host
- **THEN** the external scene plays the section of the compiled stage: `ledge-card` for `ledge`, `rim-card` for `rim`, `rim` for `rim-sled`, `platform` for `platform` and the poster for the still, except that a mobile card host whose span is shorter than 140 px plays the drawn-sled `rim` or the poster

#### Scenario: Head flight follows the sled
- **WHEN** the external scene plays at any span length the solver allows
- **THEN** the head separates on the frame after impact, its speed is within 20 % of the sled's speed, and it lodges within 2 CSS px of the branch socket

### Requirement: The external SnowmanDelivery asset stays within the pack caps

Each published SnowmanDelivery animation variant SHALL contain only shape, null and precomposition layers. It SHALL contain no masks, mattes, expressions, effects, gradients, text or images. It SHALL fit 512 KiB, 48 layers, 4,000 keyframes and 8,000 vertices. Its rendered SVG SHALL stay at or below 800 elements. Its poster SHALL be at most 100 KiB.

#### Scenario: Publication check
- **WHEN** `new-year-default@1.2.0` is checked in the themes repository
- **THEN** both SnowmanDelivery variants pass the profile subset, the caps and the copy-track slot and marker rules

### Requirement: The external SnowmanDelivery is reversible on its own

The compiled SnowmanDelivery SHALL stay the default and the fallback. Removing `new-year/snowman-delivery` from `UI_EVENT_EXTERNAL_SCENES` and bumping `UI_EVENT_DELIVERY_REVISION` SHALL clean up active playback and play the compiled scene from the next activation. Other external New Year scenes SHALL be unaffected.

#### Scenario: Rolling back batch 1
- **WHEN** an operator removes `new-year/snowman-delivery` from the allowlist and bumps the revision during playback
- **THEN** the external scene restores the card and stops, the next gift click can play the compiled SnowmanDelivery, and an external GiftWrapping keeps playing

#### Scenario: Older client
- **WHEN** a client without `interaction-copy-track-v1` receives `new-year-default@1.2.0`
- **THEN** it keeps the compiled SnowmanDelivery and plays the other supported external scenes
