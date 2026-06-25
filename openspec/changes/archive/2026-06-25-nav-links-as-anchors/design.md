## Context

The desktop `<Navigation>` sidebar renders each route entry as a `DialGhostIconButton` with `onClick={() => navigate(path)}`. Because the button renders as a `<button>` element (not an `<a>`), the browser cannot expose the URL to the user, and middle-click / right-click → "Open in new tab" does not work. The fix is a single-file change to `Navigation.tsx` that wraps each button in a React Router `<Link>`.

## Goals / Non-Goals

**Goals:**
- Middle-click and right-click → "Open in new tab" work on every navigation sidebar item.
- Left-click continues to perform client-side SPA navigation (no full page reload).
- Active-state highlighting (`aria-current="page"`, accent colour class) is unaffected.
- Tooltip and `aria-label` behaviour is unaffected.

**Non-Goals:**
- Mobile bottom-sheet navigation (`NavPageContent`) — it is a modal overlay, not a persistent sidebar; opening items in new tabs is not meaningful there.
- Any change to routing configuration or `NAVIGATION_CONFIG`.

## Decisions

### Wrap `DialGhostIconButton` in `<Link>` rather than replacing it

React Router's `<Link to={path}>` renders a native `<a href="...">`. Wrapping the existing `DialGhostIconButton` inside it is the minimal-change approach:

- The `<a>` carries the `href`, so the browser exposes the URL (shown in the status bar, middle-click, right-click menu).
- Left-click on the `<a>` triggers React Router's client-side navigation; the `onClick` on the button is removed.
- The `DialGhostIconButton` keeps all its existing props (`icon`, `aria-label`, `aria-current`, `tooltipProps`, `className`).

**Alternatives considered:**

| Alternative | Why rejected |
|---|---|
| Pass `href` directly to `DialGhostIconButton` | The ui-kit component does not expose an `href` prop — it always renders a `<button>`. |
| Replace `DialGhostIconButton` with a custom `<a>` styled to look identical | More styling work; loses ui-kit hover/focus/press states and tooltip integration. |
| Use `NavLink` instead of `Link` | `NavLink` provides `isActive` via className, but the component already computes active state manually from `useLocation` to set `aria-current`. Switching to `NavLink` would either duplicate the active logic or require refactoring it — out of scope. |

### Styling the `<Link>` wrapper

The `<Link>` must not add visual decoration or disrupt the button's layout:

```
className="contents"
```

`contents` makes the element "disappear" from the box model — its children are laid out as if the `<Link>` element were not there. This avoids introducing a new flex/block container that could affect the gap spacing in the sidebar `<div>`.

## Risks / Trade-offs

- **Focus order**: `<a>` wrapping a `<button>` creates two focusable elements. Mitigation: add `tabIndex={-1}` to the `DialGhostIconButton` so only the `<a>` is in the tab order. The button will still respond to pointer events and the `<a>` receives keyboard focus.
- **Double-click race**: Middle-click on the `<a>` opens a new tab; left-click on the `<a>` navigates in the current tab. Both paths are correct — no conflict.
- **`display: contents` browser support**: Supported in all modern browsers; not a concern for this project's baseline.
