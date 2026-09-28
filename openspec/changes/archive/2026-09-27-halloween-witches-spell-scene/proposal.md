## Why

### Problem

`HalloweenScene.Witches` currently sends five static broom riders across generic viewport arcs (`libs/celebrations/src/halloween/components/Halloween/HalloweenNightFlight.tsx:139`). It has no character-driven interaction with the page. The user approved the “Wrong spell” concept and requires performance to be a first-class acceptance criterion.

### Solution

Stage a twenty-second lesson between an apprentice and a mentor: nearby buttons grow frog features and hop, the apprentice's broom becomes enchanted, the mentor restores the buttons, and the departing broom makes one final hop.

## What Changes

- Replace the Witches flight with two articulated witches and at most two inert button copies on desktop / one on mobile.
- Keep recognizable button content throughout the transformation and return it to its exact original position.
- Provide a broom-only story without eligible anchors and static artwork with reduced motion or unsupported animation APIs.
- Bound selection, snapshot size, keyframes and active animations; precompute movement and use transform/opacity without per-frame React updates or layout reads.
- Preserve the existing Witches scene ID, click pool, notification key and host API. Give Witches its own 20.5-second mount deadline.
- Document the behavior and cover geometry, cancellation, performance budgets and responsive variants.
- Polish the lesson using the scene skill's motion review: articulated spell origins, ballistic hops with distinct anticipation/landing, delayed secondary motion, curved arrivals/departures and a continuous copy-to-original handoff.

### Non-goals

No game controls, new triggers, audio, physics dependency, provider redesign, host integration changes, persistence or backend work. The existing user edits in `StoryHostPage.tsx` are outside this change.

### Acceptance criteria

- The six agreed story beats are visible, including frog-like buttons, the enchanted broom, restoration and departure.
- The draft, focus, selection, layout, conversation data and ordinary controls remain intact; interaction cancels borrowing immediately.
- Desktop/mobile, LTR/RTL, zero/one/two eligible targets, reduced motion, interruption and repeat activation are covered.
- No per-frame layout reads or React state updates; bounded copies (2/1), at most 40 descendants and 240×64 / 15,360 square pixels per target, finite animation resources and deterministic cleanup.
- Focused tests, relevant Nx checks, library build and docs validation pass; browser playback records visual and resource evidence without claiming unmeasured FPS guarantees.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `halloween-easter-egg`: replace five flying witches with the bounded spell lesson and specify its lifecycle/performance guarantees.
- `celebration-events`: remove the requirement that Witches use generic flying-character paths; retain that renderer for bat fallback and New Year sleighs.

## Impact

The change is inside `libs/celebrations` artwork, utilities, tests, stories and README. Follow `HalloweenBats.tsx` and `halloween-bat-animation.ts` for scene ownership and restoration, and `celebration-snapshots.ts:112` for inert copies. `CelebrationHost` already supplies all required anchors and the mobile flag. No app routes, class constants, i18n, configuration or other host knowledge enter the library.

Alternatives: retain generic flights (cheap but misses the accepted story); add a physics engine (unnecessary runtime/bundle cost); choose precomputed scene-specific WAAPI timelines with existing snapshots.

i18n: reuse `halloween.witchesToastMessage` and its secret-phrase hint; no new user-visible strings. Provider state and public contracts stay unchanged. Rollback restores the previous Witches dispatch and duration; no migration is required.
