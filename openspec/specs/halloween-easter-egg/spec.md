# Spec: halloween-easter-egg

## Purpose

The seasonal Halloween easter egg in the chat app: what the `halloweenEnabled` feature flag turns on, the two gestures that trigger a celebration — a click on the pumpkin for a flock of ghosts, the secret phrase for a drop of spiders — and the guarantees that keep a decorative feature from affecting chat behaviour.

## Requirements

### Requirement: HalloweenProvider owns the easter egg and gates it on halloweenEnabled

`HalloweenProvider` (`apps/chat/src/context/HalloweenContext.tsx`) SHALL read `useFeatureFlag('halloweenEnabled')` (see `config-registry-and-env-provider`) and expose `isEnabled`, `celebrate(burst)`, and `consumeSecretPhrase(text)`.

While the flag is `false`, `celebrate` SHALL be a no-op and `consumeSecretPhrase` SHALL always return `false`, so the phrase reaches the model as an ordinary message. Because `useFeatureFlag` already returns `false` until the client config is ready, the easter egg SHALL stay dark during config load rather than flashing on.

`useHalloween` SHALL resolve to a permanently disabled easter egg outside the provider instead of throwing, unlike the app's other context hooks: its consumers sit inside both conversation composers, which are mounted in trees that legitimately skip the provider, and a decorative feature must not break them.

Turning the flag off mid-session SHALL clear any celebration in flight — the client config is re-fetched, so the value can flip without a reload.

#### Scenario: The flag is off

- **WHEN** `features.halloweenEnabled` is `false`
- **THEN** `isEnabled` is `false`, `celebrate` renders no celebration and raises no notification, and `consumeSecretPhrase` returns `false` for every input

#### Scenario: Used outside the provider

- **WHEN** a component calling `useHalloween` is rendered with no `HalloweenProvider` ancestor
- **THEN** the hook returns a disabled easter egg rather than throwing

### Requirement: The secret phrase celebrates instead of sending

Both conversation inputs — `NewConversationComposer`'s `handleSend` and `ConversationView`'s `handleSendWithAnchor` — SHALL route the outgoing text through `consumeSecretPhrase` before anything else and SHALL return early when it returns `true`, creating no conversation, sending no message, and arming no scroll anchor.

`consumeSecretPhrase` SHALL match `HALLOWEEN_SECRET_PHRASE` ("trick or treat") against the whole input after normalization that lowercases it and collapses every non-latin-letter run into a single space, so "Trick-or-Treat!" matches. A longer message that merely contains the phrase SHALL NOT match, and SHALL send normally.

#### Scenario: The phrase is sent from either input

- **WHEN** the flag is on and the user sends exactly "trick or treat", in any casing or punctuation, from the empty-chat composer or from inside a conversation
- **THEN** the spider drop plays, the Halloween notification is raised, and no message is sent

#### Scenario: A message containing the phrase still sends

- **WHEN** the flag is on and the user sends a longer message containing the phrase
- **THEN** the message is sent normally and no celebration plays

### Requirement: The empty chat carries seasonal decoration with a pumpkin trigger

While the flag is on, `NewConversationComposer` SHALL render `HalloweenDecor` inside its welcome-screen region: cobwebs pinned to the region's inline-start and inline-end top corners, `HALLOWEEN_DECOR_BAT_COUNT` drifting bats, and a pumpkin button. `HalloweenDecor` SHALL additionally render nothing of its own when the flag is off, so the call site needs no second gate.

A single click on the pumpkin SHALL play the ghost celebration, and every further click SHALL play a freshly laid-out one — the gesture carries no hidden click count to discover.

Every celebration SHALL raise a success notification and SHALL clear itself after `HALLOWEEN_BURST_DURATION_MS`, which SHALL outlast the longest animation in `Halloween.module.scss`. Repeating the same celebration SHALL restart its animations rather than leave the layer untouched.

`HalloweenDecor` and `HalloweenBurstOverlay` SHALL both be loaded on demand, so a deployment with the flag off pays for neither the components nor their stylesheet.

#### Scenario: One click releases the flock

- **WHEN** the flag is on and the user clicks the pumpkin once
- **THEN** the ghost celebration plays and the notification is raised

#### Scenario: A further click releases a new flock

- **WHEN** the user clicks the pumpkin again
- **THEN** a newly laid-out flock plays, on different paths from the previous one

#### Scenario: Nothing renders on the empty chat while the flag is off

- **WHEN** the flag is `false`
- **THEN** the empty-chat screen renders no cobwebs, bats, or pumpkin, and neither the decor nor the celebration layer is loaded

### Requirement: The ghost celebration is a flock of individuals, not one sprite

`buildHalloweenGhostFlight` SHALL lay out `HALLOWEEN_GHOST_COUNT` ghosts, each with its own entry edge, arc, size, tilt, opacity, pace and start delay, so the flock reads as individuals rather than a row moving as one body. A ghost SHALL enter from off-screen on one side at its own height, cross the viewport along an arc whose midpoint sits above the straight line between entry and exit, and leave past the opposite edge — entry and exit are always on opposite sides, so no ghost turns around mid-flight. Entry edges SHALL alternate, so ghosts cross in both directions.

Each ghost SHALL be drawn as one of the `HalloweenGhostVariant` silhouettes, cycled so no two neighbours in the flock are alike, as inline SVG rather than an emoji — the variants differ in outline, face and fill, and the fills come from the repo's visual-background tokens so a retheme carries them. Its vertical bob SHALL animate on an inner element, so it composes with the flight instead of competing for the same `transform`.

Offsets SHALL be expressed in `vw`/`vh` and passed as custom properties, so one keyframe set serves every flock and a flight crosses the viewport at any size. The paths are deliberately direction-agnostic — each ghost picks its own side — so the flock SHALL NOT flip under RTL.

#### Scenario: Every ghost flies its own path

- **WHEN** a ghost celebration is laid out
- **THEN** it contains `HALLOWEEN_GHOST_COUNT` ghosts, no two sharing a path, entering from both sides, each starting and ending off-screen

#### Scenario: The flock mixes silhouettes

- **WHEN** a ghost celebration renders
- **THEN** more than one silhouette is drawn, and no two consecutive ghosts share one

### Requirement: The spider celebration abseils from the top edge

`buildHalloweenSpiderDrop` SHALL lay out `HALLOWEEN_SPIDER_COUNT` spiders, one per column across the viewport and jittered inside it, so the drop spreads instead of clumping wherever chance puts it. Every spider SHALL get its own thread length, size, sway angle, sway pace, descent pace and start delay.

Each spider SHALL descend from the viewport's top edge on a thread, hang and sway there, then climb back up the way it came, all within one animation cycle. The thread's anchor SHALL stay fixed at the top edge for the whole descent — the element is as tall as its thread and starts fully above the viewport, so translating it down by its own height pays the thread out rather than moving a rigid stick. The sway SHALL pivot at the top of the thread, so the spider swings like the weight on a pendulum rather than sliding sideways.

The spider SHALL be drawn as inline SVG, not an emoji, with body and legs taking control tokens so it keeps its contrast when the surface flips between the light and dark theme.

#### Scenario: Spiders spread across the viewport

- **WHEN** a spider drop is laid out
- **THEN** it contains `HALLOWEEN_SPIDER_COUNT` spiders in strictly left-to-right columns, every column inside the viewport, and thread length, size and pace differ between them

#### Scenario: A spider leaves the way it came

- **WHEN** a spider has finished descending and swaying
- **THEN** it climbs back above the top edge, leaving nothing behind when the burst ends

### Requirement: The ghost toast names the secret phrase

The pumpkin is discoverable — it sits on the empty-chat screen — while the phrase is not, and nothing else on screen hints that one exists. The ghost celebration's notification SHALL therefore name `HALLOWEEN_SECRET_PHRASE`, interpolated into the message rather than written into the locale string, so the two cannot drift apart.

#### Scenario: Clicking the pumpkin reveals the phrase

- **WHEN** the flag is on and the user clicks the pumpkin
- **THEN** the notification's message is resolved with the secret phrase as its interpolation argument

### Requirement: The easter egg is inert, accessible, and motion-safe

The easter egg SHALL persist nothing, read no storage, and issue no request; all of its state is in-memory and per-tab.

**Accessibility:** The cobwebs, bats, and falling glyphs are decorative — they SHALL sit in `aria-hidden`, pointer-transparent layers, and the only announcement SHALL be the notification each celebration raises. The pumpkin SHALL be a labelled `GhostIconButton` kept outside the `aria-hidden` layer, so it stays focusable and is never an unreachable control inside a hidden subtree. The celebration layer SHALL be portaled to `document.body` so no scroll container clips it.

**RTL:** The decoration SHALL use logical positioning so the corners and the ghost's flight direction follow the document's `dir`; the end-corner cobweb is a mirrored copy of the same drawing.

**Reduced motion:** Every animation the feature adds SHALL be suppressed under `prefers-reduced-motion: reduce`, resolving to a static frame rather than to an empty screen. Because an un-animated ghost would otherwise sit at the layer's origin with the rest of the flock stacked on top of it, each one SHALL carry a spread-out resting position used in that state; an un-animated spider SHALL likewise render already paid out on its thread rather than parked above the top edge.

**i18n impact:** Four keys under `halloween.*` — the shared toast title, one message per celebration (the ghost one interpolating `{{phrase}}`), and the pumpkin's accessible name.

#### Scenario: A reduced-motion user still sees a celebration

- **WHEN** the flag is on, the user's system asks for reduced motion, and a celebration is triggered
- **THEN** the notification is raised and the drawings render in static, spread-out, on-screen positions instead of animating, with nothing left frozen off-screen or stacked at the origin
