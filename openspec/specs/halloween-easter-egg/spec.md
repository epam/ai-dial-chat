# Spec: halloween-easter-egg

## Purpose

The seasonal Halloween easter egg in the chat app: what the `halloweenEnabled` feature flag turns on, the two gestures that trigger a celebration, and the guarantees that keep a decorative feature from affecting chat behaviour.

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
- **THEN** the treats celebration plays, the Halloween notification is raised, and no message is sent

#### Scenario: A message containing the phrase still sends

- **WHEN** the flag is on and the user sends a longer message containing the phrase
- **THEN** the message is sent normally and no celebration plays

### Requirement: The empty chat carries seasonal decoration with a pumpkin trigger

While the flag is on, `NewConversationComposer` SHALL render `HalloweenDecor` inside its welcome-screen region: cobwebs pinned to the region's inline-start and inline-end top corners, `HALLOWEEN_DECOR_BAT_COUNT` drifting bats, and a pumpkin button. `HalloweenDecor` SHALL additionally render nothing of its own when the flag is off, so the call site needs no second gate.

`HALLOWEEN_PUMPKIN_CLICKS` clicks on the pumpkin SHALL play the ghost celebration and reset the count, so a further run of clicks plays it again. A partial run SHALL do nothing.

Every celebration SHALL raise a success notification and SHALL clear itself after `HALLOWEEN_BURST_DURATION_MS`, which SHALL outlast the longest animation in `Halloween.module.scss`. Repeating the same celebration SHALL restart its animations rather than leave the layer untouched.

`HalloweenDecor` and `HalloweenBurstOverlay` SHALL both be loaded on demand, so a deployment with the flag off pays for neither the components nor their stylesheet.

#### Scenario: The pumpkin wakes the ghost on the last click of a run

- **WHEN** the flag is on and the pumpkin has been clicked `HALLOWEEN_PUMPKIN_CLICKS - 1` times
- **THEN** nothing has happened yet; the next click plays the ghost celebration, raises the notification, and starts the count over

#### Scenario: Nothing renders on the empty chat while the flag is off

- **WHEN** the flag is `false`
- **THEN** the empty-chat screen renders no cobwebs, bats, or pumpkin, and neither the decor nor the celebration layer is loaded

### Requirement: The easter egg is inert, accessible, and motion-safe

The easter egg SHALL persist nothing, read no storage, and issue no request; all of its state is in-memory and per-tab.

**Accessibility:** The cobwebs, bats, and falling glyphs are decorative — they SHALL sit in `aria-hidden`, pointer-transparent layers, and the only announcement SHALL be the notification each celebration raises. The pumpkin SHALL be a labelled `GhostIconButton` kept outside the `aria-hidden` layer, so it stays focusable and is never an unreachable control inside a hidden subtree. The celebration layer SHALL be portaled to `document.body` so no scroll container clips it.

**RTL:** The decoration SHALL use logical positioning so the corners and the ghost's flight direction follow the document's `dir`; the end-corner cobweb is a mirrored copy of the same drawing.

**Reduced motion:** Every animation the feature adds SHALL be suppressed under `prefers-reduced-motion: reduce`, resolving to a static frame rather than to an empty screen.

**i18n impact:** Four keys under `halloween.*` — the shared toast title, one message per celebration, and the pumpkin's accessible name.

#### Scenario: A reduced-motion user still sees a celebration

- **WHEN** the flag is on, the user's system asks for reduced motion, and a celebration is triggered
- **THEN** the notification is raised and the glyphs render in a static position instead of animating, with nothing left frozen off-screen
