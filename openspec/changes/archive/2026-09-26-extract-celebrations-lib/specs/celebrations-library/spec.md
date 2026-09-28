## ADDED Requirements

### Requirement: Celebrations ship as a publishable npm library

The celebration runtime, the Halloween and New Year events, every scene, every decor and their styles SHALL live in `libs/celebrations`, published as `@epam/ai-dial-celebrations`. The manifest SHALL follow the workspace library rules: `description` and `license: "Apache-2.0"` after `name`/`version`, `type: "module"`, the Nx tag `publishable` with the shared `publish` target, third-party packages in `dependencies`, and only `react`, `react-dom`, `@epam/ai-dial-chat-shared` and `@epam/ai-dial-ui-kit` as peers at the workspace-wide ranges.

The package SHALL expose exactly these entry points: `.` (runtime), `./halloween`, `./new-year`, `./styles.css` and `./package.json`. `CELEBRATIONS_CLASS` SHALL list the public `dial-celebrations-*` classes the library emits on its own decor root, trigger and scene layer. `./halloween` and `./new-year` SHALL build to separate files so a host that lazy-loads an event only downloads that event. Every export target SHALL be a file the build emits. The README SHALL follow the library README shape (Overview, Installation with the stylesheet import, Peer Dependencies, one subsection per export) and its public class table SHALL match `CELEBRATIONS_CLASS`.

#### Scenario: The package builds every entry point

- **WHEN** the library is built
- **THEN** `dist` contains the runtime, `halloween` and `new-year` modules with type declarations and a single `index.css`, and every `exports` target resolves to an emitted file

#### Scenario: The package is published with the other libraries

- **WHEN** the publish pipeline runs for projects tagged `publishable`
- **THEN** `@epam/ai-dial-celebrations` is published with the release version and its manifest passes `npm run validate:docs`

### Requirement: The provider owns celebration state and hosts supply every external input

`CelebrationProvider` SHALL own the loaded event, the active scene, its deadline and the previous click selection; `useCelebration()` SHALL expose `{ event, isEnabled, activate, celebrate, consumeSecretPhrase }` and SHALL return an inert value outside the provider. The provider SHALL receive every host concern as a prop:

- `events`: a map from event id to an async loader returning a `CelebrationEvent` (hosts pass `() => import('@epam/ai-dial-celebrations/halloween')` etc.);
- `activeEventId`: the event to show, or `null`; the host decides route and readiness gating;
- `resetKey`: any value whose change cancels the active scene and reloads the event (hosts pass their navigation key);
- `labels`: per-event label overrides (see the labels requirement);
- `onNotify({ title, message })`: called once per played scene;
- `isMobile`: the host's layout breakpoint result, forwarded to scenes;
- `anchors`: host DOM class names (see the anchors requirement);
- `selection`: per-event scene and decor selection (see the selection requirement);
- `portalContainer`: where scenes render, defaulting to `document.body`.

The context value, resolved labels and the enabled scene pools SHALL be memoized so unrelated host re-renders neither restart a scene nor re-roll its layout. A loader rejection, unknown id or stale load (the id or reset key changed first) SHALL leave the host with no celebration and no error.

#### Scenario: The host changes route mid-scene

- **WHEN** a scene is playing and the host passes a new `resetKey`
- **THEN** the scene unmounts at once and no timer from it fires later

#### Scenario: The host is not ready

- **WHEN** `activeEventId` is `null`
- **THEN** no loader runs, `isEnabled` is `false`, `CelebrationDecor` renders nothing and `consumeSecretPhrase` returns `false`

### Requirement: Hosts choose which scenes and decor behaviours are shown

`selection` SHALL accept, per event id, `enabledScenes` (when set, only these scenes may play), `disabledScenes` (never play), `disabledDecorBehaviors` and `isSecretEnabled` (default `true`). The Halloween entry SHALL export `HalloweenScene` (16 members) and `HalloweenDecorBehavior` (`SpiderFlee`, `SpiderDrop`, `SpiderDrum`, `PumpkinWrap`); the New Year entry SHALL export `NewYearScene` (3 members). Defaults SHALL enable everything, reproducing today's behaviour.

Disabled scenes SHALL be removed from both the click pool and the secret pool before random selection, and `celebrate(id)` SHALL ignore a disabled id. A click with an empty click pool SHALL do nothing. A secret phrase SHALL be consumed only when `isSecretEnabled` is true and at least one of its scenes is enabled; otherwise the text SHALL be sent normally. A disabled decor behaviour SHALL never start (its timers and listeners are not installed) while the rest of the decor keeps working. Unknown ids in a selection SHALL be ignored.

#### Scenario: A host switches off one scene

- **WHEN** the host disables `HalloweenScene.Cat` and the user clicks the pumpkin repeatedly
- **THEN** every other click scene can play and the cat never does

#### Scenario: A host keeps only one scene

- **WHEN** `enabledScenes` for Halloween is `[HalloweenScene.Ghost]`
- **THEN** every pumpkin click plays the ghosts and the secret phrase is sent as a normal message, because none of its scenes is enabled

#### Scenario: A host disables the pumpkin wrap

- **WHEN** `disabledDecorBehaviors` contains `HalloweenDecorBehavior.PumpkinWrap` and the page stays idle past the wrap delay
- **THEN** the corner spider keeps fidgeting and dropping on its thread but never climbs down to the pumpkin

#### Scenario: A host disables the secret phrase

- **WHEN** `isSecretEnabled` is `false` and the user sends `trick or treat`
- **THEN** `consumeSecretPhrase` returns `false` and the message is sent normally

### Requirement: Visible text comes from labels with English defaults

The library SHALL NOT import i18n. Each event SHALL export its label type and English defaults (`HALLOWEEN_LABELS`, `NEW_YEAR_LABELS`) covering the notification title, one notification message per scene, and each trigger's accessible name (pumpkin, gift). The provider SHALL merge `labels[eventId]` over the defaults and SHALL interpolate `{{phrase}}` in messages with the event's secret hint phrase when the secret is enabled and with an empty hint otherwise. English defaults SHALL equal the current DIAL Chat `en.json` text.

#### Scenario: A host translates one message

- **WHEN** the host passes `labels.halloween.ghostToastMessage` and the ghosts play
- **THEN** `onNotify` receives the host's message with `{{phrase}}` replaced, and every other scene still uses its default

#### Scenario: The trigger keeps an accessible name

- **WHEN** the Halloween decor renders with no label overrides
- **THEN** the pumpkin button's accessible name is the English default

### Requirement: Host DOM anchors are injected, never discovered from other libraries

The library SHALL NOT import other workspace libraries' class constants and SHALL NOT know host routes. `anchors` SHALL provide class names for `composer`, `composerAddCluster`, `composerModelSelector` and `starterList`; `historyContainer` (a class name) with `historyRowLink` (a selector for a conversation link inside it, whose enclosing list item is the row); and `welcomeRegion` (a selector for the start-page region around the composer, defaulting to the composer's closest `[role="region"]`). Scenes SHALL measure anchors once at start. When an anchor is missing or not found, each scene SHALL use its existing decorative fallback instead of failing.

#### Scenario: A host without a composer anchor

- **WHEN** `anchors.composer` is omitted and the cat scene plays
- **THEN** the decorative crossing cat plays and no interface element is borrowed

#### Scenario: A host without history anchors

- **WHEN** `anchors.historyContainer` is omitted and the portal scene plays
- **THEN** it uses its no-history fallback and borrows no conversation row

### Requirement: The library stays isolated from its host

No file in `libs/celebrations/src` SHALL import `react-i18next`, a router, an `apps/*` module, an environment variable, a storage API, a network API or another workspace library except the declared peers. Everything the library draws SHALL stay decorative: artwork and scene layers `aria-hidden` and pointer-transparent, triggers labelled and keyboard-operable (Enter/Space), and every animation suppressed under `prefers-reduced-motion: reduce` with static visible positions. Layout SHALL use logical properties so decor follows `dir`, while measured scene geometry stays physical, preserving today's RTL behaviour. The library SHALL add no feature flag, telemetry, persistence or cache; hosts gate it by passing or withholding `activeEventId`.

#### Scenario: The isolation check

- **WHEN** lint and dependency checks run on the library
- **THEN** they report no import of i18n, router, app modules or undeclared workspace libraries

### Requirement: Storybook covers every scene and decor behaviour

The library SHALL own a Storybook (`libs/celebrations/.storybook`, React/Vite framework) with `storybook` and `build-storybook` targets. There SHALL be one story per `HalloweenScene` and `NewYearScene` member, a story per event decor, a story per `HalloweenDecorBehavior`, and a provider playground whose controls toggle scenes, decor behaviours and the secret phrase. Scene stories SHALL render inside a fixture host page that carries every anchor (composer, starter list, a history container with conversation links, a welcome region) and passes them through `anchors`, so interface-borrowing scenes show their full story; stories SHALL offer a reduced-motion variant. A unit test SHALL fail when any scene or decor behaviour member lacks a story. The PR workflow SHALL run `build-storybook`; the built Storybook SHALL NOT be deployed.

#### Scenario: A new scene without a story

- **WHEN** a member is added to `HalloweenScene` and no story references it
- **THEN** the story-coverage test fails

#### Scenario: CI builds Storybook

- **WHEN** a pull request changes the library
- **THEN** the PR workflow builds Storybook and fails the check if the build fails

### Requirement: DIAL Chat integrates through an app-level adapter

`apps/chat` SHALL contain no celebration scenes, scene utilities, constants or scene styles. A `CelebrationHost` component in the app SHALL render `CelebrationProvider` and resolve: `activeEventId` as `config.activeEventId` only when the user config is ready and the route is `/`; `resetKey` as the location key; labels from `t()` using the existing `halloween.*` and `newYear.*` keys; `onNotify` via `showSuccessNotification`; `isMobile` via `useIsMobile`; anchors from `CONVERSATION_INPUT_CLASS`, `STARTER_BUTTONS_CLASS`, the app's own history-panel class with a link selector built from `ROUTES.Conversations`, and the welcome region; and all scenes enabled. The composer, header logo and navigation favicon SHALL consume `useCelebration` and `CelebrationDecor` from the library; the conversation panel keeps an app-owned class that only the adapter passes on. `UI_EVENT` handling SHALL be unchanged.

#### Scenario: DIAL Chat behaves as before

- **WHEN** `UI_EVENT=halloween` and the user clicks the pumpkin on `/`
- **THEN** the same scenes, notifications, secret phrase and decor behaviours occur as before the extraction
