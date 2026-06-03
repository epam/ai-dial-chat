## ADDED Requirements

### Requirement: Code block header remains visible while scrolling
The code block header (language label + Copy and Download buttons) SHALL remain visible at the top of the code block when the user scrolls vertically through a long code snippet. The header MUST use `position: sticky` and stay within the bounds of the code block container.

#### Scenario: Header stays at top during vertical scroll
- **WHEN** a code block is tall enough to require vertical scrolling
- **THEN** the header (language label and action buttons) SHALL remain pinned to the top of the code block's visible area as the user scrolls down

#### Scenario: Header does not overlap adjacent content outside the code block
- **WHEN** the user scrolls past the bottom of a code block
- **THEN** the sticky header SHALL no longer be visible (it leaves the sticky region when the code block scrolls out of view)

#### Scenario: Multiple code blocks on the same page each have their own sticky header
- **WHEN** a chat message contains more than one code block
- **THEN** each code block SHALL have its own independently sticky header, constrained to its own container

### Requirement: Copy and Download controls remain accessible during scroll
The Copy and Download icon buttons in the code block header SHALL be accessible (visible and clickable) at all times while the user is scrolling through a long code snippet, without requiring the user to scroll back to the top.

#### Scenario: Copy button is reachable mid-scroll
- **WHEN** the user has scrolled partway through a long code block
- **THEN** the Copy button SHALL be visible and clickable in the sticky header

#### Scenario: Controls are not rendered during streaming
- **WHEN** the last message is still streaming
- **THEN** the Copy and Download buttons SHALL NOT appear (existing behavior, unchanged)
