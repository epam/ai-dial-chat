## Context

The earlier penguin scene threw a star that already existed. Browser frames showed that a brief selector ricochet was hard to read as an interaction. The new story makes the page element itself the raw material for the star. The supplied visual reference remains a front-facing black-and-white penguin with sunglasses; a restrained Santa hat makes it seasonal.

## Decisions

### Choreography and handoff

One 20-second native-vector Lottie composition renders the stationary potted fir, penguin, crumpled paper and star. The penguin walks directly in from the side of the visible start-page stage, settles opposite the fir, reaches for a page control around 5.1 seconds, visibly crushes the arriving control into a paper ball around 6.7 seconds, reveals the star around 7.6 seconds, throws at 8.5 seconds and lands it on the fir at 10.7 seconds. It watches the fir react, approaches, bows and leaves alone. The original control's 1.6-second WAAPI motion runs between the reach and paper-ball appearance. At any interruption it is cancelled and instantly returns.

Choose the closest idle starter button to the penguin from the host-provided `starterList`, scanning at most four. If none qualifies, choose one idle `composerModelSelector` button from the composer, again scanning at most four. Controls must be visible, viewport-contained, connected, untransformed, reasonably sized, unfocused and enabled. They remain in their DOM position; only a transform and opacity are animated. No click, focus, value, inline-style or data mutation occurs. The temporary visual absence is intentional for the gag. Any user input, focus, scroll, resize, target change or tab hiding interrupts and restores the element. If neither control qualifies, the paper ball is decorative and no host control moves.

The Lottie plan and DOM motion share one measured flipper capture point. The borrowed control flies to it and shrinks; a crumpled paper layer takes over at the end of that motion, then a growing star takes over at the same point. The star flies above composer controls before landing on the fir crown. The fir's pot stays planted, and the star inherits fir rotation once attached. Character poses use eased walks, slight body weight shifts, flipper motion and head turns rather than position jumps. The tree and penguin remain close enough to read as one scene.

### Stage and fallbacks

Measure the composer, welcome heading and starter list once. Keep the cast and star clear of host text; when that cannot fit on the composer rim, use a small decorative snow stage below the composer while still permitting an eligible control to fly into the scene. No new main-component code or host anchor is needed. RTL mirrors the choreography and chooses the corresponding side entrance. On mobile, scale the artwork and shorten the horizontal gap while retaining the entire story. Reduced motion, unsupported observers or player failure shows static penguin/tree/star art without borrowing a control or loading Lottie.

### Runtime and budgets

The scene owns one lazy-loaded light Lottie player, one short WAAPI animation and existing geometry observers. No per-frame DOM reads, React updates, cloned controls, SVG `foreignObject`, filters, masks, raster images or network assets. Keep the serialized composition at most 120 KB, artwork below 140 SVG nodes, at most 32 animated properties and 80 keys per property. The provider's deadline is 22.5 seconds including import/readiness. On cleanup destroy the player, cancel the borrowed-control animation, disconnect observers and remove listeners/timers.

## Risks and verification

- Visual handoff may look like teleportation: assert shared capture coordinates and inspect ordinary-speed Chromium playback at mobile and desktop sizes.
- Animated control may be needed by the user: stop and restore immediately on input/focus/scroll and test completion plus interruption.
- Target movement may obscure UI: select only eligible idle controls and keep the scene pointer-transparent; verify text and composer remain readable in LTR and RTL.
- Long SVG playback may cost too much: enforce structural budgets and profile browser frame/layout behavior before shipping.
