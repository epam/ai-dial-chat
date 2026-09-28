## Context

`HalloweenExtras.tsx` still renders Skeletons as two 74px stroke-only figures with six infinite CSS loops each (12 animations, ~50 SVG nodes), no page contact and a 10 s deadline. Candy (`halloween-candy-*.ts`) established the measured-only pattern: bounded target discovery, a pure precomputed plan, one shared WAAPI start time, observers used only for cancellation. Footprints established a decorative outline over the composer that reacts to contact while the live input is never touched.

## Goals / Non-Goals

**Goals:** a readable cause-and-effect joke that uses the composer edge as a stage and its corner as the complication; distinct personalities; geometric hand/skull contact; bounded, reversible playback; better artwork at actual size.

**Non-Goals:** DOM snapshots, new anchors, interaction during playback, new strings, audio, a general animation framework or changes to other scenes.

## Decisions

### Cast and roles

- **Showman (A):** plain skeleton, slower easing, big gestures; loses the skull and gropes blindly.
- **Partner (B):** 0.92× scale with an orange bow tie, snappier easing; notices, lunges, catches and fixes.
- **Free skull:** a separate element shown only while detached (A's attached skull hides with a step at the same instant and position).
- **Composer outline:** a borderless-radius-matched decorative outline over the measured composer, like Footprints' ledge; it dips 1.5–3px after landings and the skull impact. The input subtree is never copied, hidden or animated.

### Storyboard (11.5 s, provider deadline 12 s)

| Time (ms)   | Beat                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| 300–1150    | A then B spring from below the viewport onto the edge; landing squash, outline dips after each landing.     |
| 1400–4600   | Eight-beat jig facing each other; A sways wide, B hits beats sharply.                                         |
| 4600–5200   | A winds up (skull tilts back), nods forward, snaps up — the skull launches from its attached position.       |
| 5200–6250   | Skull arcs up, turns in the air (face → back), hits the edge (outline dips), small bounce. A freezes, arms up. B startles. |
| 6250–7900   | Skull rolls with decelerating spin to the composer corner and teeters, rocking harder. A gropes the wrong way; B watches, crouches in anticipation. |
| 7450–7900   | B lunges; at 7900 the hand closes on the skull top as it tips.                                                |
| 7900–9400   | B stands, lifts the skull overhead (hand at the body's axis so the turn has no jump), turns, walks to A, crouches and hops; at 9400 the skull is placed on A's neck — backwards. |
| 9400–10100  | A takes a confused step and shrugs; the skull spins (scaleX through 0) and the face returns.                  |
| 10100–10500 | Both hop in celebration.                                                                                      |
| 10500–11400 | Both hop backward off the edge and drop below the viewport; outline fades.                                    |

The toast message ("found their rhythm") still describes the jig.

### Geometry and contact

All actor coordinates are the top-left of a `100×170` art box scaled by `s` (desktop 0.72, mobile 0.56; B ×0.92). Feet sit at art y=158, so `rootY = ledgeY − 158s`. The attached skull centre is art (50,25) — symmetric, so facing flips do not move it. The free skull renders the same skull art in a `44×44` viewBox centred on (50,25), so the handoff at 5200/9400 is exact.

A single exported pose helper, `skeletonHandPoint`, maps (root, scale, facing, body offset, arm direction) to the scene hand position from the art's shoulder (64,58) and rest hand (78,96). The partner's catch, carry and placement solve the arm direction and root x from the target skull position with this helper; the arm keyframe rotation is `φ − φ₀`. While held, the skull centre is `hand + (0, 20s)` (hand on the cranium top) and is sampled every 50 ms from the same piecewise-linear pose, so the skull never drifts from the hand. The turn at 8300 happens with the hand on the body axis (art x=50), so mirroring does not jump.

Stage: the composer top edge when a composer is visible, at least 220px wide (mobile 200) and at least 150px below the viewport top; otherwise the viewport floor (`height − 6`). The band spans at most 460px (mobile 320px) ending at the composer's far end, so the corner is real. RTL mirrors the whole artwork layer (as Candy does): coordinates are computed in mirrored space so the corner is the physical inline-end corner and no host text is ever mirrored.

### Targets

A local `getSkeletonTargets` reads at most four `anchors.composer` candidates with cached `getBoundingClientRect`/`getComputedStyle` and at most 32 ancestor checks, rejecting hidden, clipped, transformed, masked/filtered or translucent geometry. Focused composers with drafts are allowed because they are only measured. Starter lists are not scanned. The small visibility check is duplicated from Footprints deliberately: one scene does not justify a shared extraction.

### Artwork

Filled bones with a darker edge and a top-left bone gradient replace the stroke-only drawing: cranium with suture, face group (sockets with green glints, nasal cavity, teeth), clavicle, ribcage with rib gaps, spine, pelvis, jointed arms/legs with knee/elbow caps and small hands. The face group can hide to show the back of the skull. Gradient IDs use `useId`. Colours live in SCSS custom-property fallbacks; layout stays in computed inline styles/Tailwind.

### Budgets

| Item                          | Limit                                                   |
| ----------------------------- | ------------------------------------------------------- |
| Characters                    | 2 skeletons + 1 free skull (mobile and desktop)         |
| DOM snapshots                 | 0                                                       |
| Composer candidates / ancestors | 4 / 32 per candidate                                  |
| Animations                    | 21 (A 9, B 8, free skull 3, outline 1)                  |
| Keyframes per track           | 80                                                      |
| SVG nodes (whole scene)       | 100, no filter/mask/image/foreignObject                 |
| Duration / deadline           | 11.5 s / 12 s                                           |

Mobile reduction: smaller scale and a 320px band; the cast is already minimal, so no beat is dropped.

### Lifecycle

The component owns one immutable plan per activation. Preparation is deferred one microtask and cancelled by pointer, keyboard, focus, input/composition, scroll, resize and hidden document. Playback shares one start time, a deadline timer, a `MutationObserver` and `ResizeObserver` on the composer (cancellation only, one geometry recheck on real ancestor child mutations) and the same interruption listeners. Stopping is idempotent and cancels all animations. Reduced motion or missing WAAPI/ResizeObserver renders a static composition — the partner holding the skull out to the headless showman — without measuring anything.

## Risks / Trade-offs

- Nested transforms can break hand contact → the plan exposes contacts and tests reproduce the hand position from the emitted keyframe values.
- A composer near the viewport bottom leaves little room for the entrance jump → the jump starts below the viewport and the layer clips overflow.
- Very wide composers → the band is capped so the roll and lunge stay readable.
- SVG paint cost unknown on low-end phones → node/animation caps enforced in tests; browser profiling recorded in verification with its limitations.

## Migration Plan

No data or configuration migration. Retain scene ID, pool, notification and label. Roll back by restoring the Extras renderer and 10 s deadline.

## Open Questions

None blocking.
