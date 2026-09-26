## Context

The user approved gravity testing after exploring Cat variants. The existing Cat only traverses the bottom. The Bats/Ghosts scenes already provide examples of deferred public anchor discovery and reversible snapshots. Starter placement and available toolbar buttons vary by viewport/deployment; geometry must come from the live page.

## Goals / Non-Goals

Build a readable cat story with physical contact, two deliberate falls, rebound/recoil and grooming. Preserve originals and focus, and keep work inside the Halloween layer. No app/core/library/provider changes, audio, new controls, strings or particles.

## Decisions

- Contract-first targets, plan, controller and artwork, then complete scene integration. Read public composer/starter class names through cancellable dynamic imports, as in HalloweenBats. Measure a bounded candidate set once; favor nearby small starter/toolbar buttons, at most two with at most 60 descendants, 300×96px and 24000px² each. Skip focused, editable, disabled, expanded, hidden, clipped and overlapping targets. The composer is a read-only anchor even when focused, never a copy.
- One articulated SVG cat with a stable foot/paw coordinate contract, a scene-specific 17.5-second plan and 18-second provider lifetime. Custom SVG is character illustration, not a UI icon. Precompute crouch, jump, landing compression, testing reach, nudge, second shove, head recoil, grooming and departure with eased rests and accelerating falls. Moves derive from measured target geometry, never fixed screen fractions pretending to touch controls.
- The story adapts to the measured ledges: begin on the composer edge, approach selected nearby controls, and keep the cat's feet/contact paw on the same measured surfaces as its prizes. If only one safe target is available it receives the complete tentative/decisive push and rebound; if none or the composer is unavailable use the decorative walk. Avoid transporting unrelated distant controls into a fake staging area.
- Reuse animateCelebrationSnapshots for at most two inert copies; do not move React nodes, call controls or copy the composer. One timeline synchronizes actors, contact points and copies. No per-frame layout reads, React renders, dynamic filters or particle loop. Profile before considering canvas.
- Use the Bats cancellation model: direct anchor changes/ancestor attributes stop; ambiguous ancestor child-list changes compare bounded cached geometry, so five-second toast dismissal is harmless. Cancel deferred preparation and all playback on input, focus, pointer, keyboard, scroll, resize, hidden document, source mutation, replacement/unmount or live responsive/reduced-motion changes. Canceled activations never restart.
- Reduced motion or absent WAAPI renders a stationary cat without DOM discovery/copies. All decoration is inert, aria-hidden and pointer-transparent. Use physical viewport geometry consistently in LTR/RTL; responsive decisions use useIsMobile. Existing cat notification remains the only announcement.

## Risks / Trade-offs

- Small viewports or unavailable buttons → select only reachable surfaces and retain a decorative fallback.
- Paw contact can drift when artwork changes → share explicit artwork coordinates with the planner and test projected contacts and impact order.
- Preparation cost or DOM invalidation → bounded descendants/candidates, shared snapshot cleanup and event-driven geometry checks.

## Migration / Rollback

No API/storage changes. Restore old Cat rendering and default duration to roll back. Preserve the Cat-only preview pool and all earlier scene work.

## Open Questions

None blocking; verify actual geometry and performance in the automated browser fixture.
