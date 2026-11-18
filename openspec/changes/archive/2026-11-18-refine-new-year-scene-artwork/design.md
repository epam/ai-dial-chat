# Design

## Context

See proposal.md for motivation. The baseline audit is in ignored `tmp/celebration-art-audit`: native current-code frames at 360/1280 and matching deployed Themes 1.1.0 bytes. Each scene already owns an articulated vector composition, target selection, inert rendering and cleanup. Existing scene contracts are the source for limits.

## Goals / Non-Goals

Make a visible improvement in a representative working pose before extending changes. Preserve root paths and contact landmarks wherever artwork alone solves the problem. This is not an engine migration, shared-rig refactor, new scene or plot change. No new labels or host integration.

## Decisions

1. Re-author vector contours/shadow masses and selected poses in scene-local files. Keep established pivots, nose/palm/socket positions and existing planners; adjust geometry consumers together only when needed. A more detailed rig was rejected because current issues are predominantly drawing and staging.
2. Keep existing measured composer/support mechanics. Improve negative space and cast placement within them; do not move live controls, introduce app-specific class knowledge or poll the DOM during playback. The host still supplies anchors and mobile mode. RTL mirrors art through existing transforms; copied text is never mirrored.
3. Modify external authored JSON/SVG directly as pack 1.1.1 in the companion Themes project. Temporary authoring helpers do not become build/publication generators. Old immutable versions stay unchanged; the reviewed local default may select the new version, but deployment is not performed.
4. Preserve numerical budgets: Penguin 20s/120KB/140 SVG nodes/32 animated properties/80 keys per property/one borrowed control; Elves16s/240KB/12layers/500nodes/180paths/1400keys/two characters/zero snapshots; Snowman25s/170KB/16layers/1300keys/56desktop or48mobile properties/one card copy; Reindeer23s/500KB/320nodes/140paths/7000keys/24desktop or16mobile snow clusters/two word elements; Bullfinch14s/120KB/19layers/311nodes/162paths/2000keys/two birds/zero copies. Artwork changes replace existing shapes where possible. Payload sizes refer to authored data before Lottie normalizes it, not mutated player data.
5. Keep broad shading inexpensive: no new blur, filter, mask, particle, player or continuous measurement. Missing anchors, interruption and static reduced-motion resolutions retain complete cleanup and revised artwork.

## Risks / Trade-offs

- Altered contours can break contacts → preserve landmarks and run existing native geometry checks after artwork changes.
- Scaling or moving the cast can obscure text or clip limbs → inspect the whole actor/ribbon envelope at360/900RTL/1280/1920, including static fallbacks and dark backgrounds. UI overlap is assessed by action readability, not a blanket prohibition.
- External and compiled elf assets can drift → compare the same working poses and keep revised native groups aligned while preserving each delivery mechanism.
- Automated geometry and recording do not establish appeal → record exactly which poses/playback were inspected; keep unperformed continuous-motion assessment explicit. Do not assign a manual testing task to the user or declare that task complete from metrics alone.

## Migration Plan

No public API or state migration. Deliver source and a new local Themes version for review. Publishing is separate. Roll back by reverting the scene changes and restoring the Themes default to1.1.0; existing immutable files remain available.
