# celebration-lottie-playback-session Specification

## Purpose

The shared lazy Lottie playback lifecycle inside `libs/celebrations`: the player module, the imperative session and its React hook, ownership of every timer, listener, observer and cleanup step, the provider/session boundary, readiness, cancellation, exactly-once teardown, composition ownership, and the behavior GiftWrapping and PenguinStar keep. Defined by S1 (#9220).

## Requirements

### Requirement: One shared lazy player module

`libs/celebrations/src/utils/lottie-player.ts` SHALL be the only module that imports `lottie-web/build/player/lottie_light`. It SHALL do so only through a dynamic `import()`.

The module SHALL:

- hold no module-level mutable state: no memoized promise, no `AnimationItem` and no cache
- define the `lottie-light-svg-v1` `loadAnimation` options and the `setSubframe(true)` call in one helper
- replace `new-year/utils/gift-wrapping-player.ts`, which SHALL be removed

GiftWrapping and PenguinStar SHALL both use this module, and SHALL share only the player module.

Neither the module, the session nor the hook SHALL be exported from `src/index.ts`, `src/halloween/index.ts` or `src/new-year/index.ts`.

#### Scenario: The player stays in a lazy chunk
- **WHEN** `npm exec nx run @epam/ai-dial-celebrations:build` and `npm exec nx run @epam/chat:build` complete
- **THEN** the New Year output reaches the `lottie_light` chunk only through a dynamic `import(`, and neither the runtime entry nor the Halloween entry references `lottie_light`

#### Scenario: No download without an active Lottie scene
- **WHEN** the New Year event is loaded but neither GiftWrapping nor PenguinStar is active
- **THEN** the player loader has not been called and no `lottie_light` chunk has been requested

### Requirement: Ownership boundary between provider, session and scene adapter

**`CelebrationProvider`** SHALL keep owning:

- the scene lifetime (`durationMs`)
- mount and unmount
- replay identity (`token`)
- the single `onNotify` call

The session SHALL NOT notify, select scenes or extend the lifetime.

**The session** (`utils/lottie-scene-session.ts`) SHALL own:

- the player import
- the load deadline, the readiness deadline and the playback deadline
- renderer creation, its Lottie listeners and readiness
- cancellation
- destruction of the `AnimationItem`

**The scene adapter** SHALL own:

- target measurement
- geometry
- composition building
- choreography
- static artwork
- interrupt-event policy
- target observers

The adapter SHALL hand its observers to the session as disposers.

**The React hook** (`hooks/useLottieSceneSession.ts`) SHALL own only:

- React state for the phase and the preparation
- the host element ref
- creating and disposing one session per effect run

#### Scenario: Scene observers are released by the session
- **WHEN** GiftWrapping's adapter registers its `MutationObserver` and `ResizeObserver` through the context's `addDisposer` and the session reaches any terminal state
- **THEN** the session runs those disposers once, and no observer remains connected

#### Scenario: Notifications stay with the provider
- **WHEN** a GiftWrapping scene completes, is cancelled or fails
- **THEN** `onNotify` has been called exactly once, by `celebrate()`, and the session caused no additional call

### Requirement: Lifecycle states and distinct terminal outcomes

The session SHALL expose its phase as the string enum `LottieSceneSessionState`, with the members `idle`, `loading`, `prepared`, `initializing`, `playing`, `completed`, `cancelled` and `failed`. It SHALL report terminal outcomes as the string enum `LottieSceneOutcome`: `completed`, `cancelled` and `failed`.

Exactly one terminal outcome SHALL be reached per session, and no later trigger SHALL change it.

The hook SHALL map the outcomes as follows:

- `completed` and `cancelled` → an ended scene (renders nothing)
- `failed` → the scene's static fallback

A cancelled scene SHALL NOT later show the fallback.

#### Scenario: Cancellation then a late load timeout
- **WHEN** the user types while the player import is pending, and 2000 ms later the load deadline would have elapsed
- **THEN** the outcome stays `cancelled`, the static elves never appear, and no timer remains

#### Scenario: Completion and deadline race
- **WHEN** the Lottie `complete` event, the playback deadline and a user interrupt arrive in the same task
- **THEN** only the first one decides the outcome, and teardown runs once

### Requirement: Activation and preparation order

The session SHALL defer its start by one microtask.

When it is disposed before that microtask, it SHALL never call the loader. When the document is hidden at that point, the outcome SHALL be `cancelled` without an import.

The load deadline SHALL be armed immediately before the loader is called. It SHALL be cleared when the import settles.

After the import resolves, the session SHALL:

1. re-check `document.hidden` and end as `cancelled` when the document is hidden
2. call the adapter's `prepare(player)`, which measures targets and builds the composition, so measurement always follows the asynchronous import
3. publish the preparation, so that the host element can render

A disabled hook (`enabled: false`, used for reduced motion, missing observers or a changed environment) SHALL create no session and SHALL never call the loader.

#### Scenario: Reduced motion shows the poster without the player
- **WHEN** GiftWrapping mounts with `prefers-reduced-motion: reduce`
- **THEN** the static elves render, the loader is never called, and the composer is never measured

#### Scenario: Measurement waits for the player
- **WHEN** the player import resolves 1900 ms after mount
- **THEN** `getGiftWrappingTarget` is first called after that resolution and exactly once

### Requirement: Timing within the provider lifetime

The session SHALL take `{ loadTimeoutMs, readyTimeoutMs, playbackMs }` from the scene adapter and run them as three sequential waits:

- the **load** wait, from immediately before the import until the import settles
- the **readiness** wait, from the moment `loadAnimation` returns until readiness
- the **playback** wait, from readiness on

Each wait SHALL be armed once on its own transition and cleared before the next wait is armed. A re-render SHALL NOT re-arm a wait or restart the session.

GiftWrapping SHALL use 2000, 250 and 16000 ms. Their sum, 18250 ms, SHALL NOT exceed its provider `durationMs` of 18500 ms. Provider unmount SHALL end the session at any point.

#### Scenario: Playback time starts at readiness
- **WHEN** `DOMLoaded` arrives 200 ms after `loadAnimation`
- **THEN** the scene is still playing 15900 ms after readiness, and is released at 16000 ms after readiness

#### Scenario: A re-render does not reset the load deadline
- **WHEN** the import is pending, the parent re-renders at 1900 ms with unchanged `enabled`, and 100 ms more pass
- **THEN** the load deadline fires at 2000 ms after it was armed, and the loader has been called once

#### Scenario: The budget is checked
- **WHEN** the GiftWrapping unit suite runs
- **THEN** it asserts that `GIFT_WRAPPING_TIMINGS` is 2000/250/16000 and that their sum is at most `NEW_YEAR_SCENE_DURATIONS[NewYearScene.GiftWrapping]` (18500)

### Requirement: Renderer readiness requires DOMLoaded on a loaded renderer

Readiness SHALL require both of these:

- a `DOMLoaded` event received in the `initializing` state
- `animation.isLoaded === true` at that moment

The session SHALL end as `failed` in these cases:

- `DOMLoaded` arrives while `isLoaded` is false (immediately)
- `isLoaded` is set but `DOMLoaded` never arrives (at `readyTimeoutMs`)
- `loadAnimation`, `setSubframe` or `play()` throws
- the adapter's `onAnimationCreated` throws
- `data_failed` or `error` fires before a terminal state

The following SHALL be ignored:

- a repeated `DOMLoaded`
- any Lottie callback that arrives after the terminal state

#### Scenario: isLoaded alone is not readiness
- **WHEN** the renderer reports `isLoaded = true` but never emits `DOMLoaded`
- **THEN** the session fails at 250 ms, `play()` is never called, and the static fallback appears

#### Scenario: Repeated readiness
- **WHEN** `DOMLoaded` is emitted twice
- **THEN** `play()` is called once and one playback deadline is armed

### Requirement: Cancellation in every phase, with stale completion ignored

`cancel()` SHALL end the session as `cancelled` and notify. `dispose()` SHALL end it as `cancelled` without notifying. The same SHALL hold in every non-terminal phase:

- deferred start
- pending import
- prepared, before `attach`
- renderer initialization
- active playback

A dynamic import cannot be aborted. When it settles after a terminal state, the session SHALL ignore it: no `prepare`, no renderer and no state update.

The following triggers SHALL all reach the same teardown:

- the adapter's existing interrupt events
- a hidden document
- a target change or a removed target reported by the adapter's observers
- an environment change (`anchors`, `isMobile` or `reduced` differing from the initial values)
- unmount

#### Scenario: Typing during a pending import
- **WHEN** the user types while the player import is pending and the import later resolves
- **THEN** no target is measured, `loadAnimation` is never called, and no timer remains

#### Scenario: Interrupt during renderer initialization
- **WHEN** a `pointerdown` arrives after `loadAnimation` and before `DOMLoaded`
- **THEN** the renderer is destroyed once, the readiness deadline is cleared, and a later `DOMLoaded` starts nothing

### Requirement: StrictMode, replay and loader recovery

Under React StrictMode, the setup → cleanup → setup sequence SHALL import the player once, call `prepare` once and create one renderer.

`attach` on a session that is not in `prepared` SHALL be a no-op.

Each activation (a new provider `token`) SHALL create a new session and a new preparation. Cancelling or failing one session SHALL NOT affect the loader or a later session. After an import rejection, a later activation SHALL call the loader again.

#### Scenario: StrictMode rehearsal
- **WHEN** GiftWrapping renders inside `<StrictMode>`
- **THEN** the loader, `getGiftWrappingTarget` and `loadAnimation` are each called once, and the story plays

#### Scenario: Recovery after a rejected import
- **WHEN** the first session's import rejects (static fallback) and a second activation follows with a loader that resolves
- **THEN** the second session calls the loader again and plays

### Requirement: Exactly-once teardown tolerant of failures

Teardown SHALL run once per session, in this order:

1. hide the host
2. clear every session timer
3. run the adapter disposers in reverse registration order
4. remove the Lottie listeners
5. call `destroy()`
6. notify, unless the session was disposed

Each step SHALL run in isolation, so a throwing disposer or a throwing `destroy()` does not skip a later step. When `destroy()` throws, the session SHALL remove the renderer nodes with `host.replaceChildren()`.

#### Scenario: destroy throws
- **WHEN** the renderer reports `error` and its `destroy()` throws
- **THEN** observers are disconnected once, no Lottie listener or timer remains, the host has no renderer children, and the static fallback appears

#### Scenario: Repeated cleanup
- **WHEN** `cancel()`, `dispose()` and React unmount all run after the session has completed
- **THEN** `destroy()` was called exactly once and the terminal callback ran exactly once

### Requirement: Composition ownership and replay isolation

The scene adapter SHALL declare `LottieDataOwnership`:

- `transferred`: the data was built for this session. The session SHALL hand it to the player at most once.
- `shared`: the data is an immutable source the caller may keep. The session SHALL pass a JSON deep clone of it to every `loadAnimation`.

GiftWrapping SHALL use `transferred`. It SHALL keep building a fresh composition for each preparation, as today.

The session SHALL NOT clone DOM targets or the preparation object, and SHALL NOT share an `AnimationItem` or playback state across sessions. S1 SHALL add no cache.

#### Scenario: A mutating player cannot affect a shared source
- **WHEN** a fixture player mutates `animationData` in place (as `lottie_light`'s `completeData` does) and two sessions play the same `shared` source
- **THEN** the source and the second session's input stay structurally equal to the original

#### Scenario: Transferred data is never replayed
- **WHEN** a GiftWrapping scene plays and a second activation follows
- **THEN** the second renderer receives a newly built composition object, not the first one

### Requirement: GiftWrapping behavior is preserved

The following SHALL remain as they are at `1cfb11468`:

- **Story and timing:** the story and the 16000 ms authored timeline.
- **Targets:** composer-or-parcel selection (`data-gift-target`) and the measurement rules.
- **Observers:** the `MutationObserver` attribute filter, the filtering of mutations inside the renderer host, the `ResizeObserver` on up to 24 ancestors, and the 0.5 px movement tolerance.
- **Interrupts:** the list of 11 window-capture events plus `visualViewport` resize and scroll. The listeners SHALL stay installed while the static fallback shows.
- **Static art:** the `data-gift-static` art for reduced motion, for missing `ResizeObserver` or `MutationObserver`, and for load or player failure.
- **Host element:** the `inert`, `aria-hidden` and pointer-transparent host element.
- **Draft:** draft, focus and selection preservation.

The existing assertions in `NewYearGiftWrapping.spec.tsx` (41 tests at `1cfb11468`) and `gift-wrapping.spec.ts` (31 tests at `1cfb11468`) SHALL pass; the files have since grown to 44 and 32 tests with the session and timing-budget cases. The only permitted edit is the mock's module path and the loader's name.

#### Scenario: Renderer-generated SVG mutations are ignored
- **WHEN** the renderer mutates its own SVG during playback
- **THEN** no layout is read and playback continues, while a later movement of the composer by more than 0.5 px stops it

#### Scenario: Browser comparison with the baseline
- **WHEN** the GiftWrapping browser matrix runs under a new capture identity
- **THEN** element counts at 50 %, `data-gift-target`, the presence of a player request, renderer inserts after a cancelled load, and cleanup at end + 500 ms match the `1cfb11468` cells published on #9219, and timing figures are reported without pass/fail claims

### Requirement: PenguinStar compatibility

PenguinStar SHALL adopt only the shared loader, the `LottiePlayer` type and the profile options helper.

Its lifecycle in `penguin-star-animation.ts` SHALL stay unchanged:

- the readiness rule, which ignores `DOMLoaded` while `!isLoaded` and has the already-loaded shortcut
- 20000 ms playback from readiness
- the 22500 ms provider lifetime
- frame-driven borrowing of the live control
- exactly-once restoration inside its own `finish`

Migrating its lifecycle to the session SHALL be decided in S7 (#9226).

#### Scenario: Borrowed control is restored once
- **WHEN** PenguinStar has borrowed the model selector and playback ends by completion, input, scroll or unmount
- **THEN** the borrowed animation is cancelled once and the control's style and transform equal their originals

### Requirement: The generic session stays host- and scene-agnostic

`utils/lottie-player.ts`, `utils/lottie-scene-session.ts` and `hooks/useLottieSceneSession.ts` SHALL NOT contain any of the following:

- scene geometry, anchor names or layout reads
- window or `visualViewport` interrupt policy
- host routes, `/api` paths or API clients
- storage
- environment variables
- i18n
- logging or telemetry

They SHALL add no feature flag, cache, user-visible string or UI. Accessibility and RTL behavior SHALL be unchanged: scenes keep their `aria-hidden` and `inert` hosts, and GiftWrapping keeps reading direction from the composer.

The hook's `cancel` SHALL be referentially stable, and `prepare` SHALL be read through a ref, so host re-renders do not restart a scene.

#### Scenario: Architecture guard
- **WHEN** the guard runs `grep -nE "window\.|visualViewport|getBoundingClientRect|Observer\b|anchors|composer|/api|chat-api-client|server-api|Storage|indexedDB|process\.env|i18n|fetch\(" libs/celebrations/src/utils/lottie-player.ts libs/celebrations/src/utils/lottie-scene-session.ts libs/celebrations/src/hooks/useLottieSceneSession.ts`
- **THEN** it prints nothing
