## Why

The New Year gift needs a character scene that visibly uses the start page. A penguin simply throwing a ready-made star does not connect the gag to the application.

## What Changes

- Add `PenguinStar` to the existing New Year scene pool. A potted fir stands near the composer; a black-and-white penguin in sunglasses and a Santa hat enters from the side, pulls an idle starter suggestion (or model selector) into its flipper, crumples it into a star, throws the star onto the fir, reacts, bows and leaves.
- Animate the original eligible control with a single reversible WAAPI transform/opacity effect. It is never clicked, cloned, detached or changed in application state, and returns on completion or interruption.
- Use one native-vector Lottie SVG composition for the characters and star. Keep mobile, RTL, reduced-motion and composer-unavailable fallbacks.

## Capabilities

### New Capabilities

- `new-year-penguin-star`: one finite, interface-aware New Year scene.

### Modified Capabilities

None.

## Impact

`libs/celebrations` receives existing composer, starter-list and model-selector anchors. The app provides the translated toast through its existing integration. No primary chat component, backend, dependency or new host contract changes. Existing New Year scenes and the confetti secret phrase remain available.
