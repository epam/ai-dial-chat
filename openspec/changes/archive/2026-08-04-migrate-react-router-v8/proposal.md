## Why

React Router v8 has been released and removes the `react-router-dom` package, folding its exports into `react-router` (with DOM-only APIs like `RouterProvider` moving to `react-router/dom`). `apps/chat` currently pins `react-router-dom@^7.15.1` and imports from it in 50+ files. Staying on the deprecated `react-router-dom` package blocks future security/feature updates and leaves the app on an unsupported major once v7 goes end-of-support. This is a routing-library upgrade only — no user-facing routing behavior changes.

## What Changes

- Replace the `react-router-dom` dependency with `react-router@^8.x` in `apps/chat` (declarative/SPA mode via `BrowserRouter`, no framework mode, no loaders/actions, no Cloudflare/Architect adapters — those v8 changes don't apply here).
- **BREAKING** (internal only): update every `import ... from 'react-router-dom'` to `import ... from 'react-router'` across `apps/chat/src/**` (components, pages, hooks, contexts, and their `*.spec.tsx` tests).
- Remove `react-router-dom` and its `@types/react-router-dom` (if present) from `package.json`; add `react-router` as the direct dependency.
- Verify the app's minimum runtime requirements (Node, React, Vite) already satisfy v8's raised baseline (Node 22.22+, React 19.2.7+, Vite 7+) and bump any that fall short.
- No change to route structure, `BrowserRouter`/`Routes`/`Route` usage patterns, navigation hooks (`useNavigate`, `useLocation`, `useParams`), or lazy-loading of routes — only the import source changes.

## Capabilities

### New Capabilities
(none — this is a dependency migration with no new user-facing capability)

### Modified Capabilities
- `navigation-routing`: the route-declaration requirement names "React Router v6" explicitly; reword to be version-agnostic ("React Router") since the library is now on v8. No behavioral change.
- `conversation-routing`: same wording fix — the `/conversations/:conversationId` route requirement names "React Router v6" explicitly; reword to be version-agnostic. No behavioral change.

## Impact

- **Affected code**: `apps/chat/src/main.tsx`, `apps/chat/src/app/app.tsx`, and ~50 other files under `apps/chat/src/**` that import from `react-router-dom` (components, pages, hooks, contexts, and tests).
- **Dependencies**: `package.json` — remove `react-router-dom`, add/bump `react-router` to v8; verify `react`, `react-dom`, and `vite` meet v8's minimum versions.
- **Build/CI**: no build tool or NestJS backend changes required; this only affects the Vite-built `apps/chat` frontend.
- **Testing**: Vitest specs that import from `react-router-dom` (e.g. `RequireAuth.spec.tsx`, `Navigation.spec.tsx`, page-level `*.spec.tsx` files) need import updates; no behavioral test changes expected.
