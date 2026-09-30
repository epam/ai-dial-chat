## Context

The approved scene uses two elves and a single golden ribbon. Existing New Year scenes are registered in `libs/celebrations/src/new-year/event.ts`; the host already supplies `anchors.composer`, translated labels and `isMobile`. The shared provider retains scene selection and mount lifetime. Scene-local React state owns preparation/termination; a pure plan and a cancellable WAAPI runner own choreography.

## Goals / Non-Goals

Goals: readable character intent, exact hand/ribbon/hat contacts, responsive measured staging, zero host mutation, finite lifecycle and bounded rendering cost.

Non-goals: new engine, API, navigation, audio, interactive puppets, new anchors or provider refactoring. Keep the secret phrase assigned to confetti and preserve event lazy loading.

## Decisions

### Geometry and story

Use one measured composer rectangle, or a small decorative parcel when absent/clipped or lacking safe staging room. Inspect at most four composer candidates and 24 ancestors per candidate. A focused composer is eligible because it is only measured. Screen geometry is physical; direction comes from the anchor's inherited CSS direction, not app i18n. Logical entrance/exit sides reverse in RTL, without reflecting host text.

The elves stand on the upper composer edge and move their hands along its corners. The ribbon comprises a bounded set of static SVG segments revealed/retracted with transforms/opacity. Work poses and prop endpoints share geometry: do not animate an independent ribbon tip that drifts away from the hand. Render rounded corner bends and different front/back layers so the ribbon reads as passing around the present.

Timeline: 0–3 seconds discovery/arrival and reel; 3–7 wrapping and tension; 7–10 tying, caught hat, failed attempt to stand and reaction; 10–14 deliberate release/unwrapping and transfer of bow onto the hat; 14–18 proud pose, bow, reel collection and departure. Movement includes anticipation, planted feet, lean under tension and delayed hat motion. Both characters and every beat remain on mobile, with shorter travel and reduced secondary animation. Total mounted lifetime is 18.5 seconds.

### Artwork and budgets

Two articulated SVG elves with different height, hat silhouette and coat color, readable mitten grips and broad material shading. Static gradients/overlap shadows instead of filters. Artwork is decorative, not UI icons. At most 80 SVG nodes, 40 paths, 800 path commands, 3 gradients, 0 filters/masks and 8 independently animated groups per elf. At most 160 elf nodes total; decorative ribbon/reel/parcel at most 40 further SVG nodes. No particles, snapshots or DOM clone traversal. Count baseline/result and inspect at actual scene size on light/dark surfaces.

At most 32 desktop/24 mobile animations and 640 desktop/480 mobile keyframes across the whole scene. Precompute finite transform/opacity tracks with one document timeline start; no RAF loops, React updates or layout reads per frame. All layout reads belong to preparation or event-driven cancellation checks. New Year stays independently lazy loaded.

### Lifecycle and fallbacks

Preparation stays hidden until the plan exists and can be interrupted before measuring. Register cancellation before asynchronous preparation. Cancel on pointer/key/input/composition/focus, document scroll, viewport/visual viewport changes, relevant target/ancestor changes, target removal, hidden document, environment changes, navigation/unmount and motion preference changes. Ignore mutations made inside the decorative layer. Geometry rechecks are event-driven only. Disconnect observers and listeners, clear timers and cancel animations idempotently on every exit, including animation startup failures. The host is never hidden, copied or styled, so removal immediately restores its appearance.

Reduced motion or missing animation/observation APIs renders a static pair with a hat bow, with no anchor measurement. Missing/unsafe composer retains the full story on a decorative box. The overlay is inert, aria-hidden and pointer-transparent. Existing gift keyboard activation and localized live notification remain the accessible entry/feedback path. The story needs no sound or live pointer control.

### Integration and isolation

Add the enum member, event registration, optional `NewYearLabels.giftWrappingToastMessage` with a default, app `NewYearI18nKeys.GiftWrappingToastMessage` and locale values, scene stories and README behavior. The app adapter already maps enum keys to labels; do not add translation imports to the lib. No feature flag beyond the existing active event and scene-selection settings; no cache, telemetry, persistence, external client, route or generated API changes. No structural architecture change.

## Risks / Trade-offs

- Ribbon contact/occlusion can look detached → shared coordinates for grips and cloth supports, timed screenshots at contact and release, normal-speed recordings.
- SVG transformations can repaint → enforce node/keyframe limits, compare desktop/mobile browser frame intervals and layout/paint profiles; structural tests are not FPS measurements.
- Font/layout changes can move the composer → observe anchor/ancestors and recheck geometry on relevant notifications; stop immediately instead of chasing it.
- Narrow/short viewports cannot support staging → decorative parcel fallback retains plot. No reduced cast.

## Migration Plan

Add one selectable scene; no migration. Hosts can disable `GiftWrapping` with existing selection. Revert registration/artwork/label additions to roll back. Keep the new label optional so existing `NewYearLabels` objects still type-check.

## Open Questions

No product decisions remain: implementation of the accepted concept was explicitly requested. Browser profiling may require local process permissions; report actual measurements and limitations.
