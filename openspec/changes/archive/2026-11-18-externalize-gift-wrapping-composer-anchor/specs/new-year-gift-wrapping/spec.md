# Spec Delta

## ADDED Requirements

### Requirement: GiftWrapping can be delivered from a pack

GiftWrapping SHALL play from the New Year pack only when the delivery mode is `prefer-external`, `new-year/gift-wrapping` is in `UI_EVENT_EXTERNAL_SCENES`, the resolved pack declares `gift-wrapping`, and its capabilities are supported. It is a replacement by stable ID, so the scene stays in the `happy new year` secret pool, never joins the gift click pool, and keeps `newYear.giftWrappingToastMessage`. Otherwise the compiled scene plays.

#### Scenario: Default deployment
- **WHEN** no delivery policy is configured
- **THEN** `happy new year` plays the compiled GiftWrapping exactly as before, and no celebrations request is made

#### Scenario: Allowlisted external scene
- **WHEN** `prefer-external` is set, `new-year/gift-wrapping` is allowlisted, and `new-year-default@1.1.0` declares `gift-wrapping`
- **THEN** `happy new year` selects between the external GiftWrapping and the bundled ReindeerTakeoff without consecutive repeats, gift clicks still pick PenguinStar or SnowmanDelivery, and the notification is the app's translated `newYear.giftWrappingToastMessage`

#### Scenario: Client without composer anchoring
- **WHEN** a client older than S3 resolves the same pack
- **THEN** it keeps the compiled GiftWrapping, because `composer-anchor-v1` is unsupported there

### Requirement: The published scene keeps the story within the existing budgets

The pack scene SHALL keep the seven story beats, a 16000 ms timeline at 60 fps, and the existing ceilings: two elves, one player, ≤ 12 top-level layers, ≤ 500 SVG descendants, ≤ 180 paths, ≤ 240 KB per variant, ≤ 1,400 keyframes. It declares `composer-anchor-v1` with `edge: top`, `fallback: stage-anchor`, `interaction-composer-outline-v1`, `direction: mirror`, desktop and mobile variants, timing `16000 / 2000 / 250 / 18500`, and a poster of the bound master beside the proud helper.

#### Scenario: Publication check of the variants
- **WHEN** the themes publication check reads `new-year-default@1.1.0`
- **THEN** each GiftWrapping variant passes the profile subset, has exactly one `composer-outline` layer and at most one `composer-parcel` layer, and stays within the budgets above

#### Scenario: Reduced motion
- **WHEN** reduced motion matches and the external GiftWrapping is selected
- **THEN** only the poster shows for its `posterDurationMs`, and no animation data or player is requested

### Requirement: Character contact holds on every layout

With the external scene, the elves SHALL stand on the measured composer's top edge, the ribbon SHALL trace its border, the loose ribbon SHALL stay in the helper's hand and on the master's torso loops, and the composer SHALL be released before departure. These SHALL hold at 360 and 390 px mobile widths, at 1280 and 1920 px desktop widths, and in RTL, without non-uniform scaling.

#### Scenario: Contact frames at normal speed
- **WHEN** automated recordings capture the external scene at normal speed for each width in LTR and in RTL
- **THEN** contact frames at the wrap, the pull, the cocoon reveal and the departure show the contacts above, and are saved with the change's evidence

#### Scenario: No eligible composer
- **WHEN** the composer is hidden or clipped at activation
- **THEN** the elves wrap the decorative parcel at the synthetic anchor, and no host control is touched

### Requirement: The asset is the authored source

The published Lottie JSON SHALL be the source of truth for GiftWrapping artwork and motion. No repository SHALL generate it at build or publication time. The code that stays compiled for the external path SHALL be limited to the composer target rules, the observers and interrupts, the outline contour and the parcel fitting. The change SHALL record its line count next to the compiled scene's.

#### Scenario: Changing a pose
- **WHEN** a motion author changes an elf pose
- **THEN** a new pack version with a new asset hash ships, with no change in `libs/celebrations` and no generator run in `epam/ai-dial-chat-themes`

### Requirement: Rollback restores the compiled scene

Removing `new-year/gift-wrapping` from `UI_EVENT_EXTERNAL_SCENES`, or returning to `bundled`, SHALL change the host reset key. That cancels an active external GiftWrapping and aborts its pending load. The next activation SHALL play the compiled scene, while other allowlisted scenes such as `bullfinch-couriers` stay external.

#### Scenario: Rollback during playback
- **WHEN** the operator removes `new-year/gift-wrapping` while the external scene plays
- **THEN** the scene is cleaned up on the next config load, `happy new year` then plays the compiled GiftWrapping, and `bullfinch-couriers` still plays from the pack
