## MODIFIED Requirements

### Requirement: Canvas sizing

The waveform `<canvas>` element SHALL be:
- `h-8` (32 px) on mobile breakpoints.
- `h-6` (24 px) on desktop breakpoints, to fit alongside the voice bar's controls on one row.

A `ResizeObserver` SHALL be attached to the canvas so that the histogram redraws at the correct pixel width whenever the flex layout changes (e.g. on breakpoint change). Resizing SHALL NOT reset the ring buffer; it only redraws the existing buffer content at the new width.

#### Scenario: Canvas height follows the breakpoint

- **WHEN** the voice bar is rendered at a mobile viewport and then at a desktop viewport
- **THEN** the canvas is `h-8` on mobile and `h-6` on desktop

#### Scenario: A resize redraws without losing history

- **WHEN** the flex layout changes width while recording
- **THEN** the `ResizeObserver` triggers a redraw at the new pixel width
- **AND** the already-captured waveform history remains in the ring buffer
