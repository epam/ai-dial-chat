## Context

The shared runtime already selects secret scenes independently of clicks, and `useLottieSceneSession` owns bounded loading, readiness, playback and disposal. SnowmanDelivery demonstrates an inert snapshot driven from `timelineZeroMs`. Reuse these contracts without changing shared providers.

## Goals / Non-Goals

Deliver the approved two-reindeer story with visible anticipation, hoof planting, load transfer, nose/loop contact and a complete exit. Preserve both characters on mobile. No audio, backend, new contexts or direct user control.

## Decisions

- Keep one 23-second native Lottie composition and the existing bounded session. Measure the composer once and place hooves at its upper edge, rather than below the page. The ground phase clips to the composer width; the clip opens to the welcome-region width at takeoff. Both characters and the sleigh remain visible through the airborne recovery before exiting; the flight arc leaves a clear upper band for the announcement.
- A disposable DOM mirror measures the first visible word of the textarea value, or its native placeholder when empty. Read at most 512 characters and copy at most 32 Unicode characters, within 280 × 48 px. Inherit native typography, direction, ink and the nearest flat opaque background. A rectangular cover and one inert text span borrow only that word's pixels. Never clone, hide, style, focus, edit, select or animate the textarea itself. Scrolled/clipped, invisible, transparent-ink or non-flat-background text is not borrowed.
- The ribbon catches the word. Two pulls lift its copy above the input; the second lift positions it at the calf's nose while its hooves stay on the rim. The calf turns, walks along the rim, tries once, then lifts the loop. The word returns before takeoff. The live value, placeholder, selection, focus and undo state remain host-owned.
- Grounded steps advance by traveled distance: a planted sole stays at one stage coordinate, two 28-unit leg segments solve the contact, and the hoof counter-rotates. Fore/hind bends differ and the four contacts are staggered. The body compresses and leans about its hip line; short recovery steps reset the stance after a pull. A brief blink supports the calf's quick facing change; its silhouette never scales through a narrow shape.
- A shared Hermite flight arc preserves velocity at joins. The calf starts 0.2 seconds after the adult and the sleigh 0.35 seconds after it; spacing recovers smoothly before departure. The sleigh pitches with a small decaying recoil. Harness endpoints, the carried loop and snow emission use the rendered body/sleigh transforms.
- Compute word displacement, nose contact, reins and cast from one authored timeline. The word's transform and visibility and the ground clip use at most four WAAPI animations on the same frame-zero clock. No per-frame measurement or React updates.
- Snow is deposited at past positions of the flying sleigh, drifting gently downward and fading over at most 2.8 seconds. Use 24 fixed snow clusters on desktop and 16 on mobile. The wake persists briefly after the formation leaves and disappears by the scene deadline.
- Keep the chestnut adult, smaller scarf-wearing calf, sleigh and 23-second story. Mobile fits the cast to the input width. RTL mirrors vector geometry and travel; copied text retains its original direction. A missing word uses the small drawn catch on the rim; a host with no anchors has a decorative stage. An invalid supplied composer, insufficient headroom, reduced motion, unsupported API or load failure uses the existing static resolution.
- Input, focus, pointer, scrolling, viewport/target/direction changes, hidden tabs, navigation and unmount cancel all owned resources. Observe placeholder/value attribute changes as well. Host labels and DOM anchors remain the only app integration; no new strings, API, context, routing, persistence or dependencies.

## Character revision

The user's remaining concerns are appearance and lifelike movement. Retain the story and engine; redraw the existing native shapes and author differentiated poses rather than add another solver or effects. The adult has a fuller chest, continuous neck contour and restrained expressions; the calf has a rounder face, smaller antlers, different proportions and curious ear/gaze reactions. One articulated neck carries the head and its nose probe, keeping contact geometry shared. Grounded feet retain distance-driven support, with distinct fore/hind bends and staggered steps. Flight transitions from extension to tuck and settled gliding rather than continuing a walking cycle in the air. Quiet holds separate effort, noticing the catch and satisfaction after release. Inspect the pull-to-reaction passage at actual size before validating the entire timeline. Keep all existing payload/node/key budgets and all host/cleanup contracts.

## Performance budgets

One player, two deer, one sleigh; one borrowed word <=32 characters / 280 × 48 px using two inert DOM elements. Preparation scans <=4 composers, <=4 textareas, <=24 background ancestors, and measures one disposable mirror of <=512 characters at a time. At most four WAAPI companions. Playback/import/readiness/provider limits remain 23000/2000/250/25500 ms. Composition <=500 KB UTF-8, <=24 layers, <=110 animated properties, <=7000 total keys, <=380 keys per property, <=320 generated SVG nodes, <=140 paths and <=2000 distinct path vertices. The snow wake uses the existing property/node allowance (24/16 clusters). The 500 KB / 7000-key / 380-key-per-property ceilings fund eight solved legs and counter-rotated soles: denser samples are restricted to walking, then pruned to 1.5 degrees; body positions use 0.25-unit tolerance; scalar angles are quantized to tenths of a degree. Scalar/vector/shape keys store each start value once, using the following start as the endpoint. Native browser checks require planted sole error <2 px and inter-frame drift <2.5 px at 30 fps. No SVG node is added for the physics; no raster assets, remote assets, filters, masks or unbounded particles.

## Risks / Trade-offs

- Textarea glyphs have no DOM ranges: use a disposable mirror with the native metrics and verify actual placeholder/draft positioning in Chromium. Non-flat backgrounds use the decorative catch rather than an incorrect rectangular cover.
- Rim width limits the supported ground path: enter through its leading edge, then open the stage only at takeoff. Check desktop/mobile/RTL support and airborne bounds separately.
- A snow wake increases SVG work: retain fixed counts, quantized paths and payload budgets, profile normal-speed playback, and verify cancellation without resource growth.
- This remains a compiled local scene, not an external celebration pack.

## Migration Plan

Register the scene and translated optional label, add it only to the secret pool, update README and the event spec. Rollback by removing the pool entry or disabling the scene through existing selection.

## Open Questions

None blocking. Browser profiling establishes actual frame cost; structural limits alone do not promise a frame rate.
