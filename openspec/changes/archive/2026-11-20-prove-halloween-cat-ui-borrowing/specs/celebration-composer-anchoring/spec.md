# Spec Delta

## ADDED Requirements

### Requirement: The external GiftWrapping path has committed browser coverage

A committed browser suite SHALL drive the published GiftWrapping assets through the anchored `LottieScene`, using the baseline harness `libs/celebrations/browser-tests/celebrations-baseline.browser.spec.mjs`. The assets are the `new-year-default@1.1.1` variants, pinned by their `sha256`. The suite SHALL cover delayed and broken loads, cancellation during loading and during playback, cached replay, contact at 360/390/1280/1920 px in LTR and RTL, and the `stage-anchor` fallback.

#### Scenario: Slow and broken loads
- **WHEN** the loader resolves after `loadTimeoutMs`, or rejects at once
- **THEN** the poster shows for `posterDurationMs`, and no renderer is inserted

#### Scenario: Cancellation during playback
- **WHEN** a key press arrives 6 s into the external GiftWrapping playback
- **THEN** the renderer, observers and listeners are released once, and the composer's draft, focus and rectangle are unchanged

#### Scenario: Cached replay
- **WHEN** the scene plays twice from the same loaders on composers of different widths
- **THEN** the data is requested once, each replay's contour matches its composer, and the cached object stays equal to the pinned asset

#### Scenario: Contact and fallback frames
- **WHEN** the suite captures the wrap, the pull and the departure at each width in LTR and RTL, and once without a composer
- **THEN** the feet stay on the measured top edge, the ribbon traces the composer or the synthetic parcel, and the frames are saved with the change's evidence

### Requirement: Anchored preparation time is measured under CPU throttling

Apply SHALL measure the preparation of the external GiftWrapping and of the external Cat in Chromium under 4× CPU throttling, over at least 20 runs on real host geometry. For GiftWrapping, that is the measurement, the private copy, the mapping and the slot fitting. For the Cat, it also covers target discovery, retargeting, the time remap, the copy tracks and snapshot cloning. It SHALL report p50 and p95 against the 50 ms target. Native frame-time measurements SHALL NOT replace it.

#### Scenario: Recorded measurement
- **WHEN** the preparation benchmark runs at 1280 and 390 px under 4× throttling
- **THEN** the p50 and p95 preparation times of both scenes are recorded with the revision, and any p95 above 50 ms is reported as a finding, never silently accepted
