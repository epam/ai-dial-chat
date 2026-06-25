## Why

Navigation sidebar buttons use `onClick={() => navigate(path)}` which are not real anchor elements, so middle-click (open in new tab) and right-click → "Open in new tab" do not work. Wrapping them in React Router `<Link>` elements restores standard browser link behaviour without breaking the existing client-side routing or active-state highlighting.

## What Changes

- Each `DialGhostIconButton` in the desktop `<Navigation>` sidebar is wrapped in a React Router `<Link to={path}>` so the DOM contains a real `<a href="...">` element.
- The `onClick={() => navigate(path)}` handler is removed from the button; navigation on left-click is now handled natively by the `<Link>`.
- The `<Link>` is styled to remove anchor decoration and not interfere with the button's existing layout.
- The `navigation-routing` spec requirement "Navigation buttons perform client-side navigation" is updated to describe the link-wrapping approach.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `navigation-routing`: Navigation buttons are now rendered inside `<Link>` anchor elements, enabling middle-click / right-click → open-in-new-tab; the requirement "Navigation buttons perform client-side navigation" updates accordingly.

## Impact

- **Files changed**: `apps/chat/src/components/Navigation/Navigation.tsx` (primary), `apps/chat/src/components/Navigation/tests/Navigation.spec.tsx` (test update), `openspec/specs/navigation-routing/spec.md` (spec delta).
- **No API changes.**
- **No new dependencies** — `Link` is already available from `react-router-dom`.
- **Accessibility**: `<Link>` renders an `<a>` which is the correct semantic element for navigation; existing `aria-label` and `aria-current` attributes remain unchanged.
