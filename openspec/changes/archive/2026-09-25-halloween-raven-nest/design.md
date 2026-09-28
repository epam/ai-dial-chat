## Context

Before this change, `HalloweenRavens` in `HalloweenExtras.tsx` had five/eight SVG actors and CSS-only departures. `HalloweenMimic` and `celebration-snapshots.ts` already couple actors to reversible UI copies through a common WAAPI start time. The shared provider owns scene replacement, notifications and its deadline. This change remains inside that application decoration boundary.

## Goals / Non-Goals

Deliver the approved sequence: arrival, tearing small, recognizable UI fragments from separated sources, nest construction on the pumpkin, two ravens tugging a conversation, release and collision with the nest, pumpkin shake and restoration. Support mobile, RTL, interruption and reduced motion with bounded work. No shared-component/library changes, new APIs, translations, audio or general event renderer.

## Decisions

- Extract `HalloweenRavens.tsx` and its own stylesheet; keep reusable raven artwork nearby. The scene owns one measured plan and its cleanup, with no React state updates during playback.
- Precompute a shared physical-coordinate timeline in `halloween-raven-plan.ts`. Cargo endpoints determine both beaks, including tugging, recoil and flight. Use WAAPI transforms/opacity for actors and copies; SVG paths supply thin peeled strips and the nest. Precomputed turns align the artwork with both axes of travel, including steep climbs and descents, while grounded tugging keeps its grip. The flight flag describes the incoming segment: landing and the initial row lift are airborne; the following tug or peel is braced. Rotation belongs to the artwork around the beak, so neither row nor fragment contact depends on its heading. No per-frame DOM reads or animation-frame loop.
- Discover a bounded set of visible targets in `halloween-raven-targets.ts`: existing pumpkin marker, public composer class and visible history rows, plus headings and buttons within the welcome region. Skip hidden, clipped, focused or expanded history controls. Prefer one modest conversation row; fall back to a decorative strip at the composer when history is absent. Missing pumpkin uses a visible composer corner for the nest; a completely missing UI uses a static flock.
- Use the existing snapshot helper for one borrowed conversation, with at most five clipped sections of its frozen visual copy to bend the row. Cap source complexity before copying. The original remains in React, with unchanged text, IDs, focus and persistence. Collectors use up to three/six additional cropped fragments, each at most 76×32px and from a subtree with at most 16 descendants. The shared app-owned snapshot helper accepts an opt-out from hiding the whole original; only the cropped source area is visually masked. Collection never copies the entire composer. Pumpkin shaking is a temporary WAAPI transform that is canceled with the scene.
- Limit to five/eight ravens, three/six unique material sources separated by at least 96px and a small fixed nest. Select spatially separated headings, controls and rows; use border corners only for sparse layouts. Stagger deliveries by at least 600ms, pause just 144ms, then immediately leave along independent routes. Collectors do not wait in a cluster. Use one shared start time and finite keyframes. Profile the actual scene at normal and throttled CPU; a canvas is a measured fallback for decoration, not a prerequisite or a rewrite of all scenes.
- End by twelve seconds with a thirteen-second provider deadline. Interactions, resize, scroll, tab hiding, target changes, unmount and live reduced-motion changes cancel animations and restore borrowed UI. Reduced motion shows stationary birds without copying or shaking real UI.
- Keep `halloween.ravensToastMessage` and the existing secret-phrase hint unchanged. Physical target rectangles determine attachment in LTR/RTL; `useIsMobile` determines flock size. SVG artwork is decorative, pointer-transparent and aria-hidden; copies are inert.

## Risks / Trade-offs

- A split visual row can show seams → use a small fixed number of overlapping clipped sections, common transforms and contact-geometry tests; inspect browser screenshots.
- Computed-style cloning can be expensive → copy at most one small row (80 descendants) and six tiny fragment subtrees (16 descendants each), never snapshot the composer and benchmark startup separately from playback.
- UI can change while borrowed → reuse snapshot restoration and cancel the complete scene on target mutation or interaction.
- No eligible history/pumpkin → use the approved composer-strip fallback and a composer corner; never open panels or change layout to obtain targets.

## Migration Plan

Only the raven renderer and deadline change; all event registration remains compatible. Revert these files to restore the old perched flock. No migration or persisted state exists.

## Open Questions

None. Timings and contact alignment have been checked in the isolated browser fixture.
