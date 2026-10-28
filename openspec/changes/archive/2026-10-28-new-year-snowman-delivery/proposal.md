## Why

The New Year gift currently has one click scene (`PenguinStar`, `libs/celebrations/src/new-year/constants/new-year.ts:9`). The secret phrase plays `GiftWrapping`. Repeated clicks always show the same joke. New Year also lacks the kind of physical slapstick that makes the Halloween scenes memorable: a character treats real interface geometry as scenery, the plan goes wrong, and the character recovers.

This change adds "Delivery Without Losing Your Head":

- a slightly pompous snowman borrows a starter-prompt card as a sled to deliver a present to a small tree;
- he brakes in a snowbank, and his head keeps flying into the branches;
- he delivers the present anyway, gets his head back and returns the card.

## Problem

- **One click scene.** The gift click pool contains only `PenguinStar`, so the trigger has no variety.
- **No momentum story.** Neither New Year scene has a story driven by momentum, or a sustained interaction between a character and a borrowed UI prop. The penguin pulls a control towards itself in one throw (`libs/celebrations/src/new-year/utils/penguin-star-selector.ts:2`). The elves only measure the composer.
- **Real layouts differ.** The real host puts the starter list either below the composer (default) or between the greeting and the composer (`starters-below-greeting`, `apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx:500-503`). A scene that rides the composer's upper edge cannot reach a card that sits below it.

## What Changes

- **New scene `NewYearScene.SnowmanDelivery` (`snowman-delivery`).** About 25 s of authored playback, with a 27.5 s mount deadline. Story beats: entrance with a present, idea, borrowing a visual copy of a starter card, testing it and sitting on it, two pushes, a slide that turns smug, snowbank impact, the head flying into the tree, the present delivered, groping for the missing head, a sneeze that knocks the head loose, the head put on backwards and then fixed, the present straightened, the card returned exactly to its slot, and an exit holding the head.
- **Adaptive staging from measured geometry.** The modes, checked in order:
  - **Ledge:** when the starters sit below the composer, a drawn snow ledge runs under the starter row. The snowman reaches up and pulls the card down.
  - **Rim:** when the starters sit above the composer and the band above the composer is free, he rides the composer's snowy upper edge.
  - **Rim with a decorative sled:** used when no card is eligible or reachable.
  - **Self-contained snowy platform:** used when no safe composer stage exists.
- **Synchronized motion.** One scene-local Lottie SVG composition carries the snowman, the present, the tree and branch, the snowbank, the drawn sled and the snow particles. The borrowed card is an inert DOM snapshot driven by WAAPI keyframes, taken from the same plan and started on the same clock. It reuses `animateCelebrationSnapshots` (`libs/celebrations/src/utils/celebration-snapshots.ts:112`), which already accepts a shared `startTime` (`:16`).
- **Narrow session extension.** An optional adapter callback `onPlaybackStarted` on `LottieScenePlayback` tells a scene the document-timeline time at which `play()` succeeded. A synchronized companion animation can then start on the exact Lottie clock. Today the session calls `play()` (`libs/celebrations/src/utils/lottie-scene-session.ts:101`) without telling the adapter when.
- **Pool and labels.**
  - The gift click pool becomes `[PenguinStar, SnowmanDelivery]`, with a random pick as today.
  - The secret phrase still selects only `GiftWrapping`.
  - New label `snowmanDeliveryToastMessage`, with an English default in the library; the host supplies it via `newYear.snowmanDeliveryToastMessage`.
- **Fallbacks.** Reduced motion, unsupported APIs and player-load failure show a static snowman holding his head beside the delivered present and the tree, and borrow no UI.
- **Storybook.** Stories for desktop, mobile, RTL, reduced motion, no starters, starters above or below the composer, unsuitable geometry and interruption.

## Non-goals

- Changing `PenguinStar` or `GiftWrapping` artwork, timing or lifecycle, or migrating `PenguinStar` to the shared session.
- New host anchors, a new trigger, live user control during playback, or sound.
- Moving, cloning or restyling the real composer.
- Any change to chat data, drafts, focus or navigation.
- An event-wide animation engine change.
- A shared starter-eligibility refactor across scenes (noted as a follow-up in design).

## Capabilities

### New Capabilities

- `new-year-snowman-delivery`: the snowman delivery scene. It covers the story beats and their causal order, adaptive staging and fallbacks, card borrowing and exact restoration, synchronization with the Lottie clock, interruption cleanup, accessibility, responsive and RTL behaviour, and numerical rendering budgets.

### Modified Capabilities

- `celebration-events`: the New Year requirement registers the third scene, the click pool becomes `penguin-star` + `snowman-delivery`, the deadlines gain `SNOWMAN_DELIVERY_MS + 2500`, and the labels gain `snowmanDeliveryToastMessage`.
- `new-year-penguin-star`: "Gift activation SHALL select only PenguinStar" becomes "the gift click pool contains PenguinStar and SnowmanDelivery".
- `new-year-gift-wrapping`: "Gift clicks SHALL activate PenguinStar only" becomes the two-scene click pool. The secret-phrase rule is unchanged.
- `celebrations-library`: the New Year entry exports `NewYearScene` with three members (`PenguinStar`, `GiftWrapping`, `SnowmanDelivery`). The spec still lists five, including the removed Snow, Confetti and Sleigh; this is corrected here.
- `celebration-lottie-playback-session`: adds the optional, host-agnostic `onPlaybackStarted` adapter callback and its failure semantics.

## Alternatives considered

| Option | Outcome |
| --- | --- |
| **A. Lottie for the cast and props, plus a WAAPI inert card snapshot on the Lottie clock (chosen)** | One authored timeline for articulated motion. The card stays a real-text visual copy. Synchronization uses a shared start time plus a plan derived from the same rig. Risk: keeping contact between two renderers. Mitigated by grip holds and a contact tolerance tested from the plan. |
| B. Draw the card inside Lottie | Simpler sync, but it loses the "real interface prop" joke: text would need text layers, which the authoring profile forbids. Rejected. |
| C. CSS/WAAPI for everything (Halloween skeleton style, `halloween-skeleton-plan.ts`) | Workable, but an articulated snowman with separate head, scarf and branch motion needs many tracks. The user asked for Lottie. Rejected. |
| D. Animate the real starter button, as PenguinStar does | Moves a live control, and a sled ride needs long, large transforms of a hit target. Violates the copy-only rule in the brief. Rejected. |
| E. Rim staging only, with a drawn sled whenever the card is below the composer | In the default production layout the card would never be borrowed. Rejected by the user in favour of adaptive staging. |

## Acceptance criteria

- **Activation.** A gift click randomly plays PenguinStar or SnowmanDelivery when both are enabled. A host that disables one gets only the other. `happy new year` still plays only GiftWrapping.
- **Story.** Every storyboard beat is present, in order, in desktop, mobile and RTL playback. Specifically:
  - impact order is sled contact → body compression → head continuation;
  - the head leaves at the sled's contact speed (±20 %);
  - the branch recoils;
  - the head is put on backwards, then corrected;
  - the snowman exits visibly.
- **Contact.**
  - Mitten-to-card grips stay within 1.5 CSS px during handling and return.
  - Planted feet drift no more than 0.5 stage units during stance.
  - The card copy ends within 0.5 px of the original rect before the original is shown again.
- **Interruption.** Input, pointer/focus, scroll, viewport/target change, hidden tab, motion-preference change, navigation, load failure and unmount all:
  - restore the original card immediately;
  - remove the copies;
  - release every observer, listener, timer, animation and the Lottie player.

  Repeated activation and cancellation accumulate nothing.
- **Budgets.** The numerical budgets in `design.md` (composition bytes, layers, paths/vertices, SVG nodes, animated properties, keyframes, snapshot size, particles, players, deadlines) are enforced by unit tests. Browser playback and profiling on desktop and mobile are recorded separately in `verification.md`.

## Impact

- **`libs/celebrations` (new-year module).**
  - New scene component, static still, rig/art/targets/composition/card/playback utilities, tests and stories.
  - `NewYearScene`, the labels model, defaults, durations, click pool, `event.tsx` and `NewYearSceneOverlay` are updated.
  - Shared runtime: an optional `onPlaybackStarted` in `models/lottie-scene.ts` and `utils/lottie-scene-session.ts`; existing scenes are unaffected.
  - Scope note: this touches the shared Lottie session, a cross-scene module. The change is additive and optional.
- **Library isolation.**
  - The library uses only the host-provided `CelebrationAnchors` (`composer`, `starterList`, `welcomeRegion`; `apps/chat/src/context/CelebrationHost.tsx:32-38`) and resolved label strings.
  - No routes, i18n, app selectors or host knowledge enter the library.
  - The host keeps supplying translations through `toLabels(Object.values(NewYearI18nKeys), 'newYear', …)` (`CelebrationHost.tsx:81`).
- **`apps/chat` (i18n).** One new user-visible string: the `newYear.snowmanDeliveryToastMessage` key in `apps/chat/src/i18n/locales/en.json` and `NewYearI18nKeys` in `apps/chat/src/constants/translation-keys.ts`. Only `en` exists today.
- **Docs.** The New Year section of `libs/celebrations/README.md` (scene list, click pool, staging modes, fallbacks). `docs/architecture.md` is unaffected: no new lib, context or route.
- **Dependencies.** None new. `lottie-web` light player already exists and stays lazily imported.
- **Rollback.** Fully reversible:
  - remove the enum member, click-pool entry, label and host key;
  - the optional session callback is unused by other scenes and can stay or be reverted independently;
  - no persisted data or contract break: hosts that list `enabledScenes` explicitly keep their selection.
