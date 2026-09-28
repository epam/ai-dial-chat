## Why

The dense web scene animates hundreds of SVG paths and repeats detailed spider artwork 54/80 times, making the start page sluggish. Its webs are scattered independently of the interface and its weaving spiders are too small to read.

## What Changes

- Draw progressive connected silk and slightly larger spiders using one bounded canvas animation, retaining finished threads instead of animating every SVG path.
- Attach some webs to visible composer, welcome, conversation-history and main-pumpkin geometry; keep randomized coverage across the rest of the viewport.
- Preserve counts, randomized weaving/departure, click-through behavior, reduced motion and the fourteen-second deadline.

Non-goals: changing core components, libraries, event selection, other scenes, APIs, dependencies, persistent data or strings. Acceptance: visible corner webs on interface elements, unchanged connected coverage, larger spiders, a bounded drawing loop with no per-frame layout reads, and a measured reduction in scene browser work.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `halloween-easter-egg`: Efficient connected web weaving with larger spiders and interface anchors.

## Impact

Replace the web branch of `apps/chat/src/components/Halloween/HalloweenBurstOverlay.tsx:51` and the per-patch `HalloweenWeb.tsx:35`. Follow the scene-owned lifecycle of `HalloweenTrain.tsx:15` and public-selector discovery in `utils/halloween-spider-theft.ts:80`. No global provider or library changes; no new i18n strings.

Reducing spider counts would sacrifice the requested coverage; combining SVG spokes alone would still leave many animated paths. A cached canvas keeps the dense scene while bounding DOM and animation work. State stays local to the scene. The change is internal and reversible by restoring the previous web renderer; no data migration is required.
