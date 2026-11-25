# new-year-snow-circus Specification

## Purpose

Provide a New Year character story in which interface buttons become snowballs, with reversible interaction and a comic resolution.

## Requirements

### Requirement: Snow Circus tells the complete approved story
The scene SHALL show a penguin removing buttons and making snowballs, juggling, a second snowman intercepting a ball, a snowball fight, belly growth, the snowman burying himself with an oversized ball, snow moustaches, restoration and departure within 26 seconds.

#### Scenario: Complete desktop playback
- **WHEN** the scene plays with two eligible buttons
- **THEN** contact precedes pickup, three balls are juggled, both characters react to the fight, and both buttons visibly return before departure

### Requirement: Adaptations preserve the central story
The mobile scene SHALL keep both characters and all major beats with at most one borrowed button. Missing targets SHALL use drawn snowballs. Reduced motion SHALL show a finite static composition without loading the player or borrowing controls.

#### Scenario: Missing buttons or RTL
- **WHEN** no button is eligible or the host uses RTL
- **THEN** the scene remains coherent using physical geometry or drawn props and never mirrors copied text

### Requirement: Scene resources are bounded
The scene SHALL use one player, at most 48 layers, 2500 keys, 160 paths/1000 vertices, 500 generated SVG nodes, 512 KiB animation JSON, 30 KiB poster, 3 small balls, 1 large ball and 8 impact flecks; filters and masks SHALL be absent.

#### Scenario: Resource verification
- **WHEN** the authored variants are validated and rendered
- **THEN** structural budgets pass and browser measurements are recorded separately from visual acceptance and deployment evidence

### Requirement: Standard New Year set preserves existing scenes
The Themes catalog SHALL select standard `new-year-default@1.5.0`, containing every scene from `1.4.0` plus Snow Circus. Its capability SHALL be scene-local. Existing immutable assets SHALL remain unchanged.

#### Scenario: Secret phrase activation
- **WHEN** a compatible host admits Snow Circus with the existing New Year scenes
- **THEN** `happy new year` may select Snow Circus alongside the three existing secret scenes, while ordinary gift clicks exclude Snow Circus and Santa

#### Scenario: Older client or rollback
- **WHEN** the client lacks the new capability or the operator removes only its allowlist entry
- **THEN** supported existing scenes remain available

## Integration contract

The existing `CelebrationProvider` in
`libs/celebrations/src/context/CelebrationContext.tsx` owns playback state.
`newYearEvent` in `libs/celebrations/src/new-year/event.tsx` declares the external
secret-scene IDs. Host delivery policy remains in
`apps/chat/src/hooks/celebration/useCelebrationPacks.ts`; the shared library receives
resolved scenes, anchors and asset loaders rather than deployment configuration.

The pack supplies the `snowCircusToastMessage` label in English and Russian.
There is no new app translation key, backend endpoint, generated-client change,
cache, telemetry event or `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` key. Existing
external-scene admission and capability checks gate the scene. No additional
memoisation is required; authored playback uses no per-frame React updates.
The existing start-page composer handles the secret phrase by keyboard or submit
control. The decorative scene is inert and does not take focus. RTL uses measured
physical geometry with no copied-text mirroring; reduced motion uses the poster.
