## MODIFIED Requirements

### Requirement: One pinned player profile

**[Contract]** Renderer capability `lottie-light-svg-v1` SHALL mean exactly these settings:

- player package `lottie-web` at **5.13.0**
  - `libs/celebrations/package.json` declares it as the exact version `"5.13.0"` (S1, #9220), no longer `^5.13.0`
  - `package-lock.json` resolves it to 5.13.0
- player entry `lottie-web/build/player/lottie_light`
- renderer `svg`
- `loadAnimation` options `{ renderer: 'svg', loop: false, autoplay: false, animationData, rendererSettings: { progressiveLoad: false, preserveAspectRatio: 'xMidYMid meet', focusable: false } }`
- `setSubframe(true)`

These settings are defined once, in `libs/celebrations/src/utils/lottie-player.ts`:

- `loadLottiePlayer`, the only dynamic import of the player entry
- `createLottieLightSvgAnimation`, which applies the options and then `setSubframe(true)`
- `LOTTIE_LIGHT_SVG_V1_PLAYER_VERSION`

GiftWrapping and PenguinStar both use this module. The settings are the ones GiftWrapping used at `1cfb11468` (`new-year/utils/gift-wrapping-player.ts:9-13`, `new-year/utils/gift-wrapping-animation.ts:74-86`).

In the installed 5.13.0 build, `lottie_light` registers only the `svg` renderer and registers no effects. It installs an expressions plugin only through an explicit `installPlugin('expressions', …)` call, and no code makes that call.

**Enforcement.** A unit test in `libs/celebrations/src/utils/tests/lottie-player.spec.ts` SHALL fail when either of these differs from `LOTTIE_LIGHT_SVG_V1_PLAYER_VERSION`:

- the installed `lottie-web/package.json` version
- the library manifest's declared `lottie-web` spec

A new player version, a different build, or another renderer SHALL get a new capability ID. It SHALL NOT silently redefine `lottie-light-svg-v1`. The player SHALL stay in a lazily imported chunk.

#### Scenario: The resolved player version drifts
- **WHEN** an install resolves `lottie-web` to a version other than 5.13.0, or the manifest declares anything other than `"5.13.0"`
- **THEN** the profile test fails, and assets are not certified for `lottie-light-svg-v1` until they are re-verified and the capability ID decision is recorded

#### Scenario: Existing lazy player
- **WHEN** a New Year event is loaded but no Lottie scene has been activated
- **THEN** **[Invariant]** the `lottie_light` chunk has not been requested, because `loadLottiePlayer` imports it dynamically only after a scene's session starts

### Requirement: Timing and deadlines

**[Contract]** Each scene SHALL declare these four times, all finite integers in milliseconds:

- `playbackDurationMs`: the authored story length. It SHALL equal `(op - ip) / fr × 1000` of every variant to within one frame.
- `loadTimeoutMs`: the time allowed for the player chunk plus animation data. It SHALL be ≤ 2000.
- `readyTimeoutMs`: the time from `loadAnimation` to the `DOMLoaded` renderer readiness event. It SHALL be ≤ 250.
- `maxLifetimeMs`: the total time from mount, which becomes `CelebrationScene.durationMs`. It SHALL be at least `loadTimeoutMs + readyTimeoutMs + playbackDurationMs` and at most 32000.

The playback clock SHALL start only at renderer readiness. The outer lifetime SHALL bound everything: load, readiness, playback, exit and cleanup. Independent waits SHALL NOT stack beyond it.

**[Invariant]** GiftWrapping already follows this budget. Since S1 (#9220), the shared session in `libs/celebrations/src/utils/lottie-scene-session.ts` runs the waits from `GIFT_WRAPPING_TIMINGS` in `new-year/utils/gift-wrapping-animation.ts`:

- 2000 ms load deadline, armed immediately before the player import
- 250 ms readiness deadline, from the moment `loadAnimation` returns
- 16000 ms playback, started at readiness (`GIFT_WRAPPING_MS`)
- 18500 ms provider lifetime (`new-year/constants/new-year.ts:20`)

A unit test asserts that 2000 + 250 + 16000 ≤ 18500.

#### Scenario: Slow network
- **WHEN** the animation data has not resolved after `loadTimeoutMs`
- **THEN** the scene shows its poster (or, for a known event before any side effect, follows the source-selection fallback), and the scene still ends at `maxLifetimeMs`

#### Scenario: Declared duration disagrees with the composition
- **WHEN** `playbackDurationMs` differs from `(op - ip) / fr × 1000` by more than one frame
- **THEN** publication rejects the scene
