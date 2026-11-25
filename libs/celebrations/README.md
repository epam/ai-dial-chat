# @epam/ai-dial-celebrations

Seasonal start-page celebrations with lazily loaded Halloween and New Year scenes that hosts can switch on and off one by one.

## Overview

`@epam/ai-dial-celebrations` adds seasonal easter eggs to a chat start page: a decoration with a clickable trigger (a pumpkin, a gift), full-screen animated scenes that play when the trigger is pressed, and an optional secret phrase that plays a hidden scene instead of sending the message. The runtime is a React provider that owns playback — which event is loaded, which scene is playing and when it ends — while the host decides everything the library cannot know: which event is active and on which page, how texts are translated, how notifications are shown, whether the layout is mobile, and which DOM elements scenes may borrow. Each event lives in its own entry point (`./halloween`, `./new-year`) and is loaded only when selected, so a host that never enables New Year never downloads it. Externally delivered packs — a Lottie scene that replaces a bundled scene by id, or a whole external-only event — are described by transport-independent descriptors from the main entry and rendered by the lazy `./packs` entry; the library never fetches them, the host passes asset loaders. Hosts can disable individual scenes, individual decoration behaviors and the secret phrase per event. Every scene respects `prefers-reduced-motion`, all artwork is `aria-hidden` and pointer-transparent, and scenes that borrow interface elements restore their original appearance on completion or interruption.

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

### Packs

`@epam/ai-dial-celebrations/packs` renders host-validated pack descriptors. Import it only after a pack has resolved, so `LottieScene` and the static trigger stay out of the main chunk. Its exports are `LottieScene`, `StaticTriggerDecoration`, `createCelebrationSceneFromDescriptor`, `replaceCelebrationScenes`, `addCelebrationScenes` and `createCelebrationEventFromDescriptor`.

The host supplies every asset through `CelebrationAssetLoaders`: `loadAnimationData(assetId, signal)` resolves parsed Lottie JSON and must reject on abort; `resolveImageUrl(assetId)` returns an `<img>` URL or `undefined`. The library never calls `fetch`, never imports a URL and never injects markup.

Replace a bundled scene by its stable id. Only ids the event already has are replaced; each replacement keeps the bundled `labelId`, and the trigger, pools, secret phrase, labels and decor behaviors stay the same:

```ts
import {
  CelebrationColorScheme,
  type CelebrationAssetLoaders,
  type CelebrationSceneDescriptor,
} from '@epam/ai-dial-celebrations';

declare const snowman: CelebrationSceneDescriptor;
declare const loaders: CelebrationAssetLoaders;

export const loadNewYear = async () => {
  const [
    { createCelebrationSceneFromDescriptor, replaceCelebrationScenes },
    { newYearEvent },
  ] = await Promise.all([
    import('@epam/ai-dial-celebrations/packs'),
    import('@epam/ai-dial-celebrations/new-year'),
  ]);
  return replaceCelebrationScenes(newYearEvent, [
    createCelebrationSceneFromDescriptor(snowman, loaders, {
      direction: 'ltr',
      colorScheme: CelebrationColorScheme.Light,
    }),
  ]);
};
```

Add a scene the event does not have with `addCelebrationScenes`. It appends only unknown ids to the scenes and routes them to the secret pool when listed in the compiled event’s `secretTrigger.externalSceneIds`, otherwise to the click pool, and merges `labels` under the event's own labels, so a bundled label id always wins. The host decides which ids may be added; it returns the same event when nothing is new:

```ts
import {
  CelebrationColorScheme,
  type CelebrationAssetLoaders,
  type CelebrationSceneDescriptor,
} from '@epam/ai-dial-celebrations';

declare const couriers: CelebrationSceneDescriptor;
declare const loaders: CelebrationAssetLoaders;

export const loadNewYearWithCouriers = async () => {
  const [
    { addCelebrationScenes, createCelebrationSceneFromDescriptor },
    { newYearEvent },
  ] = await Promise.all([
    import('@epam/ai-dial-celebrations/packs'),
    import('@epam/ai-dial-celebrations/new-year'),
  ]);
  return addCelebrationScenes(
    newYearEvent,
    [
      createCelebrationSceneFromDescriptor(couriers, loaders, {
        direction: 'ltr',
        colorScheme: CelebrationColorScheme.Light,
      }),
    ],
    { bullfinchCouriersToastMessage: 'Two couriers, one gingerbread star.' },
  );
};
```

An external-only event comes from a pack descriptor with an `event` block. It gets the `static-trigger-v1` decoration, the pack's English labels, its click pool filtered to declared scenes, and no secret phrase or decor behaviors. The function throws for a descriptor without `event`:

```ts
import {
  CelebrationColorScheme,
  type CelebrationAssetLoaders,
  type CelebrationPackDescriptor,
} from '@epam/ai-dial-celebrations';

declare const pack: CelebrationPackDescriptor;
declare const loaders: CelebrationAssetLoaders;

export const loadAnniversary = async () => {
  const { createCelebrationEventFromDescriptor } =
    await import('@epam/ai-dial-celebrations/packs');
  return createCelebrationEventFromDescriptor(pack, loaders, {
    direction: 'rtl',
    colorScheme: CelebrationColorScheme.Dark,
  });
};
```

`LottieScene` plays one `CelebrationSceneDescriptor` inside the provider's scene layer. It picks the variant matching the most of layout (`isMobile`), direction and color scheme, places a `viewport-stage-v1` stage by `fit` and `align` (`start`/`end` follow the supplied direction, never the document language) or a `composer-anchor-v1` stage on the measured composer (see below), flips a `mirror` scene in RTL, and clones the data before the player gets it. Reduced motion or an unsupported scene uses the poster `<img alt="">` for `posterDurationMs` without requesting the player or animation data. A failure before playback also uses the poster; after a failure past the first frame it renders nothing. History scenes additionally require a safe, readable poster region, as described below. A generated SVG with more than 800 elements counts as a failure before playback.

```tsx
import { LottieScene } from '@epam/ai-dial-celebrations/packs';
import {
  CelebrationColorScheme,
  type CelebrationAssetLoaders,
  type CelebrationSceneDescriptor,
} from '@epam/ai-dial-celebrations';

declare const scene: CelebrationSceneDescriptor;
declare const loaders: CelebrationAssetLoaders;

export const SnowmanScene = () => (
  <LottieScene
    scene={scene}
    loaders={loaders}
    context={{ direction: 'ltr', colorScheme: CelebrationColorScheme.Light }}
  />
);
```

#### Composer anchoring

A scene with `composer-anchor-v1` placement is authored around a reference composer, `anchorRect`, in its own stage coordinates. After the player and data load, `LottieScene` measures the composer once through `anchors.composer` (at most four candidates and 24 ancestors each; the composer must be at least `anchorRect.width × scale.min` wide, 36–260 px tall, 12 px from the side edges, 20 px above the bottom, with stage headroom above it, and without a hidden, inert, aria-hidden or clipping ancestor). It then scales the stage uniformly by `clamp(composerWidth / anchorRect.width, scale.min, scale.max)` and aligns the center and `edge` of `anchorRect` with the composer. Content beyond the authored stage stays visible inside the viewport. A `mirror` scene flips around the anchor's center line in RTL.

A variant may carry its own `placement` with the same template, so a mobile variant can be authored around a narrower reference composer than the desktop one. `LottieScene` uses the chosen variant's placement, or the scene's when it has none; a variant that changes the template makes the scene unsupported.

With no eligible composer, `fallback: 'stage-anchor'` plays around a synthetic anchor (`anchorRect × scale.min`, centered at 57 % of the viewport height), and `fallback: 'poster'` shows the poster. A browser without `ResizeObserver` or `MutationObserver` shows the poster. Pointer, keyboard, focus, input, scrolling, viewport changes, a hidden tab, or a moved or changed composer cancel the scene; nothing is re-measured per frame. A scene that also requires `interaction-composer-outline-v1` has its `composer-outline` layer (one static path) redrawn around the measured composer, and its optional `composer-parcel` layer (one static rectangle) removed for a real composer or sized to the synthetic anchor. A missing or malformed slot is a failure before playback. Anchoring and fitting work on a private copy, so the object `loadAnimationData` returns is never changed.

```ts
import {
  CelebrationAnchor,
  CelebrationAnchorEdge,
  CelebrationAnchorFallback,
  CelebrationPlacementTemplate,
  type CelebrationComposerAnchorPlacement,
} from '@epam/ai-dial-celebrations';

export const giftWrappingPlacement: CelebrationComposerAnchorPlacement = {
  template: CelebrationPlacementTemplate.ComposerAnchorV1,
  anchor: CelebrationAnchor.Composer,
  anchorRect: { x: 340, y: 164, width: 520, height: 56 },
  edge: CelebrationAnchorEdge.Top,
  scale: { min: 0.6, max: 1 },
  fallback: CelebrationAnchorFallback.StageAnchor,
};
```

#### Authored small button props (`interaction-button-props-v1`)

The [Snow Circus preview](src/stories/SnowCircus.stories.tsx) uses this opt-in capability with `composer-anchor-v1` and `direction: 'none'`. A penguin turns borrowed buttons into snowballs, juggles, plays with a snowman, and returns the buttons. Native JSON/SVG is maintained in Themes under `authoring/snow-circus`; the Storybook fixtures are byte-identical verification copies, not runtime generators. The scene is an addition to the New Year `happy new year` secret pool only when the host admits `new-year/snow-circus` and selects a pack containing it.

One identity root null, `bp-stage`, carries all art. One or two static `bp-reference:N` nulls specify button centers. `bp-weight:N` opacity tracks blend measured center offsets into the stage, keeping character contact and copies together; weights total at most 100. Direct-child `bp-prop:N` nulls declare position/opacity tracks. These metadata tracks share at most 128 ordered linear keys, start at zero and end at the composition out point. `bp:entry:N` and `bp:restore:N` markers require a prop at its reference with weight 100. Copies remain invisible outside their borrowing/fade windows. Optional `bp-drawn:N` layers supply snow clumps when targets are absent; the adapter removes them only for copied targets.

The adapter scans through the existing bounded button discovery and restricts copies to two on desktop, one on mobile, 40 total nodes each, and 20–64 by 20–56 CSS pixels. Focused, disabled, expanded, editable, clipped or transformed/animated targets are excluded. Contact offsets over 400 native horizontal units or 140 vertical units use drawn props. It prepares a private asset copy once, creates no poses and performs no per-frame DOM reads. Copied text never mirrors. The real controls keep their layout, draft and selection; input, pointer/focus, scroll, viewport/target changes, hidden tabs and unmount cancel playback and restore originals. Each prop returns on its own authored clock; reduced motion uses the finite poster without snapshots or a player.

Optional paired identity nulls `bp-bounds:min` and `bp-bounds:max` declare the conservative artwork envelope during contact motion. Both have static finite position corners inside the composition and zero opacity; incomplete, inverted or out-of-stage bounds reject the source. Without them the adapter uses the whole composition rectangle. Button eligibility runs before pair selection and requires that zero displacement and each available prop-slot translation keep the envelope inside the viewport. Nonnegative linear contact weights totaling at most 100 make every blend safe too. Unsafe targets use drawn snow; if even the unshifted envelope cannot fit, the scene uses its poster. This adds no per-frame measurements.

Snow Circus lasts 26 seconds, uses two characters and one player, and caps each variant at 48 layers, 2500 keys, 160 paths/1000 vertices, 500 generated SVG nodes and 512 KiB JSON. Its poster is at most 30 KiB. The actual source is smaller; browser and artistic evidence are separate. Run `npm exec -- nx run @epam/ai-dial-celebrations:test-snow-circus-browser` for the production-player matrix and full mobile profile; outputs are in `tmp/snow-circus/browser`.

The prepared standard `new-year-default@1.5.1` pack adds Snow Circus to all five scenes from Themes `development` pack `1.4.0`, preserving Santa and the polar bears. Its catalog selects the new version. After compatible runtime/assets are released, append `new-year/snow-circus` to the existing `UI_EVENT_EXTERNAL_SCENES` (or managed `ui.celebrationDelivery.externalScenes`) allowlist, retain `UI_EVENT=new-year` and `UI_EVENT_DELIVERY_MODE=prefer-external`, change `UI_EVENT_DELIVERY_REVISION`, redeploy and reload clients. Preserve other admitted scenes/events. Snow Circus and Santa are secret-only: `happy new year` randomly chooses among the four secret scenes. Ordinary gift clicks choose among the other five scenes. There is no per-pack override in host policy. Rollback removes only the new allowlist entry or restores retained catalog version `1.4.0` with a new catalog revision. Local preparation does not establish remote publication or deployment.

#### Following conversation rows (`interaction-history-ladder-v1`)

This capability uses `viewport-stage-v1`, `direction: 'none'` and no second interaction. The adapter maps authored stations into viewport coordinates once; the player does not apply a second contain/cover fit. It mirrors native artwork from the host's logical side and keeps copied DOM text upright.

The asset declares six static reference nulls `hl-anchor:row-0` through `hl-anchor:row-5`, independent `hl-track:actor` / `hl-track:copy` position tracks, and optional rigid `hl-follow:row-N` roots. Contiguous marker streams `hl:actor:row-N` and `hl:copy:row-N` bind their respective keys. Single `hl:entry` / `hl:restore` markers delimit borrowing. The copy enters at its source reference with zero rotation, has fixed scale, and is visible only within the bounded entry/restore fade window. Native times, easing and key counts stay authored.

The optional frame-zero `hl:edge-start` marker selects the logical start of each row (left in LTR), including the inert copy's pivot; assets without it keep the end-edge pivot. Native art mirrors in RTL, while copied text remains upright.

An optional `hl-track:flight` and contiguous `hl:flight:*` windows may bind to `row-5`, `viewport-start` and `viewport-end`. This requires matching static `hl-anchor:viewport-start` / `hl-anchor:viewport-end` references and an invisible `hl-flight-bounds` rectangle in flight-local coordinates, enclosing the vehicle and seated rider. The actor may also bind to `viewport-end`. The adapter maps these points to the actual visible window edges, independently of the safety inset used for resting poses; it checks the full swept flight against protected controls while allowing clipping beyond the window. Times, easing and scale stay authored.

A single optional `hl-if:drawn:top-line:row-0` shape, directly parented to `hl-follow:row-0`, can extend its first path vertex just beyond the visible top. It requires identity transforms, one static open vertical two-vertex path with zero tangents, and one or two strokes of at most 8 px. It has no masks or effects. Only the private endpoint changes; the extended line must clear protected controls.

Six invisible static rectangles `hl-bounds:row-N` bound shared visible art at each station. Optional `hl-drawn-bounds` adds the alternative-only envelope without reserving hidden artwork width against real history headers. `hl-range` declares permitted horizontal drift and vertical gap. `hl-if:drawn` and optional `hl-if:history` layer prefixes choose native branches; the drawn alternative can use rope artwork and does not require cards. Malformed or duplicate slots, parent cycles, reserved names, uncovered keys or invalid transforms fail before copying UI. Preparation removes metadata from a private clone; actual rendered bounds still require browser verification.

The host's existing `historyContainer` / `historyRowLink` anchors supply visible idle rows. Discovery is bounded to 120 links and 24 ancestors. Six distributed stations are chosen from a safe reachable corridor, preferring the lowest usable ending row and then the earliest compatible start. Unsafe leading/trailing rows or excessive gaps do not discard a shorter valid descent. At most 720 station envelopes are cached and 24 candidate copy paths are checked; candidate search does not remeasure the DOM. Focused, expanded, editable, clipped or oversized rows are excluded. At most one inert row is copied: 320×64 CSS px and 80 nodes, including its root. Noninteractive decorative `aria-hidden` descendants and static planar translations on ancestor wrappers are supported. Transforms shared with the viewport scene, including `body`/`html` or a custom portal ancestor, remain unsupported to avoid applying the measured offset twice. Hidden rows/ancestors, accessibility-hidden controls, transforms on the row itself, ancestor scale/rotation/skew/perspective/zoom and active/pending ancestor animations remain ineligible. Its swept translation/rotation bounds must avoid the viewport margins and protected controls. The real node remains in place; its appearance is restored on completion or any cancellation.

Missing, closed, empty or unsafe history uses the complete authored alternative near the composer with zero snapshots. Santa's alternative is a rope descent with a slip, catch and recovery before the gift/phone/rescue ending. The adapter searches safe free regions around the composer and its heading/starters, without opening a sidebar. If no animated route fits, the shared safe-poster path protects the supplied composer and history surfaces. Reduced motion loads no player. If no readable poster fits or its image fails, only the host's existing notification remains. Interaction, content/geometry/anchor changes, scrolling, viewport changes, hidden tabs and host resets cancel immediately; no per-frame host measurement or React update is used.

The [Santa history Storybook preview](src/stories/SantaHistoryDelivery.stories.tsx) contains a 12-second representative descent/catch and a separate unpublished 27-second full story: gifts, failed return climb, phone call, reindeer arrival, boarding and departure. The rope fallback, carried gift sack and centered head are revisions to the previously accepted assets. [Representative provenance](src/test-utils/santa-history-delivery.ts) and [full asset identities](src/test-utils/santa-history-full.ts) pin Themes native JSON/SVG bytes. Artwork/normal-speed acceptance, geometry, resource measurements and publication are separate outcomes; a local fixture does not establish a released pack.

##### Future Santa activation and rollback

After runtime and pack release prerequisites pass, append `new-year/santa-history-delivery` to the deployment's existing `UI_EVENT_EXTERNAL_SCENES`, keeping every existing entry, `UI_EVENT=new-year` and `UI_EVENT_DELIVERY_MODE=prefer-external`. Change `UI_EVENT_DELIVERY_REVISION` and reload/reset clients to adopt delivery changes. Santa joins the existing `happy new year` secret pool. Gift clicks never select Santa; the other click and secret scenes remain available. No Shift-click routing or separate event is introduced.

Declare the new capability at scene level only, so older clients omit Santa while preserving supported scenes. Remove only its allowlist entry and refresh the delivery revision to roll it back. Ordinary-pack publication still requires a separately eligible retained-version retirement; the local preview does not change catalog defaults or immutable assets.

#### Borrowing host buttons (`interaction-cat-borrow-v1`)

A `composer-anchor-v1` scene with `direction: 'none'` may require `interaction-cat-borrow-v1`. After the player and data load, `LottieScene` does the following:

- **Targets.** It measures the composer once, with up to two buttons in it or in the starter list (`anchors.composer`, `anchors.starterList`, `anchors.welcomeRegion`). A button qualifies with at most 60 descendants, 300 × 96 px and 24,000 px², and when it is not focused, editable, disabled, expanded, hidden or clipped. The composer is never copied or moved.
- **Story.** It picks the asset's `two-prizes`, `one-prize` or `crossing` section from how many buttons the authored push reaches before the viewport edge.
- **Stations.** It moves the keyframes of the `cat-root` null onto the measured perch, button edges and viewport edges. Each `cat:bind:<anchor>` marker range keeps its authored offset from the matching `anchor:<anchor>` null, mirrored for the measured side, and the `cat-facing` null flips with it. No keyframe is added, and no time or easing changes.
- **Timing.** It writes a time remap on the `cat-rig` precomposition. The remap selects the section and lets the cat's reaction after a `cat:landing:<n>` marker follow the physical fall, at 0.8–1.25 × speed. A fall outside that range drops the button from the story.
- **Floor.** It fits the `cat-floor` rectangle under copies that fall to the bottom.
- **Copies.** It clones the buttons before readiness into an inert, aria-hidden layer beneath the renderer, and starts them on the Lottie clock. Each copy follows its `prize-<n>` track up to `cat:release:<n>`, then falls at 2,000 px/s² onto a starter button or the floor, tilts by at most 12°, rebounds when it is the last one, and fades back at `cat:restore`. Copies only translate and rotate, so copied RTL text stays readable. The original is hidden only between `cat:entry:<n>` and `cat:restore`.

A browser without `Element.prototype.animate`, `ResizeObserver` or `MutationObserver` shows the poster. So does a malformed `cat:` marker or slot. Interaction, scrolling, viewport changes, a hidden tab, a moved or changed button, composer or support, or a change of any of the three anchors ends the scene, and the originals are restored. A failure after the first frame renders nothing.

#### Copying host content along authored tracks (`interaction-copy-track-v1`)

A `composer-anchor-v1` scene with `direction: 'none'` may require `interaction-copy-track-v1`. The asset is authored at reference geometry; the adapter only fits it to the page. After the player and data load, `LottieScene` does the following:

- **Sections.** The asset declares `ct:section:<kind>` markers in priority order: `ledge-card`, `rim-card`, `rim`, `platform` or `rim-word`. The adapter plays the first one whose stage fits the page and whose copy role resolves.
- **Stages.** `ledge` stands under the bottom starter row, `rim` stands on the composer's upper edge, and `platform` stands below the lowest host content. Each is measured once from `anchors.composer`, `anchors.starterList` and `anchors.welcomeRegion`. The longest span the welcome region allows is chosen between the asset's `anchor:<name>` and `anchor:<name>@min` references, from the maximum down in 8 px steps and then the minimum itself. A root null named `<base>#<kind>[,<kind>…]` gives the named sections their own reference (`anchor:<name>` or `anchor:<name>@min` for `span-start`, `span-end` and `far`), follow-group position (`ct-follow:<anchor>`) or travel (`ct-travel`); follow groups and the `ct-band` stay authored against the base references.
- **Copy roles.** `starter-card` clones one starter button: at most four are inspected, and a card qualifies within 0.75–1.5 × the reference card's width (and at most 240 px) and 0.95–1.05 × its height, with at most 40 nodes, when it is enabled, idle, untransformed, visible and unclipped. `composer-word` copies the first word of the composer textarea's value or placeholder as an inert span over a cover in the background colour; the textarea is never touched.
- **Tracks.** Keyframes of the `ct-track:*` nulls are bound to measured anchors (`ct:bind:<anchor>`), stretched between them by each track's own progress (`ct:stretch`), or held where a resting object was put. `ct-follow:<anchor>` groups move rigidly. No keyframe is added, and no time or easing changes. Travel toward −x mirrors the whole stage.
- **Timing.** One time remap on the `ct-actor` precomposition splices the section's windows (`ct:cut:<kind>` / `ct:fill:<kind>`, equal lengths, so later beats keep their times) and repeats step cycles (`ct:cycle:<n>` over `ct:cycle-window:<n>`) a whole number of times (at most 24 per window) to cover the measured distance while the `ct-travel` null carries the actor. Each cycle's x offsets are scaled to the distance per cycle, so a planted foot stands still.
- **Copies.** The copy is prepared before readiness beneath the renderer and starts on the Lottie clock. It follows the `ct-track:copy` track and the travel, is visible from `ct:entry`, and fades back to its original at `ct:restore`. Copies only translate and rotate. `ct-if:copy` and `ct-if:no-copy` layers show only when the chosen section has, or has no, copy. A card section's grips fit the `ct-if:copy card-ref` rectangle, the reference card. The `ct-band` rectangle is read in stage units, so its layer and group are never moved, scaled or rotated.

A browser without `Element.prototype.animate`, `ResizeObserver` or `MutationObserver` shows the poster. So does a malformed `ct:` marker or slot (every rule that needs no page is checked before the page is measured, including closed cycles), or a page where no section fits. In every section, with or without a copy, interaction, typing, scrolling, viewport changes, a hidden tab, a moved or changed target, or a change of any of the three anchors ends the scene, and the original is restored. A failure after the first frame renders nothing.

#### Carrying the composer (`interaction-composer-carry-v1`)

This adapter supports a finite horizontal out-and-back story. It requires `composer-anchor-v1`, the top edge and `direction: 'none'`. A pack using it requires a compatible Chat runtime and Themes release that accept `interaction-composer-carry-v1`; publishing an asset alone does not deploy runtime support.

The asset defines a root null named `composer-carry` and a direct-child null named `composer-decoration`. All artwork descends from the carrier. The carrier has identity scale, anchor and rotation, and a keyframed three-dimensional position with zero y/z. Its x values are in 0–1000, with the first and final keyframes at rest. The final keyframe is at the composition's out point. The adapter maps x1000 to a measured offscreen position and applies the same authored timing and easing to an inert copy of the entire composer. The decoration slot's reference width is 520; only that slot is fitted horizontally, preserving character proportions and readable RTL text.

An optional direct-child null named `composer-side` binds its descendants to measured side or corner contacts. It has identity anchor, scale and rotation, and a static position or at most 64 ordered position keyframes within the composition. Positions are three-dimensional: x in −1–1, y in 0–1, and z zero. Relative to the composer's top center, the adapter maps these to `[x × width / (2 × stageScale), y × height / stageScale, 0]`. Thus `[1, 0.5, 0]` selects the right-side midpoint and `[-1, 1, 0]` the lower-left corner. Authored timing and easing remain intact; side changes and character poses stay in the asset. The slot neither resizes nor reframes the copy, and copied RTL text remains unmirrored. Assets without this slot retain their existing placement.

For assets with `composer-side`, the composition height minus `anchorRect.y` declares the artwork's extent below that slot. The lowest measured attachment plus this scaled extent must leave 20 px below the artwork in the viewport. A bottom-docked composer without that room shows the poster before any copy is created.

An eligible composer contains an enabled textarea, has at most 300 nodes, has no expanded popup, and has no transformed ancestor. The live input keeps its draft, focus and selection. Input, pointer interaction, scrolling, focus changes, geometry changes and cancellation remove the copy and restore the original. Unsupported or malformed assets and unsuitable targets show the existing finite poster fallback; reduced motion also uses the poster. The adapter has no manifest parameters or marker namespace.

`StaticTriggerDecoration` is a native `<button type="button">` named by `label` (default `Play celebration` when empty), with an `aria-hidden` image from `imageUrl`. It calls `onActivate` on click, Enter and Space, draws its focus ring in `currentColor` and declares no colors of its own.

```tsx
import { StaticTriggerDecoration } from '@epam/ai-dial-celebrations/packs';

export const Trigger = ({ onActivate }: { onActivate: () => void }) => (
  <StaticTriggerDecoration
    onActivate={onActivate}
    imageUrl="/images/anniversary-trigger.svg"
    label="Celebrate ten years"
  />
);
```

## Capabilities

`SUPPORTED_CELEBRATION_CAPABILITIES` is the read-only set of capability ids this release implements: `lottie-light-svg-v1`, `viewport-stage-v1`, `composer-anchor-v1`, `interaction-composer-outline-v1`, `interaction-cat-borrow-v1`, `interaction-copy-track-v1`, `interaction-button-props-v1`, `interaction-composer-carry-v1`, `interaction-history-ladder-v1`, `static-poster-v1` and `static-trigger-v1`. Any other `interaction-*` id is unsupported. A host keeps only scenes whose `requiredCapabilities` are all in the set:

```ts
import {
  SUPPORTED_CELEBRATION_CAPABILITIES,
  type CelebrationSceneDescriptor,
} from '@epam/ai-dial-celebrations';

export const isPlayable = (scene: CelebrationSceneDescriptor) =>
  scene.requiredCapabilities.every((id) =>
    SUPPORTED_CELEBRATION_CAPABILITIES.has(id),
  );
```

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

`PenguinStar`, `SnowmanDelivery`, `ElfFireworks` and `CatBauble` play on a gift click, picked at random.
`GiftWrapping` and `ReindeerTakeoff` form the secret pool for `happy new year`,
selected without consecutive repeats independently of gift clicks. Snow, confetti
and sleigh scenes are no longer included.

### Pack enums

From the main entry:

- `CelebrationCapability`: `LottieLightSvgV1`, `ViewportStageV1`, `ComposerAnchorV1`, `InteractionComposerOutlineV1`, `InteractionCatBorrowV1`, `InteractionCopyTrackV1`, `InteractionComposerCarryV1`, `InteractionHistoryLadderV1`, `StaticPosterV1`, `StaticTriggerV1`.
- `CelebrationDirectionMode`: `None`, `Mirror`, `Variant`.
- `CelebrationLayout`: `Mobile`, `Desktop`.
- `CelebrationColorScheme`: `Light`, `Dark`.
- `CelebrationPlacementTemplate`: `ViewportStageV1`, `ComposerAnchorV1`.
- `CelebrationAnchor`: `Composer`.
- `CelebrationAnchorEdge`: `Top`, `Bottom`.
- `CelebrationAnchorFallback`: `StageAnchor`, `Poster`.
- `CelebrationStageFit`: `Contain`, `Cover`.
- `CelebrationStageAlign`: `Center`, `Top`, `Bottom`, `TopStart`, `TopEnd`, `BottomStart`, `BottomEnd`.
- `CelebrationDecorationTemplate`: `StaticTriggerV1`.

## Types

`CelebrationProviderProps`, `CelebrationContextValue`, `CelebrationEvent`, `CelebrationEventLoader`, `CelebrationScene`, `CelebrationSecretTrigger`, `CelebrationDecorationProps`, `CelebrationEventSelection`, `CelebrationAnchors`, `CelebrationNotification`, `HalloweenEventOptions`, `HalloweenLabels`, `NewYearLabels`.

Pack descriptors, from the main entry: `CelebrationPackDescriptor`, `CelebrationSceneDescriptor`, `CelebrationSceneVariantDescriptor`, `CelebrationVariantConditions`, `CelebrationSceneTiming`, `CelebrationPlacementDescriptor`, `CelebrationViewportStagePlacement`, `CelebrationComposerAnchorPlacement`, `CelebrationStageRect`, `CelebrationAnchorScale`, `CelebrationExternalEventDescriptor`, `CelebrationDecorationDescriptor`, `CelebrationAssetLoaders`, `CelebrationVariantContext` and `CelebrationTextDirection`. From `./packs`: `LottieSceneProps` and `StaticTriggerDecorationProps`.

## Scenes

New Year's fir stands near the model selector while a penguin in a Santa hat
walks in directly from the side of the start-page stage. It visually pulls the
nearest eligible starter-prompt button from the page, or the idle model
selector if no prompt qualifies. The button folds down to a paper ball in its
flipper; the penguin crushes that into a gold star and throws it onto the fir. After a
surprised look and a bow to the tree, it leaves by the same side. The borrowed
button returns to its original appearance when the scene ends or is interrupted.
The working flipper follows the body's lean; the captured fragment and thrown
star share its actual grip in LTR and RTL. Short alternating steps accompany
the entrance, approach to the fir and departure. The throw uses one continuous
arc, and the feet settle during held reactions and the bow.
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
small pale feet and a restrained red Santa hat. A pale cheek and clear beak separate
the face from the glasses; the head compresses for the effort and lifts into
the throw beside a fir with rounded branch masses. The same full story runs on
mobile and in RTL. Reduced motion, unsupported browser APIs and player failures
show static art. The borrowed control is never clicked, cloned or reparented;
its reversible visual transform is cancelled when playback stops.

Typing, pointer/focus interaction, scrolling, viewport or target changes,
hidden tabs, navigation, scene replacement and motion-preference changes stop
the scene and release its player, listeners, observers and timers. The gift
picks the penguin, the snowman or the fireworks elf; the secret phrase picks the elves or reindeer.
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
Broad cheek and coat shadows soften the characters, with finer warm outlines
in both animated and static artwork. The elves work nearer the composer corners,
and the loose ribbon hangs toward its rim to leave more space around the greeting.
Cap movement and recoil remain restrained, while each frustrated hop slows on ascent and accelerates into
landing without stopping horizontally at its apex.

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
The secret phrase `happy new year` picks the elves or reindeer without
consecutive repeats; a gift click picks the penguin, the snowman, the fireworks elf or the cat. Hosts can override `giftWrappingToastMessage`
through the existing New Year labels.

New Year's reindeer takeoff, "Reindeer, Release the Brake!", has a chestnut
adult, a smaller calf in a burgundy scarf and a red gift sleigh. They walk on
the upper edge of the composer. A trailing ribbon catches a word in its text
(or the placeholder when empty). Two resisted pulls lift the word above the
rim; the calf walks back, fails one nose nudge, then lifts the loop. The word
returns before takeoff. Snow falls from the flying sleigh and stays along its
route, slowly drifting and fading even after the formation leaves.

Steps follow distance traveled, with planted soles and bending joints. The
bodies compress before pulling and takeoff; the calf turns before walking
back. Forelegs and hind legs bend differently with staggered contacts. The
adult has a fuller chest and longer antlers; the calf has a rounder face and
compact proportions. Broad fur shading and an open shoulder contour join the
neck to the torso; the calf has a clearer eye and muzzle. Neck, gaze and ear
gestures distinguish the adult's
effort from the calf's curiosity. The nose and caught loop share the articulated
neck/head geometry. During takeoff the legs extend, fold and settle into a
relaxed glide instead of continuing to walk in the air. A continuous flight
arc carries the adult first, then the calf and
sleigh with a short delay. The reins and snow follow the actual tilted rigs.
All support solving is baked before playback.

The 23-second scene uses the existing 25.5-second provider lifetime, including
the 2-second import and 250 ms renderer deadlines. The complete cast remains
on mobile, scaled to the input width. Ground travel clips to the composer;
at takeoff the clip opens to the welcome-region width. All three silhouettes
stay visible through 20.5 seconds before physically leaving the frame.

Only an inert word fragment is borrowed: at most 32 characters / 280 × 48 px,
using a text span and a cover over its original pixels. A disposable native
layout mirror reads at most 512 characters during preparation. The real
textarea's value, placeholder, focus, selection, styles and editing state are
never changed. Scrolled/clipped, invisible or transparent-ink text and
non-flat backgrounds use a small drawn catch on the rim. Hosts without
anchors use a decorative stage. Invalid supplied composers, insufficient
headroom, reduced motion, unavailable APIs or player failures show the static
resolution; reduced motion does not measure the host or load the player.
RTL mirrors travel and artwork, preserving the text's original direction.

One local native Lottie SVG composition and at most four WAAPI companions
share the renderer's frame-zero clock. Input, focus, pointer, scrolling,
viewport/target/direction changes, hidden tabs, navigation and unmount remove
the copies, snow, player, observers and animations. Hosts can disable
`NewYearScene.ReindeerTakeoff` or override `reindeerTakeoffToastMessage`.

Budgets are one player, two deer, one sleigh, 24 snow clusters on desktop or
16 on mobile; 500 KB composition data, 24 layers, 110 animated properties,
7,000 keys (380 per property), 320 generated SVG nodes, 140 paths and 2,000
vertices. Preparation scans at most four composers, four textareas and 24
background ancestors. No external/raster assets, filters, SVG masks,
per-frame host reads or React updates. These limits are structural budgets,
not a frame-rate guarantee. Run
`node libs/celebrations/browser-tests/reindeer-takeoff.browser.spec.mjs`
against Storybook at port 6010 (`STORYBOOK_URL` overrides it); captures and
profiles go to `tmp/reindeer-verification`.

New Year's snowman delivery, "Delivery Without Losing Your Head", stars a
slightly pompous snowman with a carrot nose, burgundy scarf and mittens. He
walks in with a present, eyes a small fir at the far end of his stage, then
the distance, then a starter-prompt card, and has an idea. He balances the
present on his head, jumps to grip the card (or reaches it, when it is low
enough), hangs on it until his weight tears an inert visual copy free, lowers
it in front of him and drops it onto the snow. He tests it with one foot, sits
on it hugging the present, scoots twice and glides, turning from cautious to
smug. The sled stops in a snowbank; his body squashes and his head flies on
into the fir's bough at the sled's own speed. After an indignant pause the
headless body delivers the present with a deep bow, gropes for its head and
spreads its mittens; the head sneezes, the bough flexes and drops it into the
waiting mittens — backwards. He pauses, turns it the right way round,
straightens the present, carries the card back, jumps it back into its exact
slot and leaves holding his head with both mittens.

Broad crescent shadows give the snowballs volume. The fir has rounded, uneven
boughs, with a low foreground branch lip that leaves the lodged face visible;
the supporting snow ledge has a soft outline. The static resolution uses the
same drawing treatment.

Staging follows the measured page: with starters below the composer (the
chat's default) he works on a drawn snow ledge under the starter row, low
enough that his seated head clears the row; with starters above the composer
and a clear band, he rides the composer's snowy upper edge; without an
eligible card he uses a drawn sled, and when the rim is crowded he plays on a
snowy platform below the page content. When no band fits, the scene shows a
static snowman holding his head beside the delivered present. The scene is
clipped to the welcome region, and he walks in from at most 200 units before
his pickup spot. Travel shortens on mobile, where the story is otherwise
complete; RTL mirrors travel and staging but never the copied card's text.

One 25-second native Lottie SVG composition carries the cast and props, with
the snowman in one precomposition so a single opacity fades him in and out;
the provider allows 27.5 seconds. The card copy is an inert, `aria-hidden`
snapshot driven by WAAPI keyframes generated from the same plan and started on
the Lottie clock through the session's `onPlaybackStarted` callback, which
reports the document-timeline time of frame 0. Only the original card's
opacity is animated, from the grip until the copy is back in its rect; the
card is never clicked, focused or reparented, and its original returns at once
on completion or any interruption. An eligible card is idle, visible,
unfocused, at most 240 × 96 px with at most 40 nodes, in the starter row next
to the chosen stage.

Typing, pointer/focus interaction, scrolling, viewport or target changes,
hidden tabs, navigation and motion-preference changes stop the scene and
release its player, card copy, listeners, observers and timers. Hosts can
override `snowmanDeliveryToastMessage` through the New Year labels. The scene
budgets one player, one card copy, at most 16 top-level layers, 56 animated
properties (48 on mobile), 128 keyframes per property, 1,300 keyframes in
total, 170 KB of composition data and 10 snow puffs (4 on mobile). It uses no
external assets, filters, masks, gradients or per-frame host measurements;
these limits are not a frame-rate guarantee.

New Year's elf fireworks, "Some Buttons Were Made for Launching", reuses the
gift-wrapping master elf. He fades in on the composer's upper edge with a sack of
rockets, sets the sack down and tosses the rockets one by one onto the rim, where
each lands upright with a wobble. Wondering what could launch them, he looks
along the rim, walks to the composer's send button, lowers a candy cane, hooks
an inert visual copy of the button, tugs twice and yanks it over his shoulder
onto the rim. A press by hand does nothing; he scratches his cap, then jumps on
the button with both boots. The fuses spark, the rockets fire from the far end
of the rack and burst across the whole viewport above the composer while he
cheers with two hops on the squashed button. He hops off, kicks the copy back
into its exact slot and walks to the last rocket, which only fizzles. He peers
into it, it fires, and he rides it away holding on; his cap flutters down to the
rim, the final burst goes off, he falls back beside the cap, shakes off the
dizziness, puts the cap on, bows and leaves with his sack.

The send button is the composer's inline-end-most button. It is borrowed only
when it is idle, visible, unfocused, unhovered, untransformed, 24–120 × 24–64 px
with at most 40 nodes, inside the composer and far enough toward its end, and
when a cane of at most 200 px reaches its top; a disabled button still qualifies,
since only its copy moves. Otherwise he pulls a drawn detonator out of the sack
and the story is the same, without borrowing anything. Without an eligible
composer that leaves 170 px of headroom (140 px on mobile), the scene shows a
static elf under one burst. Reduced motion, unsupported browser APIs and player
failures show the same still. RTL mirrors the rim and the travel but never the
copied button's text. Mobile keeps the full story with fewer rockets and
smaller bursts.

One 25.6-second native Lottie SVG composition carries the elf, rockets, bursts
and props; the provider allows 28.1 seconds. The button copy is an inert,
`aria-hidden` snapshot driven by WAAPI keyframes generated from the same plan
and started on the Lottie clock through the session's `onPlaybackStarted`
callback; only the original's opacity is animated, from the hook until the copy
is back in its rect, and the original is never clicked, focused or reparented.
Typing, pointer/focus interaction, scrolling, viewport or target changes, hidden
tabs, navigation and motion-preference changes stop the scene and release its
player, copy, listeners, observers and timers. Hosts can override
`elfFireworksToastMessage` through the New Year labels. The scene budgets one
player, one button copy, at most 17 layers, 6 rockets with 5 bursts of 12 sparks
plus an 18-spark finale (4 rockets, 3 × 8 + 12 sparks on mobile) and 220 KB of
composition data (150 KB on mobile). It uses no external assets, filters, masks,
gradients or per-frame host measurements; these limits are not a frame-rate
guarantee.

New Year's cat, "The bauble", stars a grey tabby with a red collar and a gold
bell. It trots along the composer's upper rim toward a small fir at the rim's
far end, where one hook hangs empty. Its pupils widen, it wiggles its rear and
pounces at the lowest bauble, which swings away; it misses, lands forepaws
first and grooms a paw as if nothing happened. Then it notices the composer's
model selector, lies on the rim, stretches a foreleg over the edge and flicks
an inert visual copy of the selector up onto the rim, then swats it. The copy
slides into the fir's trunk, the fir shakes and leans toward the frozen cat
(ears flat, tail puffed) and the copy pops onto the empty hook, where it hangs
like a new ornament. The cat admires it, rears up, takes it in its mouth by the
same grip near its fir-side end, carries it home, lowers it into its exact
slot, curls up beside it, stretches and walks off.

The fir stands at the rim end farther from the selector, so the story fits
wherever the host places it; RTL mirrors the travel and artwork but never the
copy's text. A selector is borrowed only when it is the first
`composerModelSelector` element inside the composer: an idle, visible, enabled,
unexpanded, unfocused, unhovered and untransformed button of 36–140 × 24–44 px
with at most 40 nodes, short enough to hang clear of the rim and within the
lying cat's reach (about 44 px below the rim on desktop, 36 px on mobile).
Otherwise a drawn tangerine plays the same story and nothing is borrowed.
Without a composer at least 320 px wide (260 px on mobile) with 180 px of
headroom (150 px on mobile), the scene shows a static cat under the fir with a
drawn ornament on the hook; reduced motion, unsupported browser APIs and player
failures show the same still. Mobile keeps the whole story with a smaller cast.

One 23-second native Lottie SVG composition carries the cat, the fir and the
tangerine; the provider allows 25.5 seconds. The copy is an inert,
`aria-hidden` snapshot driven by WAAPI keyframes generated from the same plan
and started on the Lottie clock through the session's `onPlaybackStarted`
callback; only the original's opacity is animated, from the paw contact until
the copy is back in its rect, and the original is never clicked, focused or
reparented. Typing, pointer/focus interaction, scrolling, viewport or target
changes, hidden tabs, navigation and motion-preference changes stop the scene
and release its player, copy, listeners, observers and timers. Hosts can
override `catBaubleToastMessage` through the New Year labels. The scene budgets
one player, one copy, at most 8 layers, 60 animated properties (48 on mobile),
1,400 keyframes with 160 per property, 180 KB of composition data (130 KB on
mobile) and 200 vector groups and shapes. It uses no external assets, filters,
masks, gradients or per-frame host measurements; these limits are not a
frame-rate guarantee.

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

| Key          | Class                           | Element                                                    |
| ------------ | ------------------------------- | ---------------------------------------------------------- |
| `decor`      | `dial-celebrations-decor`       | Wrapper of the active event's decoration                   |
| `trigger`    | `dial-celebrations-trigger`     | The event's trigger button (pumpkin, gift, static trigger) |
| `sceneLayer` | `dial-celebrations-scene-layer` | Viewport layer a playing scene renders in                  |

## Storybook

Every scene, decoration and decoration behavior has a story, plus a playground for host selection:

```sh
npm exec nx storybook @epam/ai-dial-celebrations
```
