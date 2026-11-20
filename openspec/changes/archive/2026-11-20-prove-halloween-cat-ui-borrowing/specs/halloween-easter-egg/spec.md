# Spec Delta

## ADDED Requirements

### Requirement: The Cat can be delivered from a pack

The Cat SHALL play from the Halloween pack only when all of these hold:

- the delivery mode is `prefer-external`
- `halloween/cat` is in `UI_EVENT_EXTERNAL_SCENES`
- the resolved pack declares `cat`
- its capabilities are supported

It replaces the scene by stable ID, so it stays in the pumpkin click pool and keeps `halloween.catToastMessage`. In every other case the compiled Cat plays, with its 25.5 s lifetime.

#### Scenario: Default deployment
- **WHEN** no delivery policy is configured
- **THEN** a pumpkin click can play the compiled Cat exactly as before, and no celebrations request is made

#### Scenario: Allowlisted external Cat
- **WHEN** `prefer-external` is set, `halloween/cat` is allowlisted and `halloween-default@1.0.0` declares `cat`
- **THEN** pumpkin clicks keep the same eleven scenes and no-repeat rule, only the Cat renders from the pack, its provider lifetime is 27,750 ms, and its notification is the app's translated `halloween.catToastMessage`

#### Scenario: Rollback
- **WHEN** an operator removes `halloween/cat` from `UI_EVENT_EXTERNAL_SCENES` and bumps `UI_EVENT_DELIVERY_REVISION` while the external Cat plays
- **THEN** the external scene stops and restores the borrowed buttons, and the next activation plays the compiled Cat

#### Scenario: Client without the cat-borrow adapter
- **WHEN** a client older than S4 resolves the same pack
- **THEN** it keeps the compiled Cat, because `interaction-cat-borrow-v1` is unsupported there

### Requirement: The published Cat keeps the story and pacing within budget

The pack scene SHALL keep the 25 s two-button and one-button stories and the crossing walk.

- **Placement and direction:** `composer-anchor-v1` with `fallback: stage-anchor` and `direction: none`, and `interaction-cat-borrow-v1`.
- **Assets:** one animation asset, whose mobile variant maps at scale 0.8.
- **Timing:** `25000 / 2000 / 250 / 27750`.
- **Poster:** the seated cat.
- **Budget:** each variant SHALL stay within the v1 Lottie caps and 800 rendered SVG elements.

#### Scenario: Publication check
- **WHEN** the themes publication check reads `halloween-default@1.0.0`
- **THEN** the Cat variant passes the profile subset and the cat-borrow marker and slot rules, and stays within the caps

#### Scenario: Visual parity at actual size
- **WHEN** reviewers watch the external and the compiled Cat side by side, continuously at normal speed, at 390 and 1280 px
- **THEN** the artwork, beats and pacing match, apart from the deltas recorded in the change's evidence, and the review is recorded with the change

#### Scenario: Reduced motion
- **WHEN** reduced motion matches and the external Cat is selected
- **THEN** only the poster shows for its `posterDurationMs`, no button is borrowed, and no animation data or player is requested
