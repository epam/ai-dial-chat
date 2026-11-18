# Proposal

## Why

### Problem
The current New Year stories are acceptable to the user, but their artwork and staging do not match the appeal of the Halloween references. Fresh 360/1280 px captures show segmented reindeer contours, weak penguin pose variation, crowded elf/ribbon staging and a cramped snowman head catch. The published Themes bullfinch also collapses to 4% width when turning and is too small at the viewport bottom.

## What Changes

### Solution
- Refine scene-local vector artwork and working poses for ReindeerTakeoff, PenguinStar, SnowmanDelivery and both GiftWrapping versions, preserving casts, stories, timing, grips and finite lifecycle.
- Improve mobile-readable character shapes and crowded staging without introducing another engine or general-purpose rig.
- Prepare a compatible immutable Themes pack 1.1.1 with volume-preserving bullfinch turns, better stage scale/position and synchronized elf artwork. Keep earlier versions intact; publication is outside this change.

### Non-goals
No plot rewrite, event-pool changes, remote publication, new player, host/API contract, strings, telemetry or dependency. No edits to Halloween or the local celebration skill.

### Acceptance criteria
- Before/after working poses at actual 360/1280 size show connected reindeer contours, more distinct penguin poses, readable elf silhouettes/ribbon and separated snowman head/branch forms.
- External bullfinch turns preserve character width and the courier action has viewport clearance on mobile and desktop.
- Existing scene-specific data/SVG/keyframe budgets, contact, RTL, interruption and reduced-motion contracts pass; visual evidence is recorded independently of test results.
- Both elf implementations use the revised design; Themes hashes, bytes, posters and local index are consistent and previous versions remain untouched.

## Capabilities

### New Capabilities
None in Chat; external pack artwork remains authored data in the companion Themes repository.

### Modified Capabilities
- `new-year-reindeer-takeoff`: coherent rendered body contours and readable calf artwork.
- `new-year-penguin-star`: recognizable monochrome artwork with distinct working poses.
- `new-year-snowman-delivery`: volume-aware artwork and readable head/branch separation.
- `new-year-gift-wrapping`: refined character artwork and staging shared by compiled and pack versions.

## Impact

Changes remain in scene art/composition/targets/fallbacks and focused tests under `libs/celebrations`. Existing scene-local models are `libs/celebrations/src/new-year/utils/reindeer-art.ts:255`, `penguin-star-art.ts:205`, `snowman-delivery-art.ts:129` and `gift-wrapping-composition.ts:207`. Host geometry continues through existing anchors; no app integration knowledge enters the library. Existing decorative-artwork palette exception applies. No i18n keys are introduced.

A companion Themes patch edits authored JSON/SVG and adds a versioned pack; no code generator runs at build or publication. Scene-local corrections were chosen over a new engine/rig or a full redraw: they preserve contacts and bound delivery risk. Backward compatible; revert Chat edits and point the Themes default back to 1.1.0 to roll back. Publishing or changing a running environment is not part of this implementation.
