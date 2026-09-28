## MODIFIED Requirements

### Requirement: Spiders visibly weave their webs

The web celebration SHALL show 54 weaving spiders on mobile and 80 on desktop, sized 16–21 and 21–27 CSS pixels respectively. Small spiral sections (40–68 CSS pixels on mobile, 64–108 on desktop) SHALL connect through bowed horizontal, vertical and diagonal silk threads into one continuous network covering almost the whole viewport, including the visible history panel. Every section SHALL belong to this connected network. Each celebration SHALL randomize positions within coverage cells, arrival order, spiral rotation, weaving speed, diagonal connections, thread sag and escape direction. Threads and sections SHALL progressively appear over shuffled delays spanning 4.2 seconds; the shared web SHALL remain visible while spiders finish weaving.

Some sections SHALL attach to corners of visible composer, welcome or conversation-history elements and the main pumpkin using a bounded snapshot of at most twelve UI rectangles. The visible pumpkin SHALL receive a target before conversation rows fill this budget, with its target inset to the pumpkin body rather than the empty corners of its artwork. These corner webs SHALL stay within their target bounds and join the same network. Missing or hidden targets SHALL fall back to random viewport coverage. No real element SHALL be moved, hidden, restyled or cloned. Physical viewport coordinates SHALL preserve attachment in LTR and RTL.

Spokes SHALL appear first, followed by scalloped silk. Each spider SHALL follow the same geometry as its growing silk, then travel smoothly towards a viewport edge. Webs SHALL gently fade. Every delayed departure SHALL finish before the shared fourteen-second cleanup. Navigation away SHALL remove the layer immediately. All layers SHALL pass through clicks and focus and SHALL NOT change or persist history.

`HalloweenWebScene` SHALL own transient drawing state and precomputed geometry. The scene SHALL use one visible canvas and at most one animation frame chain, bounded to 30 draws per second, without per-frame React state updates or layout reads. Completed silk and spider artwork SHALL be cached only for the scene lifetime. Raster scale SHALL be at most 1.5 and each viewport backing surface SHALL be at most three million pixels. Unmount, replacement, scrolling, resizing or a hidden document SHALL cancel pending work and release cached surfaces.

Under reduced motion, complete webs and stationary spiders SHALL appear in their final positions until cleanup with no animation loop. The scene SHALL remain decorative and aria-hidden, gated by the existing `UI_EVENT=halloween` selection, with unchanged notifications and no new API, strings, telemetry or persistent state.

#### Scenario: A connected web covers the viewport

- **WHEN** random pumpkin selection activates the web scene
- **THEN** 54 spiders on mobile or 80 on desktop weave one connected network with randomized arrival, weaving and escape paths
- **AND** the effect passes through interaction and finishes before the fourteen-second cleanup, with a static complete web under reduced motion

#### Scenario: Webs attach to the interface

- **WHEN** visible composer or conversation-history targets exist
- **THEN** some spiders weave corner sections anchored within those targets, connected to the viewport mesh in either text direction
- **AND** the real elements retain their layout, contents, focus and interactions

#### Scenario: Rendering work is bounded

- **WHEN** a dense web scene runs
- **THEN** one visible canvas composites cached silk and sprites at no more than 30 draws per second without reading layout per frame
- **AND** stopping or replacing the scene leaves no pending animation frame or scene-owned cache

#### Scenario: The main pumpkin is covered in silk

- **WHEN** the pumpkin is visible and the web scene starts, including with a long conversation history
- **THEN** spiders weave on the pumpkin body and connect its silk to the same viewport network without adding spiders or exceeding twelve targets
- **AND** the pumpkin button remains clickable and retains focus in LTR and RTL
