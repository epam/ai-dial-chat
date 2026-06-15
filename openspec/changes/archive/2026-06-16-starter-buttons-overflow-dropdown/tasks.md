## 1. Discover UI Kit Overflow/Dropdown Component

- [x] 1.1 Run `searchEntity("component", "dropdown")` via MCP to find the correct Dial dropdown/menu component name and verify its prop API
- [x] 1.2 Run `getEntityDetails("component", "DialDropdown")` to confirm `items`, `placement`, `children` trigger, and keyboard props

## 2. Implement Static Overflow Logic

- [x] 2.1 Add `MAX_VISIBLE = 4` constant and derive `visibleStarters` / `overflowStarters` slices from the `starters` prop inside `StarterButtons`
- [x] 2.2 Render the overflow button (using `DialRoundedButton` + `IconDotsVertical`) only when `overflowStarters.length > 0`
- [x] 2.3 Wire `DialDropdown` around the overflow trigger; render one `DropdownItem` per `overflowStarter` with `onClick` → `onSelect(starter)`
- [x] 2.4 Set `placement="bottom-end"` and `matchReferenceWidth={false}` on `DialDropdown`

## 3. Implement Responsive Narrowing via ResizeObserver

- [x] 3.1 Wrap pills in an outer `<div ref={containerRef} className="w-full">` so measurement reflects available width, not content width (parent is `flex-col items-center`)
- [x] 3.2 Attach `ResizeObserver` to the outer `containerRef` div; clean up on unmount
- [x] 3.3 Cache pill `getBoundingClientRect().width` values in `pillWidthCacheRef` whenever all visible pills are mounted; use cache in resize calculations so unmounted pills still have accurate widths
- [x] 3.4 Store `visibleCount` in `useState`, initialised to `Math.min(starters.length, MAX_VISIBLE)`; reset cache and count when `starters.length` changes
- [x] 3.5 `computeVisibleCount(totalStarters)` has `[]` deps and receives starters length as argument; called by ResizeObserver callback and by a render-level `useEffect` (no deps) for post-commit accuracy

## 4. RTL and Accessibility

- [x] 4.1 Overflow button is last in DOM order within `justify-center` flex row — RTL inherits naturally via flex ordering
- [x] 4.2 `placement="bottom-end"` on `DialDropdown` resolves to inline-end of anchor (LTR: right, RTL: left) automatically via Floating UI
- [x] 4.3 Added `StarterButtonsOverflow` to `ChatI18nKeys` and `"starterButtonsOverflow"` to `en.json`; passed as `aria-label` on the overflow `DialRoundedButton`

## 5. Verification

- [ ] 5.1 Test manually with 3, 4, 5, and 10 starters; confirm correct pill count and dropdown contents each time
- [ ] 5.2 Resize the browser window to a narrow viewport; confirm pills move into the dropdown and return when widened
- [ ] 5.3 Toggle `dir="rtl"` on `<html>`; confirm `⋯` button position and dropdown alignment are mirrored correctly
- [ ] 5.4 Run keyboard-only navigation: `Tab` to overflow button, `Enter` to open, `ArrowDown`/`ArrowUp` to navigate, `Enter` to select, `Escape` to dismiss
- [x] 5.5 Run `npm exec nx lint chat` and `npm exec nx tsc chat` and fix any issues
