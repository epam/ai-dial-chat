## ADDED Requirements

### Requirement: EditorLayout — resizable left column
`EditorLayout` SHALL accept an optional host-controlled prop `resizableLeftColumn?: { width: number; onWidthChange: (width: number) => void; defaultWidth?: number; minWidth?: number; maxWidth?: number }` plus `labels.resizeHandleLabel` and `labels.resizeHandleTooltip`, which make the left column resizable on desktop. `EntityEditor` SHALL forward them. When `resizableLeftColumn` is omitted, or `centerContent` is absent, the layout SHALL be exactly the existing fixed 400 px layout and no handle SHALL render.

When enabled, at and above the `desktop` breakpoint the library SHALL render a handle between the left and center columns, and below it the handle SHALL NOT be rendered (the columns stack). The left column width SHALL be `width` clamped to `[minWidth, maxWidth]` (defaults 280 and 640 px) and additionally to the container width minus a 360 px minimum for the center column. The center column SHALL fill the remainder and SHALL NOT cause horizontal scroll. The library SHALL hold only transient pointer-drag state; it SHALL NOT read or write storage, import i18n, or know where the width comes from. During a drag it SHALL call `onWidthChange` with the clamped width on each move.

The handle SHALL:
- have `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, an `aria-label` from `labels.resizeHandleLabel`, and `tabIndex={0}`;
- have an 8 px wide hit area with a thin visible line, drawn with logical properties only;
- be keyboard operable: the arrow keys change the width by 16 px (the key pointing toward the inline end widens the column, mirrored under `dir="rtl"`), and Home and End jump to min and max;
- reset to `defaultWidth` (default 400) on double-click;
- use pointer capture so a drag continues outside the handle, and suppress text selection while dragging;
- show, once the pointer has rested on it for more than 1 s, an accent-colored line, a `col-resize` cursor and a `labels.resizeHandleTooltip` tooltip; show the active accent color while pressed and keep the accent line while dragging.

Drag direction SHALL follow the inline axis: dragging toward the inline end widens the left column in both LTR and RTL.

#### Scenario: Dragging resizes live
- **WHEN** the user presses the handle at desktop width and moves the pointer 100 px toward the inline end
- **THEN** `onWidthChange` is called with a width 100 px larger, clamped to the limits, and the center column shrinks without horizontal scroll

#### Scenario: Width is clamped
- **WHEN** the pointer is dragged beyond `minWidth` or `maxWidth`
- **THEN** the left column stops at the limit and `aria-valuenow` equals that limit

#### Scenario: Keyboard resize
- **WHEN** the handle is focused and the user presses the arrow key pointing toward the inline end
- **THEN** the width grows by 16 px; under `dir="rtl"` the opposite physical key does so

#### Scenario: Double-click resets
- **WHEN** the user double-clicks the handle
- **THEN** `onWidthChange` is called with `defaultWidth`

#### Scenario: No handle below desktop
- **WHEN** the viewport is below the `desktop` breakpoint
- **THEN** no separator is rendered and the columns stack as before

#### Scenario: Opt-out keeps the existing layout
- **WHEN** `resizableLeftColumn` is not passed
- **THEN** the left column is a fixed 400 px and no separator is rendered
