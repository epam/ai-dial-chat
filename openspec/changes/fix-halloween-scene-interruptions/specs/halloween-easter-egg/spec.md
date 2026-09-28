## ADDED Requirements

### Requirement: Portal input cancellation does not depend on a focus change

Portal SHALL stop borrowing and restore original history rows on keydown, beforeinput, input and compositionstart, including when the composer was focused before activation. Cancellation SHALL preserve live content, focus and selection and release listeners, animations, copies and deadlines.

#### Scenario: Typing resumes during capture

- **WHEN** Portal has captured history rows and typing or IME composition starts in an already-focused composer
- **THEN** original rows are immediately restored and copied rows and their animations are removed

### Requirement: Portal Train and Web cancel invalidated target geometry

Portal, Train and Web SHALL cancel their target-dependent effects when a selected source is removed, resized, changed or moved by relevant target/ancestor attributes or structural DOM changes, without depending on a window resize. Observation SHALL be event-driven, bounded to the existing selected targets and released on interruption, completion or unmount. Scene-owned DOM changes and unrelated changes that leave target geometry unchanged SHALL NOT cancel playback. Existing story beats, choreography, resource budgets, mobile variants, RTL behavior and reduced-motion fallbacks SHALL remain unchanged.

#### Scenario: An anchor moves inside a stable viewport

- **WHEN** a selected row, pumpkin or web anchor moves or resizes through a relevant host layout change without window.resize
- **THEN** the affected scene stops using its cached coordinates and restores any borrowed original

#### Scenario: An unrelated toast disappears

- **WHEN** a toast is removed without changing selected targets or their geometry
- **THEN** the current scene continues

#### Scenario: Playback releases observation

- **WHEN** the scene completes, is interrupted, replaced or unmounted
- **THEN** its target observers are disconnected and subsequent host changes cause no scene work
