## Context

`StarterButtons` renders all starter options as pill buttons in a flex-wrap row with no overflow control. When a deployment defines many starters, or the viewport is narrow, buttons spill into multiple rows and push the chat input down. The fix must work at both the count threshold (> 4) and at any viewport width where buttons no longer fit in one row.

The component lives at `apps/chat/src/components/StarterButtons/StarterButtons.tsx`. It receives a typed `StarterOption[]` array and an `onSelect` callback; it owns no external state.

The parent layout (`ConversationRoute`) wraps `StarterButtons` in a `flex flex-col items-center` container, which causes any child without an explicit width to shrink to its content width. This is a critical constraint for any measurement-based approach.

## Goals / Non-Goals

**Goals:**
- Cap the visible pill count at 4 by default; overflow starters go into a `⋯` dropdown.
- Dynamically reduce visible count when the container is too narrow for the current visible pills plus the overflow button on one row.
- Dropdown opens a list of `StarterOption` titles; clicking one fires `onSelect` and closes the menu.
- Full RTL support via CSS logical properties; dropdown anchors to `inline-end`.
- Keyboard accessible: `Escape` closes the menu; arrow keys navigate items.

**Non-Goals:**
- Changing the `StarterOption` data model or how starters are fetched.
- Pagination or search within the overflow list.
- Animating the dropdown open/close beyond what the UI kit provides.

## Decisions

### D1 — Static threshold of 4, with dynamic narrowing via `ResizeObserver`

**Decision**: Use a constant `MAX_VISIBLE = 4` as the upper cap. Attach a `ResizeObserver` to the outer container to detect width changes and recompute how many pills fit.

**Rationale**: A fixed threshold (4) matches the design. `ResizeObserver` is the standard browser API for element-level size changes; it avoids layout thrashing from `window.resize` listeners.

### D2 — Outer `w-full` wrapper for stable width measurement

**Decision**: The component's root element is a plain `<div ref={containerRef} className="mt-4 w-full">` that wraps the flex-pill row. The `ResizeObserver` is attached to this outer div, not the flex-wrap row.

**Rationale**: The parent layout uses `flex-col items-center`, which makes elements without an explicit width shrink to their content width. Measuring a shrink-to-fit flex container gives a circular result (its width equals the current pills' width, not the available space). The `w-full` wrapper fills the parent's available width independently of how many pills are rendered, giving a stable measurement baseline.

**Alternative considered**: Measuring `containerRef.current.parentElement`. Rejected — couples the component to parent DOM structure.

### D3 — Pill width cache for accurate resize recomputation

**Decision**: After every render where all currently-visible pills are mounted, their `getBoundingClientRect().width` values are written to `pillWidthCacheRef`. The fit-calculation always reads from this cache, falling back to `120px` per pill if a width isn't yet cached.

**Rationale**: When `visibleCount` drops below `MAX_VISIBLE` (e.g., to 2 on a narrow viewport), pills 3 and 4 are unmounted — their refs become `null`. On a subsequent resize that widens the container, the calculation needs to know whether pills 3 and 4 would fit. The cache provides those measurements from the last time all pills were rendered (the initial full render). Without the cache, the fallback constant (120px) would be used for all pills after the first reduction, leading to an inaccurate re-expansion.

**Alternative considered**: Always render all `MAX_VISIBLE` pills in the DOM with `visibility: hidden` on overflow items. Rejected — keeps hidden interactive elements in the accessibility tree.

### D4 — Overflow button using `DialDropdown` + `DialRoundedButton` trigger

**Decision**: Use `DialDropdown` (from `@epam/ai-dial-ui-kit`) with `items: DropdownItem[]` and `placement="bottom-end"`. The trigger is a `DialRoundedButton` with `iconAfter={<IconDotsVertical />}`.

**Rationale**: Consistent visually with the existing pill buttons; the UI kit handles focus trapping, keyboard navigation, and positioning out of the box.

### D5 — `computeVisibleCount` receives `totalStarters` as a parameter

**Decision**: `computeVisibleCount` is a `useCallback` with `[]` deps. It receives `totalStarters: number` as an argument rather than closing over `starters.length`.

**Rationale**: Avoids recreating the callback (and re-registering the `ResizeObserver`) whenever `starters.length` changes. The `ResizeObserver` effect and the render-level effect both pass the current `starters.length` at call time.

## Risks / Trade-offs

- **`w-full` may affect parent layout** → The outer div now takes the full available width of the `items-center` flex column. Visually the pills are still `justify-center` within this full-width wrapper, so appearance is unchanged. If the parent's padding or max-width changes, measurements adjust automatically.
- **Pill width cache becomes stale after starters change** → Mitigated by clearing `pillWidthCacheRef` in the `useEffect` that watches `starters.length`. On each new starters set the component re-renders at full `MAX_VISIBLE` count, re-populating the cache.
- **ResizeObserver fires after paint** → The render-level `useEffect` (no deps) ensures `computeVisibleCount` also runs after every commit, catching any post-render measurement changes.
- **RTL dropdown placement** → `placement="bottom-end"` is direction-aware in Floating UI (which the UI kit uses internally): `end` resolves to the inline-end of the anchor, so the dropdown aligns to the right in LTR and to the left in RTL automatically.
