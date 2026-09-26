# @epam/ai-dial-celebrations

Seasonal start-page celebrations with lazily loaded Halloween and New Year scenes that hosts can switch on and off one by one.

## Overview

`@epam/ai-dial-celebrations` adds seasonal easter eggs to a chat start page: a decoration with a clickable trigger (a pumpkin, a gift), full-screen animated scenes that play when the trigger is pressed, and an optional secret phrase that plays a hidden scene instead of sending the message. The runtime is a React provider that owns playback — which event is loaded, which scene is playing and when it ends — while the host decides everything the library cannot know: which event is active and on which page, how texts are translated, how notifications are shown, whether the layout is mobile, and which DOM elements scenes may borrow. Each event lives in its own entry point (`./halloween`, `./new-year`) and is loaded only when selected, so a host that never enables New Year never downloads it. Hosts can disable individual scenes, individual decoration behaviors and the secret phrase per event. Every scene respects `prefers-reduced-motion`, all artwork is `aria-hidden` and pointer-transparent, and scenes that borrow interface elements animate inert copies and always restore the originals.

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

`Snow`, `Confetti`, `Sleigh`. `Confetti` is also the secret-phrase scene.

## Types

`CelebrationProviderProps`, `CelebrationContextValue`, `CelebrationEvent`, `CelebrationEventLoader`, `CelebrationScene`, `CelebrationSecretTrigger`, `CelebrationDecorationProps`, `CelebrationEventSelection`, `CelebrationAnchors`, `CelebrationNotification`, `HalloweenEventOptions`, `HalloweenLabels`, `NewYearLabels`.

## Scenes

The Halloween portal briefly pulls visual copies of up to two adjacent, visible
conversation-history rows into its claw, then restores the rows. It never changes
conversation data. Interaction, scrolling, resizing, navigation or enabling reduced
motion cancels the borrowing immediately. With closed or empty history, only the
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
Original layout and conversation data never change. Copies disappear and originals
return immediately on typing, composition, clicking, focus changes, scrolling,
resizing, source changes, navigation or reduced motion. Unavailable or unusually
large targets fall back to artwork alone. The mummy can use a focused composer;
history scenes skip focused rows. The mummy animates for twelve seconds and
unmounts after thirteen; the other three animate for eight and unmount after nine.
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
read only at scene setup; real controls retain their focus and behavior. Scrolling,
resizing or hiding the tab stops the scene, and reduced motion shows a static web.

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
pumpkin on completion or interaction and shows static artwork under reduced motion.
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
