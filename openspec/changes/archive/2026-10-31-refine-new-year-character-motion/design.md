## Context

The user approves SnowmanDelivery and the graphic integrity of Halloween. PenguinStar, GiftWrapping and ReindeerTakeoff are the entire remaining New Year scene set. Normal-speed baseline recordings and frames are in `tmp/new-year-audit/before/`. The new reindeer already use connected landmarks and authored flight poses; this change audits them without forcing another redraw.

## Goals / Non-Goals

Preserve the drawing, central action, page interaction and ending while correcting disconnected motion and weak support/timing. Keep snowman source and all shared runtime/timeline utilities unchanged. No new solver, engine, artwork detail, props, particles, APIs, triggers or strings.

## Decisions

### Penguin

Parent the working flipper to the penguin layer, using its existing shoulder at (20, -47). Compute capture and release from the same local body lean and flipper angle before the stage mirror/scale. This removes independent shoulder drift and the extra RTL sign in capture geometry. Keep the monochrome artwork and glasses intact.

Use explicit walk intervals for entrance, approach and departure. Uniform-time step samples give body travel and alternating short foot lifts the same cadence, including the previously static intermediate approach. Hold both feet during acting. Keep the existing time slots and a quiet attention pose before borrowing. Use a single sampled ballistic star arc with linear segments so it does not brake at each control point. The exact release and fir landing positions remain shared handoff geometry.

### Elves

Preserve the source drawing and compact arm rig, faces, ribbon grips and coil arrangement. Reduce cap swing and body recoil to a useful drawing range. Author the bound master's hop Y channel with eased ascent and accelerated descent, while X travels smoothly across the whole hop. A brief ground compression starts each hop; no extra joints or solver. Ribbon sampling continues to use the same position/lean tracks during winding, before the hopping interval.

### Boundaries and adaptation

Only scene-local composition code and tests change. `CelebrationAnchors` supplies host geometry; existing provider/session code owns interruption, restoration, reduced motion, lazy loading and deadlines. No host integration knowledge or new i18n labels are introduced. Mobile retains the full cast/causal story. Local drawing coordinates are mirrored once for RTL; text remains host-owned. Existing static drawings remain valid because silhouettes are preserved.

### Budgets and evidence

Keep PenguinStar at 20 s, <=120,000 serialized bytes, <=140 generated SVG descendants, <=32 animated properties and <=80 keys/property. Baseline browser: 112 nodes / 47 paths desktop. No added artwork paths.

Keep GiftWrapping at 16 s, two elves, <=12 layers, <=500 SVG descendants / 180 paths, <=240,000 serialized bytes, <=1,400 total keys, <=80 KB minified artwork / 900 vertices and <=80 KB gzip incremental scene/player payload. Baseline: 314 nodes / 165 paths. No new artwork paths or live UI mutation.

Reindeer retains its existing 23 s / 500 KB / 320-node / 140-path limits. No budget increase. Test native shoulder/grip contacts, direction parity, resource ceilings and restoration separately from evaluating pose readability. Browser runs at 360/900/1280/1920 include RTL, light/dark, reduced motion and cancellation. Profile without concurrent builds/tests and report local observations rather than an FPS guarantee.

## Risks / Trade-offs

- Parenting changes release geometry → assert the actual SVG shoulder and handoff in LTR/RTL, including near-transition frames.
- More walk samples could inflate data → retain 80 keys/property and existing byte limits; use sparse authored samples.
- Independent hop channels could desynchronize ribbon geometry → use them only after winding/release is complete; retain the original shared samples during contact.
- Visual preference remains subjective → provide before/after recordings and identify inspected frames; passing tests does not claim user approval.

## Migration Plan

No migration. Revert scene-local changes to restore previous motion. Snowman and shared playback remain unchanged.

## Open Questions

None blocking; the user has specified the reference style and excluded the snowman.
