## MODIFIED Requirements

### Requirement: Skeletons lose and recover a skull on the composer edge

`HalloweenScene.Skeletons` SHALL play an 11.5-second finite story with a provider deadline of 12 seconds. Two skeletons SHALL spring onto the measured composer top edge, dance, and the showman's head-bob SHALL launch his skull from its attached position. The skull SHALL bounce on the edge, roll to the composer corner and teeter while the headless showman gropes. The partner SHALL catch the skull at the corner, carry it back and place it on the showman's neck backwards; a spin SHALL restore it. When a reachable greeting word exists, the partner SHALL then grab the last word of the start-page greeting heading, land with it and jump off the edge while the showman follows; the word SHALL be thrown back and restored in place before the timeline ends. Otherwise both SHALL celebrate and drop below the viewport.

The component SHALL own one immutable activation plan and finite animation lifetime. The provider SHALL retain selection, trigger, notification and replacement; the existing `skeletonsToastMessage` SHALL remain. No public API, translation, feature flag, persisted state or telemetry SHALL be added; the scene is not gated by `ENABLED_FEATURES`, adds no endpoint, cache or memoisation requirement, and stays an `aria-hidden`, `inert`, pointer-transparent decorative layer with no keyboard target of its own.

#### Scenario: Complete desktop story

- **WHEN** Skeletons plays uninterrupted with a visible composer
- **THEN** both skeletons land on its top edge, the skull detaches, bounces, rolls to the corner, is caught and is restored in order
- **AND** the partner's hand touches the skull from the catch through placement, and the skull stays hidden on the showman while detached

#### Scenario: The partner steals a greeting word

- **WHEN** the welcome region above the composer has a visible greeting heading whose last word is within the partner's reach and the CSS Custom Highlight API is available
- **THEN** the original word is hidden only visually at the grab contact while an inert copy follows the partner's hand
- **AND** the copy returns to the word's exact position before the highlight is removed at the end of the timeline
- **AND** the heading's DOM, text, focus and selection are never changed, and any interruption removes the highlight immediately

#### Scenario: No composer is available

- **WHEN** no safe composer is measured
- **THEN** the same beats play on the viewport floor without an outline or a greeting theft

#### Scenario: Mobile, RTL and reduced motion

- **WHEN** the host selects mobile mode
- **THEN** the same cast and beats play at a smaller scale within a narrower band
- **WHEN** the host is RTL
- **THEN** the artwork layer mirrors so the corner is the physical inline-end corner, while no host content or stolen word text is mirrored
- **WHEN** reduced motion is requested or WAAPI/ResizeObserver are unavailable
- **THEN** a static composition shows the partner offering the skull to the headless showman, without measuring targets or starting animations

### Requirement: Skeletons playback is bounded and reversible

Skeletons SHALL measure at most four composer candidates and one greeting heading (at most 16 text nodes) with cached reads and at most 32 ancestor checks, SHALL create no DOM snapshot and SHALL never animate, hide or mutate a live control or its text. It SHALL use at most 22 animations, 80 keyframes per track, 100 SVG nodes and two timers besides the deadline, without filters, masks, raster images or per-frame geometry reads or React updates.

#### Scenario: Interaction interrupts the skeletons

- **WHEN** typing/composition, pointer/focus, scrolling, resize, a relevant composer or greeting change, a hidden document, changed mobile/motion/anchor settings, replacement or unmount interrupts playback
- **THEN** all owned animations, timers, highlights, listeners and observers are released idempotently and the draft, focus and selection are unchanged
- **AND** cancelled preparation cannot restart later
