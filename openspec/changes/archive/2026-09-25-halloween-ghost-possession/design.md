## Context

The current Ghost branch in `HalloweenBurstOverlay.tsx` uses seven independent CSS flights and `HalloweenGhost.tsx` artwork. Other Halloween scenes already borrow inert visual copies through `celebration-snapshots.ts`; the raven scene provides bounded discovery and lifecycle patterns. The user approved possession plus an unsuccessful pumpkin scare, and explicitly requires isolation from core components.

## Goals / Non-Goals

Goals: readable cause-and-effect story, spatially separate possessions and exits, reversible visuals, mobile/RTL/motion parity, bounded work.

Non-goals: shared libraries/provider changes, real UI/data mutations, audio, new notifications, particle-heavy rendering or other scenes.

## Decisions

- Use `HalloweenGhosts` as the scene owner. CelebrationProvider keeps activation, notifications and deadline ownership. A per-mount plan stores measured targets and random paths; no global cache, hook or context is introduced. Async class imports use cancellation guards.
- Discover whole small targets through existing public composer/starter classes, history selectors and the pumpkin anchor. Select at most three mobile/five desktop targets, at most 60 descendants each, with spacing and category diversity. Skip clipping, hidden, focus, expanded controls and editable subtrees; never clone the composer. Pumpkin is a reaction anchor and retains its focusable original.
- Reuse the existing ghost variants, with scene-owned expression layers, hands and a trailing cloth tail. A twelve-second timeline stages arrivals, head-first absorption, possessed copies with eyes, the brave approach/scare, pumpkin grin, recoil/hiding/tail, coordinated peeking and staggered exits. Copies and eyes share the same transform so faces stay attached.
- Use precomputed WAAPI transform/opacity frames with a common document timeline. Animate existing pumpkin artwork, brighten its original light group and add an aligned soft halo, without mounting a new UI block. The small original light group also receives a finite brightness animation, so its grin follows the existing hover motion without a duplicate face. No animation-frame layout reads or React updates. Start with SVG; consider canvas only if measurements justify it.
- Use existing snapshots for restoration and bounded cloning. Scene cleanup owns actors and pumpkin animation; input, click, focus, scroll, resize, source mutation, hidden document, unmount and motion-preference change end playback. A canceled scene cannot restart after a breakpoint or preference change.
- Missing pumpkin or eligible homes uses the original decorative flight fallback. Reduced motion and unsupported WAAPI use stationary, distributed ghosts without borrowing. All copies are inert; all artwork is aria-hidden and pointer-transparent. Physical viewport geometry works in both directions without mirroring layout.
- Reuse the current Ghost toast/secret hint; no visible strings, API, telemetry, persistence, TTL or feature flag beyond `UI_EVENT=halloween`.

## Risks / Trade-offs

- Snapshot setup can cost CPU → cap descendants and selected targets, measure a throttled fixture, and avoid whole panels.
- Hover/focus and live page updates can invalidate geometry → skip focused homes and cancel on interaction, mutation and viewport change. Pumpkin focus is preserved.
- Copies can look detached → put their eyes inside the same moving wrapper; use the same home geometry for entry, peeking and exit.
- Long-lived user preview selection and pending raven work already exist → preserve both, change only Ghost routing and new scene files.

## Migration Plan

No data migration. Route only Ghost to the new scene; retain the flight helper for fallback. Rollback restores the old branch. Main OpenSpec synchronization happens at archive.

## Open Questions

None blocking. Exact motion curves and timings are implementation tuning within the twelve-second story.
