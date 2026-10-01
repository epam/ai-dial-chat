# @epam/ai-dial-celebrations

Seasonal start-page celebrations with lazily loaded Halloween and New Year scenes that hosts can switch on and off one by one.

## Overview

`@epam/ai-dial-celebrations` adds seasonal easter eggs to a chat start page: a decoration with a clickable trigger (a pumpkin, a gift), full-screen animated scenes that play when the trigger is pressed, and an optional secret phrase that plays a hidden scene instead of sending the message. The runtime is a React provider that owns playback — which event is loaded, which scene is playing and when it ends — while the host decides everything the library cannot know: which event is active and on which page, how texts are translated, how notifications are shown, whether the layout is mobile, and which DOM elements scenes may borrow. Each event lives in its own entry point (`./halloween`, `./new-year`) and is loaded only when selected, so a host that never enables New Year never downloads it. Hosts can disable individual scenes, individual decoration behaviors and the secret phrase per event. Every scene respects `prefers-reduced-motion`, all artwork is `aria-hidden` and pointer-transparent, and scenes that borrow interface elements restore their original appearance on completion or interruption.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-celebrations": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-celebrations/styles.css';
```

## Peer Dependencies

- `react`
- `react-dom`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`

## Components

### CelebrationProvider

Owns celebration playback. Every host concern arrives as a prop; the library reads no router, i18n, config or storage. Pass `null` as `activeEventId` wherever celebrations must not appear.

```tsx
import {
  CelebrationProvider,
  type CelebrationAnchors,
  type CelebrationEventLoader,
} from '@epam/ai-dial-celebrations';
import { HalloweenScene } from '@epam/ai-dial-celebrations/halloween';
import type { FC, ReactNode } from 'react';

const EVENTS: Record<string, CelebrationEventLoader> = {
  halloween: () => import('@epam/ai-dial-celebrations/halloween'),
  'new-year': () => import('@epam/ai-dial-celebrations/new-year'),
};

const ANCHORS: CelebrationAnchors = {
  composer: 'my-composer',
  starterList: 'my-starters',
  historyContainer: 'my-history',
  historyRowLink: 'a[href^="/conversations/"]',
};

interface HostProps {
  children: ReactNode;
  isStartPage: boolean;
  navigationKey: string;
  isMobile: boolean;
  notify: (title: string, message: string) => void;
}

export const CelebrationHost: FC<HostProps> = ({
  children,
  isStartPage,
  navigationKey,
  isMobile,
  notify,
}) => (
  <CelebrationProvider
    events={EVENTS}
    activeEventId={isStartPage ? 'halloween' : null}
    resetKey={navigationKey}
    isMobile={isMobile}
    anchors={ANCHORS}
    onNotify={({ title, message }) => notify(title, message)}
    selection={{ halloween: { disabledScenes: [HalloweenScene.Cat] } }}
  >
    {children}
  </CelebrationProvider>
);
```

| Prop              | Type                                              | Description                                                                  |
| ----------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| `events`          | `Record<string, CelebrationEventLoader>`          | Loaders keyed by event id; resolve to the module or the event itself.        |
| `activeEventId`   | `string \| null`                                  | Event to show; `null` for none.                                              |
| `resetKey`        | `unknown`                                         | Any value whose change cancels the active scene and reloads the event.       |
| `labels`          | `Record<string, Record<string, string>>`          | Label overrides keyed by event id, merged over the event's English defaults. |
| `onNotify`        | `(notification: CelebrationNotification) => void` | Called once per played scene with a resolved title and message.              |
| `isMobile`        | `boolean`                                         | Whether scenes use their mobile layout. Default: `false`.                    |
| `anchors`         | `CelebrationAnchors`                              | Host DOM hooks interface-borrowing scenes may measure.                       |
| `selection`       | `Record<string, CelebrationEventSelection>`       | Per-event scene and decoration selection keyed by event id.                  |
| `portalContainer` | `Element`                                         | Where scenes render. Default: `document.body`.                               |

### CelebrationDecor

Renders the active event's decoration and trigger; place it inside the start-page region.

```tsx
import { CelebrationDecor } from '@epam/ai-dial-celebrations';

export const StartPage = () => (
  <main role="region" aria-label="Start page" className="relative">
    <CelebrationDecor />
  </main>
);
```

## Hooks

### useCelebration

Returns the celebration state, or an inert value outside `CelebrationProvider`. Hand every composer message to `consumeSecretPhrase` before sending it.

```tsx
import { useCelebration } from '@epam/ai-dial-celebrations';

export const useSend = (send: (text: string) => void) => {
  const { consumeSecretPhrase } = useCelebration();
  return (text: string) => {
    if (consumeSecretPhrase(text)) return;
    send(text);
  };
};
```

`useCelebration()` returns `{ event, isEnabled, activate, celebrate, consumeSecretPhrase }`. `event.iconUrl` is the event's icon, which a host may show in place of its own logo.

## Events

### Halloween

`@epam/ai-dial-celebrations/halloween` exports the default `halloweenEvent`, `createHalloweenEvent`, `HALLOWEEN_LABELS`, `HalloweenScene` and `HalloweenDecorBehavior`. Its decoration is a corner web with a spider and a pumpkin trigger; the secret phrase is `trick or treat`.

```ts
import { createHalloweenEvent } from '@epam/ai-dial-celebrations/halloween';

/* A loader that also plays a soundtrack in the train scene. */
export const loadHalloween = async () =>
  createHalloweenEvent({ trainSoundtrackUrl: '/sounds/train.mp3' });
```

### New Year

`@epam/ai-dial-celebrations/new-year` exports the default `newYearEvent`, `NEW_YEAR_LABELS` and `NewYearScene`. Its decoration is a garland with a gift trigger; the secret phrase is `happy new year`.

## Choosing scenes

`selection` takes, per event id, `enabledScenes` (when set, only these may play), `disabledScenes`, `disabledDecorBehaviors` and `isSecretEnabled` (default `true`). Everything is enabled by default. A disabled scene leaves both the click and the secret pools; the secret phrase is consumed only while one of its scenes is enabled, otherwise the message is sent normally.

```ts
import type { CelebrationEventSelection } from '@epam/ai-dial-celebrations';
import {
  HalloweenDecorBehavior,
  HalloweenScene,
} from '@epam/ai-dial-celebrations/halloween';

export const HALLOWEEN_SELECTION: CelebrationEventSelection = {
  disabledScenes: [HalloweenScene.Mummy, HalloweenScene.Portal],
  disabledDecorBehaviors: [HalloweenDecorBehavior.PumpkinWrap],
};
```

## Labels

The library ships English defaults for every visible text. Pass translated overrides through `labels`; `{{phrase}}` in a message is replaced with the event's secret phrase while the secret is enabled.

```ts
import type { HalloweenLabels } from '@epam/ai-dial-celebrations/halloween';

export const halloweenLabels: Partial<HalloweenLabels> = {
  toastTitle: '🎃 Joyeux Halloween !',
  ghostToastMessage:
    'Les fantômes sont réveillés ! Écrivez « {{phrase}} » dans le chat.',
};
```

## Anchors

`CelebrationAnchors` tells scenes which host elements they may borrow: `composer`, `composerAddCluster`, `composerModelSelector` and `starterList` are class names; `historyContainer` is the class of the conversation-history container and `historyRowLink` a selector for a conversation link inside it (its list item is the borrowed row); `welcomeRegion` is a selector for the start-page region, defaulting to the composer's closest `[role="region"]`. A scene whose anchors are missing plays its decorative fallback instead.

## Enums

### HalloweenScene

`Spiders`, `Ghost`, `Web`, `Bats`, `Cat`, `Witches`, `Train`, `Portal`, `Ravens`, `Candy`, `Footprints`, `Skeletons`, `Cauldron`, `Mimic`, `Bowling`, `Mummy`. `Spiders`, `Cauldron`, `Mimic`, `Bowling` and `Mummy` are secret-phrase scenes; the rest play on a pumpkin click.

### HalloweenDecorBehavior

`SpiderFlee` (bolts from a nearby pointer), `SpiderDrop` (idles on a thread), `SpiderDrum` (drums while the user types), `PumpkinWrap` (wraps the pumpkin after a quiet minute).

### NewYearScene

`Snow`, `Confetti`, `Sleigh`, `GiftWrapping`, `PenguinStar`. `Confetti` is also the secret-phrase scene.

## Types

`CelebrationProviderProps`, `CelebrationContextValue`, `CelebrationEvent`, `CelebrationEventLoader`, `CelebrationScene`, `CelebrationSecretTrigger`, `CelebrationDecorationProps`, `CelebrationEventSelection`, `CelebrationAnchors`, `CelebrationNotification`, `HalloweenEventOptions`, `HalloweenLabels`, `NewYearLabels`.

## Scenes

New Year's fir stands near the model selector while a penguin in a Santa hat
walks in directly from the side of the start-page stage. It visually pulls the
nearest eligible starter-prompt button from the page, or the idle model
selector if no prompt qualifies. The button folds down to a paper ball in its
flipper; the penguin crushes that into a gold star and throws it onto the fir. After a
surprised look and a bow to the tree, it leaves by the same side. The borrowed
button returns to its original appearance when the scene ends or is interrupted.
One 20-second native Lottie SVG composition owns the scene; the
provider allows 22.5 seconds including player loading. The existing light
player loads only for animated playback, with a two-second import deadline and
250 ms renderer deadline.

The scene measures the composer, model selector, greeting and starter prompts
to place the cast close together while keeping host text readable. When the
greeting or prompts block the stage, the cast stands on a decorative snow
ledge below the composer; an eligible prompt or selector can still be borrowed.
The penguin follows a supplied image reference: front-facing
black-and-white body, large pale belly, opaque sunglasses, tapered flippers,
small pale feet and a restrained red Santa hat. The same full story runs on
mobile and in RTL. Reduced motion, unsupported browser APIs and player failures
show static art. The borrowed control is never clicked, cloned or reparented;
its reversible visual transform is cancelled when playback stops.

Typing, pointer/focus interaction, scrolling, viewport or target changes,
hidden tabs, navigation, scene replacement and motion-preference changes stop
the scene and release its player, listeners, observers and timers. The gift
selects it from the random click pool; the secret phrase still plays confetti.
Hosts can override `penguinStarToastMessage` through existing labels. The scene
budgets 140 generated SVG artwork nodes, 32 animated properties, 80 keyframes
per property and 120 KB of composition data. It uses no external assets,
filters, masks, copied controls or per-frame host measurements; these limits
are not a frame-rate guarantee.

New Year's gift-wrapping scene has two mischievous cartoon elves: a stocky,
self-important green master and a nimble coral helper. Small noses, expressive
brows and grins make their reactions distinct, while compact articulated arms
keep each mitten on its ribbon or reel. They treat the composer as a present.
A continuous golden ribbon travels around its edges, then retracts as the
helper's overenthusiastic pull wraps the master instead. The helper proudly
presents his work while the frustrated master hops away with a chest bow and a
ribbon around his
ankles; the helper follows with the reel. Both elves and the full story remain
on mobile and in RTL layouts.

The scene plays one sixteen-second Lottie vector composition and unmounts by
eighteen and a half seconds. Its light SVG player loads only for animated
playback, with a two-second import deadline and a further 250 ms for SVG
readiness; hosts need no extra player setup or peer dependency. The artwork is
local and uses no external animation URL, fonts or raster assets. It only measures
the composer: no host element is copied, hidden or moved, and drafts, focus and
selection remain intact. Missing,
clipped or spatially unsuitable composers use a decorative parcel. Reduced
motion, missing browser support or player failure show the same redesigned
characters as a stationary, annoyed bound master beside the proud helper.
Waiting for the player import and reduced-motion fallback do not measure the
host.

Interaction, focus changes, scrolling, viewport or target changes, hidden tabs,
navigation and motion-preference changes cancel playback and release the player.
The gift selects the scene from the existing random click pool; the secret
phrase still plays confetti. Hosts can override `giftWrappingToastMessage`
through the existing New Year labels.

The Halloween portal briefly pulls visual copies of up to two adjacent, visible
conversation-history rows into its claw, then restores the rows. It never changes
conversation data. Interaction, scrolling, resizing, navigation or enabling reduced
motion cancels the borrowing immediately, including typing in an already-focused
composer. Changing, moving, resizing or hiding a borrowed row or its container
also restores the originals. With closed or empty history, only the
portal artwork appears. Reduced motion shows a static rift and leaves history alone.
Every scene notification includes a hint for the event's secret chat phrase.

The four new message-only surprises interact with the existing page through
inert visual copies. A mummy walks in from the side, braces against the chat input
and strains twice without moving it, then slowly pushes it completely offscreen.
The input returns at the end; its draft and focus are preserved throughout.
A cauldron pulls two chats into its brew and releases them as bubbles; a toothy
mimic curls a shaded tongue in front of and behind two neighboring chats and pulls
them into its mouth, keeping them attached to the tongue tip, then chews and spits them back. A pumpkin
rolls into the visible history and scatters only the rows whose visible titles
its body touches (up to six), starting each row's motion at contact, before they regroup.
With closed or empty history, the pumpkin still rolls across the viewport using
the same travel and spin animations, without borrowing UI.
Original layout and conversation data never change. Copies disappear and originals
return immediately on typing, composition, clicking, focus changes, scrolling,
resizing, source changes, navigation or reduced motion. Unavailable or unusually
large targets fall back to artwork alone. The mummy can use a focused composer;
history scenes skip focused rows. The mummy animates for twelve seconds and
unmounts after thirteen; the other three animate for eight and unmount after nine.
On mobile, the mummy waits for 120 ms of viewport stability before measuring the
composer, up to 600 ms, so an activation-time keyboard/browser-chrome transition
does not cancel its entrance. Input, focus, pointer interaction, document scrolling,
hidden tabs or unmount cancel this preparation; viewport changes during playback
still stop the scene immediately.
Repeated secret messages select randomly without consecutive repeats, independently
of pumpkin clicks. The new scenes are exclusive to messages and show a static
illustration with reduced motion enabled.

A single cobweb hangs in the inline-end top corner, and its spider is never
quite still: it rubs its front legs, blinks, leans to watch the pointer and
every 10–20 seconds lowers itself on a thread. It drums its legs while the user
types. Within 240px of the pointer it reels in and freezes; closer still it
bolts. After a minute with no user activity it climbs down to the pumpkin and
wraps it in crossing silk strands until the pumpkin shakes it off and the
startled spider climbs back up. Any activity interrupts the wrap at once; the
pumpkin stays clickable throughout, and reduced motion keeps the spider still.

Descending spiders can now borrow up to three visible welcome-page elements:
the greeting, model selector, attachment control and sometimes a history row.
They descend, weave fine curved silk strands around their prizes, then climb above the viewport carrying
the copies. Each carrier and its cargo share a transform. Originals retain layout
and focus and return within eleven seconds; interaction cancels the theft
immediately. Focused or expanded controls are skipped. Missing targets keep the
decorative spider drop; reduced motion leaves the page untouched and shows static
spiders. Existing public selectors provide all targets without changes to core
page components or libraries.

The connected-web scene keeps 54 spiders on mobile and 80 on desktop, with
slightly larger bodies and small webs that also attach to visible composer,
welcome-heading and conversation-history corners, plus the main pumpkin's body.
The pumpkin gets a target before the history limit is filled and remains clickable.
A single canvas draws at most
30 times per second, reusing finished silk and spider artwork. Target geometry is
captured at scene setup and rechecked only on relevant DOM or resize notifications,
never per frame; real controls retain their focus and behavior. Changing or removing
an anchor, scrolling, resizing or hiding the tab stops the scene, and reduced motion
shows a static web.

Ghosts possess separate small interface elements: their inert visual copies
float and grow eyes, while one brave ghost tries to frighten the main pumpkin.
The pumpkin answers with a glowing grin; the ghost recoils and hides with its
tail exposed before the flock peeks out and flees along staggered, separate paths.
The scene borrows at most three elements on mobile and five on desktop, each
with at most 60 descendants, without cloning the composer or changing drafts.
Focused, expanded, editable, hidden and clipped controls are skipped. Original
elements return within twelve seconds; interaction, source changes, scrolling,
resizing, navigation and motion-preference changes stop the scene immediately.
Missing anchors retain the decorative crossing flock. Reduced motion or missing
animation support shows stationary ghosts without borrowing elements. Targeting
and playback stay in the Halloween layer and work in both LTR and RTL.

The cat tests gravity on nearby buttons: it walks in on four legs, jumps onto the
composer and sits there glancing at the viewer and down at its prize, then hops
down beside up to two small controls. It moves each button gradually over two
paw pushes, looking at the viewer, at the button while pushing, and back at the
viewer, until its prizes fall off their ledges. The last button rebounds,
startling the cat before it sits to groom and leaves. A seated drawing sits,
pushes and grooms; a standing drawing with a diagonal gait walks and jumps. Paw
contact and falling copies share one 25-second timeline; the Cat scene unmounts
after 25.5 seconds. Only safe idle buttons are copied (at most sixty descendants
and 300×96/24000px² each).
The composer stays live, preserving its draft, focus, selection and position.
Interaction or real anchor changes restore controls immediately; unrelated toast
portal removal leaves playback running. One eligible button keeps the same
testing/rebound story; no usable anchors retain a decorative crossing cat.
Reduced motion or missing animation support shows a stationary cat without
borrowing UI. All targeting and animation remain in the Halloween layer.

The bat scene stages a failed wake-up attempt: a sleepy bat hangs under the
composer while two helpers fan it. Their wing downstrokes rock nearby small
controls, cards or history rows after a short distance-dependent delay. Stronger
opposing currents spin
the helpers away separately; the sleeper opens one eye, yawns, crawls to a nearby
idle button (or along the composer edge) and flies away last. The 17.5-second
scene uses at most three mobile/five desktop visual copies with at most sixty
descendants each. The composer remains untouched. Interaction or anchor changes
restore originals immediately. Missing attachment space retains the old flight;
reduced motion or missing animation support uses stationary bats. SVG and
precomputed animations keep playback free of repeated layout measurements, in
both LTR and RTL. Flight paths carry momentum through turns, approaches slow
before landing, wingbeats change pace continuously and borrowed surfaces settle
with damped motion. Jointed outer wings fold on recovery and spread on the power
stroke, accompanied by a slight body lift. Airflow has no rays, streaks or drawn
vortex. The scene unmounts after eighteen seconds.

The witches stage a spell lesson: an apprentice levitates small buttons, which
grow frog eyes and legs and hop away. Her broom-herding attempt enchants the
broom itself. A composed mentor undoes the spell; the buttons return exactly
to their places before departure, with one final broom hop startling the
apprentice. Two articulated witches share a twenty-second timeline; the scene
unmounts after 20.5 seconds. Spells start at the posed hand; curved flights,
hop anticipation and landing recovery, and delayed hat/cloak motion distinguish
the apprentice's impulsive gestures from the mentor's measured ones. Returned
copies cover the controls until original visibility is fully restored.
Desktop borrows at most two buttons and mobile one,
each at most 40 descendants and 240×64 pixels. The composer is only measured,
never cloned. Missing or unsuitable targets retain a broom-only lesson; reduced
motion or unsupported animation APIs show static witches without measuring or
borrowing controls. Input, focus, scrolling, resizing, relevant source changes,
hidden documents and scene replacement cancel playback and restore originals.
Physical geometry works in both LTR and RTL without mirroring button text.
Selection inspects at most 24 buttons. Precomputed transform/opacity tracks
use at most 48 animations and 160 keyframes per track, with no per-frame layout
reads or React updates. Actual anchor changes can trigger a geometry recheck
solely for cancellation. No audio, additional dependency or network request is
introduced.

Candy stages a 35-second contest over fallen sweets. Candy bounces from measured
composer/starter edges and settles along the bottom. Two ravens land and peck;
a mummy janitor sweeps and scares them off. The returning flock drives the mummy
out of the opposite edge and resumes feeding. The mummy returns with exactly two
skeleton janitors; together they drive the birds away, clear the sweets and leave.
The provider unmounts the scene after 35.5 seconds. Mobile keeps all story beats
with twelve sweets and four returning birds; desktop uses eighteen sweets and
six returning birds. Both start with two birds and end with three janitors.

Candy only measures host elements: no input, card or control is copied, hidden
or animated. Starters may be above or below the composer; a composer-only host
still supplies collision geometry. Without safe targets, candy falls to the
floor and the full contest continues. RTL mirrors the cast and entry sides while
contacts retain the physical host geometry. Reduced motion or unavailable motion
APIs show a static cast without measuring targets. Typing, pointer/focus, scrolling,
resize, source changes, hidden documents, changed environment and unmount cancel
all owned effects. Tracks animate only transform/opacity; there is no physics
engine, animation-frame loop, repeated layout polling or animated filter.
Limits are 60/80 mobile/desktop tracks, 400/520 SVG nodes, 160 keyframes per track,
four composer candidates, twelve starter candidates and two/three selected edges.

Footprints reveal an invisible cat: alternating paws approach a starter card,
press its edge, then leave the card sagging under the cat's weight. Eyes glance
and blink before a grin appears. The cat jumps toward the composer ledge; the
card rebounds and returns exactly, and the last prints and grin fade before the
twelve-second deadline. The head peers over the open side of the card, keeping
stacked starter labels clear. Only one idle starter button can be borrowed as
an inert visual copy (at most 240×96px and 40 descendants); the composer is only
measured. Selection checks at most twelve buttons through host-provided anchors.
Starters can sit above or below the composer, including the real chat's layout.
Without a suitable starter, a visible composer with enough headroom becomes the
stage: paws walk along its top edge, a lightweight decorative outline dips under
their weight, and the cat jumps to the opposite corner. The outline follows the
input's bounds and corner radius; the live input and its contents are never
copied, hidden or animated. This variant uses thirteen mobile or seventeen
desktop animation tracks and works without a starter-list anchor.
Missing or unsuitable composers keep a decorative route. Reduced motion or missing
animation APIs show three static prints and the face without measuring the page.
Input, focus, scroll, resize, source changes, hidden documents, motion/layout
changes and unmount restore the original immediately. Mobile uses eight prints
and desktop twelve; at most twenty transform/opacity animations and eighty
keyframes per track are allowed. The detailed pads, eyes and grin use no SVG
filters, per-frame geometry reads or React updates. Physical coordinates preserve
contact in RTL without mirroring copied text.

Skeletons lose a skull on the composer edge. Two dancers spring onto the input's
top edge, whose decorative outline dips after each landing, and dance a short
jig. The showman's over-eager nod launches his skull over the partner; it
bounces, rolls to the composer corner and teeters while the headless body gropes
the wrong way. The partner lunges, catches it at the corner, carries it back and
hops to place it — backwards — until a spin turns the face forward. When the
last word of the start-page greeting heading ("Good evening, Valery" → "Valery";
"Good evening" → "evening") is within reach, the partner jumps, grabs it and
runs off the edge with it while the showman protests and follows; the word is
thrown back and lands exactly in place. The original word is hidden only
visually through the CSS Custom Highlight API — the heading's DOM and text never
change — and any interruption shows it again immediately. Without a reachable
word or the Highlight API, both celebrate and drop below the viewport. The
provider unmounts the scene after twelve seconds. Hand and skull share one precomputed pose, so the skull stays on
the hand from catch to placement, including the partner's turn. The composer is
only measured (at most four candidates): nothing is copied, hidden or animated.
Without a visible composer at least 220px (200px mobile) wide and 150px below the
top, the same story plays on the viewport floor. Mobile keeps the full cast at a
smaller scale within a 320px band. RTL mirrors the artwork layer so the corner is
the physical inline end. Reduced motion or missing animation APIs show a static
partner offering the skull to the headless showman without measuring the page.
Input, focus, scroll, resize, composer changes, hidden documents, changed
environment and unmount cancel playback. Limits are 22 transform/opacity
animations, 80 keyframes per track and 100 SVG nodes, with no filters or
per-frame geometry reads.

The raven scene tears small visual fragments from separated headings, buttons
and history rows to build a nest on the main pumpkin. Each collector has its own
pickup point and flight path, drops its piece briefly, then leaves in a separate
direction without gathering over the nest. Two other birds tug opposite ends of
a conversation, then one lets go and the other recoils into the nest with its
prize. The pumpkin shakes and the borrowed row returns. With no eligible visible
history, the pair uses a composer-border strip instead. Five birds on mobile and
eight on desktop share precomputed motion with their cargo. Copies are limited
to one small row in five visual sections and three/six small fragments from
subtrees of at most 16 descendants; the composer is never cloned. Input, focus,
scrolling, resizing, target changes or scene replacement cancel playback and
restore the interface. Reduced motion shows stationary artwork. All targeting
stays in the Halloween layer, using physical coordinates for both LTR and RTL.

The Halloween train stops with an empty final wagon, picks up the main pumpkin
and departs with smoke from its chimney and side vents. Boarding uses the pumpkin's
actual screen position; its decorative copy rides behind the wagon front while
the original labelled button retains focus and layout. The scene restores the
pumpkin on completion or interaction, or when its source or container changes,
moves, resizes or disappears. Reduced motion shows static artwork.
Train direction follows the pumpkin's side, including RTL.

`createHalloweenEvent({ trainSoundtrackUrl })` optionally accepts a supplied
audio asset URL. It is unset by default, so the train stays silent and makes no
audio request.
Configured playback is bounded to the scene, stops on interruption and gracefully
handles browser playback rejection. Reduced motion always stays silent.

## Runtime behavior

The shared provider owns one active scene, random selection without consecutive
repeats when alternatives exist, replacement and cleanup. Event changes and
navigation cancel playback and pending imports. Loading, unknown IDs and module
failures leave the ordinary chat available; no input is intercepted until the
selected module is ready. Missing providers are intentionally inert. Seasonal
icons replace existing navigation/header slots only, preserving theme wordmarks
and the browser-tab favicon. No event state is persisted.

## Public class names

A host cannot style the library through its CSS-module locals, which are hashed at build time. Three elements therefore carry a stable public class, exported as `CELEBRATIONS_CLASS`.

| Key          | Class                           | Element                                    |
| ------------ | ------------------------------- | ------------------------------------------ |
| `decor`      | `dial-celebrations-decor`       | Wrapper of the active event's decoration   |
| `trigger`    | `dial-celebrations-trigger`     | The event's trigger button (pumpkin, gift) |
| `sceneLayer` | `dial-celebrations-scene-layer` | Viewport layer a playing scene renders in  |

## Storybook

Every scene, decoration and decoration behavior has a story, plus a playground for host selection:

```sh
npm exec nx storybook @epam/ai-dial-celebrations
```
