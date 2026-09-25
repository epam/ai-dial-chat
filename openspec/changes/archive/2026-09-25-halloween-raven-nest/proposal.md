## Why

`HalloweenBurst.Ravens` currently perches birds at viewport edges and flies them away without touching the interface. Give this scene the agreed nest-building and conversation tug-of-war story while keeping its rendering and borrowed UI bounded.

## What Changes

- Replace the perched flock with five mobile/eight desktop ravens that tear small fragments from separated headings, controls and history rows and build a nest on the main pumpkin.
- Collectors use separate pickup points, staggered drop-offs and independent departures, without waiting in a cluster at the nest.
- Two birds tug opposite ends of one visible conversation. One releases, launching the other and its prize toward the nest; the pumpkin shakes, the flock scatters, and borrowed UI returns.
- Use a composer-border strip when no eligible conversation is visible. Keep static birds under reduced motion and cancel borrowed artwork on user interaction or navigation.
- Use precomputed SVG/WAAPI motion and a bounded conversation snapshot; measure performance before considering a canvas renderer.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `halloween-easter-egg`: interactive raven nest scene, coupled grips and cargo, bounded rendering, responsive fallbacks and cleanup.

## Impact

Application-owned Halloween components, utilities, tests, scene duration and `apps/chat/README.md`. Follow `apps/chat/src/utils/halloween-mimic.ts:50` for a shared actor/cargo timeline and `apps/chat/src/utils/celebration-snapshots.ts:120` for reversible borrowing. No core page components, libraries, backend, API, dependencies or persistent data change. Reuse the existing raven notification and secret-phrase hint; no new i18n strings.

## Acceptance Criteria

The entire story is recognizable, birds remain attached to the strip/row they carry, and the nest visibly sits on the pumpkin. The original conversation text and controls are restored without persisted changes. Desktop/mobile and LTR/RTL use real visible geometry. Drawing/animation counts stay bounded, with no per-frame React renders or layout reads; browser checks include throttled CPU.

## Alternatives and Non-goals

Keep the existing decorative flock (insufficient interaction), rasterize everything into canvas (unnecessary loss of direct DOM fidelity), or use bounded SVG actors and visual copies (chosen, reuses existing lifecycle). A shared renderer for every event, changes to other scenes, audio and real conversation mutations are out of scope. Rollback restores the existing raven component and deadline; event IDs and triggers remain compatible.
