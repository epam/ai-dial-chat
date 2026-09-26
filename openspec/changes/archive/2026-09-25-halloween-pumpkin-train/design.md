## Context

The existing train is an eleven-second CSS crossing with three occupied wagons. The runtime already cancels scenes on navigation/replacement and removes Train after twelve seconds. HalloweenDecor owns the main pumpkin button; no core page component needs to change.

## Goals / Non-Goals

Goals: actual main-pumpkin boarding, visible empty wagon, synchronized departure, richer smoke, optional bounded audio. Non-goals: changing scene pools or runtime, core components, libraries, APIs, telemetry, persistence or settings.

## Decisions

- Extract `HalloweenTrain.tsx` and layered `HalloweenTrainArtwork.tsx`. A single measured carrier contains rear artwork, the pumpkin passenger and the wagon front. This makes departure attachment structural rather than relying on unrelated animations.
- Mark HalloweenDecor's existing pumpkin wrapper. Measure its SVG and render the same HalloweenPumpkin art in the passenger; animate only the source SVG opacity, preserving the labelled button and focus. No real element is reparented.
- Use an eleven-second shared WAAPI timeline: enter until 20%, hold until 50%, jump and land before departure, leave by 86%, restore source before completion. Mirror train art/travel according to the pumpkin's physical side; never mirror the passenger's face. CSS bounds train size for mobile and desktop.
- Scene-owned state and cleanup cancel all travel, source opacity and optional audio on interaction, scrolling/resizing, source disappearance, navigation, unmount or reduced motion. Missing source/unsupported animation keeps safe decorative artwork. Reduced motion is static and silent.
- Add an optional audio configuration consumed only by this scene. Its source is absent by default. Handle playback rejection without affecting animation and stop/reset playback during cleanup. No global provider change is needed.
- Update `halloween.trainToastMessage` in en.json while preserving the secret hint. UI_EVENT=halloween remains the only gate; no cache or observability additions.

## Risks / Trade-offs

- Transparent wagon layering could expose the passenger in front of the wall → separate rear and front passes with identical viewBox.
- Layout changes could detach the passenger → cancel and restore on resize/scroll or source removal.
- Browser blocks audio → catch rejection and keep the scene silent.

## Migration Plan

Keep the existing Train scene ID and deadline. No data/config migration; revert the extracted train integration to restore the original crossing.

## Open Questions

None.
