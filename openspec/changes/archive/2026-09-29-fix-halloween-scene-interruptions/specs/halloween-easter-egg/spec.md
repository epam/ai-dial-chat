## ADDED Requirements

### Requirement: Mobile Mummy prepares after the activation viewport settles

On mobile, Mummy SHALL wait for 120 ms of viewport stability, bounded to 600 ms, before measuring or copying the composer. Window resize and visual viewport resize/scroll SHALL restart only this preparation delay. Input, focus, pointer interaction, document scrolling, hidden tabs and disposal SHALL cancel pending preparation. Playback SHALL retain its existing twelve-second story, immediate interruption and thirteen-second provider deadline. Desktop and reduced-motion behavior SHALL remain unchanged.

The Mummy component effect SHALL own preparation and disposal using the existing host-supplied mobile setting and anchors. No new context, public API, feature gate, strings, cache, telemetry or dependency SHALL be introduced; the existing inert, pointer-transparent artwork and physical RTL contact geometry SHALL remain.

#### Scenario: The mobile viewport changes immediately after submission

- **WHEN** the viewport changes during mobile Mummy preparation after secret-phrase activation
- **THEN** Mummy starts once using the settled composer bounds, with no prematurely hidden actor or borrowed composer

#### Scenario: The user resumes interaction before entrance

- **WHEN** typing, focus, pointer interaction or document scrolling occurs during preparation
- **THEN** no deferred scene starts and all preparation timers/listeners are released

### Requirement: Bowling rolls without visible history

Bowling SHALL play its existing pumpkin travel and spin tracks when no eligible history rows are visible, including a closed mobile sidebar. This fallback SHALL borrow no UI, create no snapshots, use at most two animations and one deadline, finish within eight seconds and release resources on interruption or disposal. Reduced motion SHALL retain static artwork. Visible-history collisions, artwork and story timing SHALL remain unchanged.

The Bowling component effect SHALL own the fallback lifetime. Its decorative physical trajectory SHALL NOT mirror any host text or introduce focusable content, new anchors or external integration contracts.

#### Scenario: History is closed on mobile

- **WHEN** Bowling starts without visible eligible rows and motion is enabled
- **THEN** one pumpkin rolls across the viewport instead of remaining static, without changing live UI

#### Scenario: The standalone roll is interrupted

- **WHEN** input, focus, pointer interaction, scrolling, viewport change, hidden-tab transition or unmount interrupts the roll
- **THEN** its animations, deadline and listeners are released immediately

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
