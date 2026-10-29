## ADDED Requirements

### Requirement: Playback-start notification for synchronized companions

`LottieScenePlayback` (`libs/celebrations/src/models/lottie-scene.ts`) SHALL accept an optional adapter callback, `onPlaybackStarted`. It receives the `LottieAnimationContext` fields plus `timelineZeroMs`: the `document.timeline` time, in milliseconds, that corresponds to Lottie frame 0 of the current playback.

**When it is called.** The session (`libs/celebrations/src/utils/lottie-scene-session.ts`) SHALL invoke it exactly once, on the first `enterFrame` event after `play()` succeeds in the `playing` state. It SHALL compute `timelineZeroMs = document.timeline.currentTime − currentFrame / fr × 1000`. It SHALL then remove its one-shot `enterFrame` listener.

**When it is not called.**

- It SHALL NOT be called before readiness or after any terminal state.
- It SHALL NOT be called again on replay of the same session.

**Failure.** If the callback throws, the session SHALL end as `failed` and run its exactly-once teardown, including registered disposers.

**Boundary.**

- When an adapter omits the callback, behaviour SHALL be identical to before. GiftWrapping SHALL NOT change.
- The callback SHALL add no layout read, host knowledge, window listener, i18n, storage or telemetry to the generic session.
- The architecture-guard grep over `utils/lottie-player.ts`, `utils/lottie-scene-session.ts` and `hooks/useLottieSceneSession.ts` SHALL still print nothing.

#### Scenario: Companion starts on the Lottie clock

- **WHEN** an adapter declares `onPlaybackStarted` and the renderer reaches readiness and renders its first frame
- **THEN** the callback runs once with `timelineZeroMs` equal to the document-timeline time minus the rendered frame's time, and no further `enterFrame` handling remains in the session

#### Scenario: Callback throws

- **WHEN** `onPlaybackStarted` throws
- **THEN** the session ends as `failed`, every registered disposer runs once, and the scene shows its static fallback

#### Scenario: Cancelled before the first frame

- **WHEN** the session is cancelled after `play()` but before the first `enterFrame`
- **THEN** `onPlaybackStarted` is never called and no listener remains

#### Scenario: Adapter without the callback

- **WHEN** GiftWrapping plays through the session
- **THEN** its readiness, playback deadline, teardown and tests are unchanged and no `enterFrame` listener is added
