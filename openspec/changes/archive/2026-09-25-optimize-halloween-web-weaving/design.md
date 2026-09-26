## Context

The existing web scene mounts 54/80 copies of detailed SVG spiders plus animated spokes, spirals and connecting threads. Layout is randomized in a percentage grid without page anchors. CelebrationProvider already owns replacement, navigation cleanup, notifications and the fourteen-second deadline.

## Goals / Non-Goals

Goals: reduce rendering work, make spiders readable, weave on interface edges and retain full-screen connected coverage. Non-goals: changing other scenes, global providers, libraries, APIs, settings or data. No new strings, telemetry or persistent cache.

## Decisions

- Keep lifecycle and transient state in `HalloweenWebScene`. Replace independent SVG animations with one canvas and one frame loop, capped at 30 draws per second. Cache finished silk on a scene-local backing canvas; paint only newly completed segments, then composite it with cached spider sprites. Bound pixel ratio and total raster area. This avoids both repeated SVG style/paint work and retracing completed geometry every frame.
- Precompute numeric paths once per activation in `halloween-web-plan.ts`. Preserve 54/80 spiders and shuffled arrival over 4.2 seconds, then use the same silk polyline for progressive drawing and spider position. Increase spiders independently of patch size, to 16–21 CSS pixels on mobile and 21–27 on desktop. Use randomized edge escapes that finish before fourteen seconds.
- Discover at most twelve visible rectangles through app-owned public selectors, following `halloween-spider-theft.ts`. Include the main pumpkin through its existing seasonal anchor before conversation rows fill the target budget, insetting the button rectangle to the artwork's body so silk crosses the pumpkin itself. Attach quarter webs to selected corners inside these rectangles and connect them to the random mesh. Read layout only at setup, never in the frame loop. Physical viewport coordinates naturally match both LTR and RTL; no mirrored target coordinates.
- Keep the canvas decorative, aria-hidden and pointer-transparent, with no focusable descendants or mutation of real page elements. Reduced motion paints the finished scene once without starting a loop. Cleanup cancels frames and releases backing canvases; scroll, resize and hidden documents stop the scene so stale anchors do not float over relocated elements.
- Keep `UI_EVENT=halloween`, scene selection and notification behavior unchanged. A missing composer/target uses the viewport network; a missing canvas context skips this decorative effect safely. No new loading or error UI.

## Risks / Trade-offs

- Canvas can blur on high-density screens → cap raster scale at 1.5 and area at three million pixels, while keeping CSS geometry precise.
- Target selectors can miss future page structures → use existing exported composer classes and history selectors, with bounded discovery and coverage fallback.
- Bitmap drawing could still cost too much → compare browser task/style/layout timings against the previous scene in the same isolated fixture, and record limitations.

## Migration Plan

No migration. Roll back by restoring the old web branch; runtime and scene IDs stay unchanged.

## Open Questions

None.
