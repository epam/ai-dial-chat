## 1. Navigation component

- [x] 1.1 In `apps/chat/src/components/Navigation/Navigation.tsx`, add `Link` to the `react-router-dom` import (alongside `useLocation`, `useNavigate`)
- [x] 1.2 Wrap each `DialGhostIconButton` in a `<Link to={path} className="contents">` element
- [x] 1.3 Remove `onClick={() => navigate(path)}` from each `DialGhostIconButton` (navigation is now handled by the `<Link>`)
- [x] 1.4 Add `tabIndex={-1}` to each `DialGhostIconButton` so only the `<a>` is in the tab order
- [x] 1.5 Remove the `useNavigate` import and the `navigate` variable if no longer used elsewhere in the file

## 2. Tests

- [x] 2.1 In `apps/chat/src/components/Navigation/tests/Navigation.spec.tsx`, add tests that verify each nav item renders as an `<a>` element with the correct `href` matching `NAVIGATION_CONFIG` paths
- [x] 2.2 Update any existing tests that relied on `onClick` / `useNavigate` mock for navigation — switch to checking rendered `href` attributes or simulating link clicks via `<a>` elements

## 3. Verification

- [x] 3.1 Run `npm exec nx test chat -- --testPathPattern=Navigation` — all tests pass
- [x] 3.2 Run `npm exec nx lint chat` — no lint errors
- [x] 3.3 Run `npm exec nx typecheck chat` — no type errors
- [ ] 3.4 Manual smoke: start the dev server, verify middle-click on a sidebar nav item opens the route in a new tab
