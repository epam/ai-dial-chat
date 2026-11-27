# Spec Delta

## MODIFIED Requirements

### Requirement: The external SnowmanDelivery is reversible on its own

The compiled SnowmanDelivery SHALL stay the default and the fallback. Removing `new-year/snowman-delivery` from `UI_EVENT_EXTERNAL_SCENES` and bumping `UI_EVENT_DELIVERY_REVISION` SHALL clean up active playback and play the compiled scene from the next activation. Other external New Year scenes SHALL be unaffected.

#### Scenario: Rolling back batch 1
- **WHEN** an operator removes `new-year/snowman-delivery` from the allowlist and bumps the revision during playback
- **THEN** the external scene restores the card and stops, the next gift click can play the compiled SnowmanDelivery, and every other external New Year scene still on the allowlist, such as GiftWrapping, Santa, Snow Circus, the bullfinch couriers and the polar bears workshop, stays external

#### Scenario: Older client
- **WHEN** a client without `interaction-copy-track-v1` receives `new-year-default@1.2.0`
- **THEN** it keeps the compiled SnowmanDelivery and plays the other supported external scenes
