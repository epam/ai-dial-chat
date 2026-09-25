## ADDED Requirements

### Requirement: The main pumpkin boards the Halloween train

The existing Train scene SHALL enter with an empty final wagon, stop, and show the main pumpkin jumping from its measured page position into that wagon. Its face SHALL match the main pumpkin. After landing, the passenger SHALL remain inside the same moving train carrier, behind the wagon front, throughout departure. The original labelled pumpkin button SHALL retain layout and focus; only its artwork is temporarily hidden and restored before the eleven-second animation ends. The existing twelve-second runtime deadline and scene pools SHALL remain unchanged. Scene-owned state SHALL drive boarding; core page components and libraries SHALL remain unchanged.

The train SHALL use layered translucent smoke from its chimney and side vents with different drift directions. Physical direction SHALL follow the main pumpkin's side while its face stays upright. The scene SHALL fit 360/900/1280/1920 widths, remain decorative, aria-hidden and pointer-transparent, preserve the secret hint in `halloween.trainToastMessage`, and use the existing UI_EVENT gate without API, persistence, telemetry or cache behavior.

#### Scenario: Boarding and departure
- **WHEN** a pumpkin click selects Train and the main pumpkin is visible
- **THEN** an empty wagon arrives and stops, the main pumpkin visibly jumps into it, and the train departs with its passenger and smoke
- **AND** the main pumpkin returns to its original place before scene completion

#### Scenario: Interruption and reduced motion
- **WHEN** the user interacts, scrolls, resizes, navigates away, replaces the scene, removes the source or enables reduced motion
- **THEN** the original pumpkin is immediately restored, boarding ends and any audio stops
- **AND** reduced motion uses static artwork with no borrowing or animated descendants

### Requirement: Train soundtrack playback is optional and bounded

The train SHALL support an optional supplied audio source. With no source, no media request SHALL occur. A supplied source SHALL play at most for the scene lifetime, stop/reset on interruption or unmount, and handle rejected playback silently. Reduced motion SHALL not start audio.

#### Scenario: No recording is available
- **WHEN** no soundtrack source is configured
- **THEN** the complete visual scene plays without creating an audio request

#### Scenario: Playback is unavailable or interrupted
- **WHEN** browser playback rejects or the scene ends
- **THEN** no unhandled error or background playback remains and the original pumpkin is restored
