## Context

`apps/chat` uses React Router in declarative/SPA mode only: `BrowserRouter` in `apps/chat/src/main.tsx`, `Routes`/`Route` in `apps/chat/src/app/app.tsx`, and hooks (`useNavigate`, `useLocation`, `useParams`) plus components (`Link`, `NavLink`) scattered across ~50 files (components, pages, hooks, contexts, and their `*.spec.tsx` tests). The app does not use framework mode (`@react-router/dev`), loaders/actions, `RouterProvider`, Cloudflare, or Architect adapters — so the bulk of the v7→v8 changelog (middleware defaults, `loaderData`, route module splitting, Cloudflare Vite plugin, Architect adapter) does not apply.

React Router v8 removes the `react-router-dom` package entirely. Its exports (including `BrowserRouter`, `Routes`, `Route`, `Link`, `NavLink`, and all hooks) now live in `react-router`; only DOM-specific low-level APIs like `RouterProvider` moved to `react-router/dom`, which this app doesn't use. v8 also raises minimum versions to Node 22.22+, React 19.2.7+, and Vite 7+.

Current versions in this repo: `react-router-dom@^7.15.1`, `react@^19.2.6`, `react-dom@^19.2.6`, `vite@^8.0.0`. Vite already exceeds the v8 floor. React/React DOM are one patch below the stated floor (19.2.6 vs 19.2.7) and must be bumped alongside the router upgrade.

## Goals / Non-Goals

**Goals:**
- Move `apps/chat` from `react-router-dom@7` to `react-router@8` with zero routing-behavior change.
- Update every import site from `react-router-dom` to `react-router`.
- Satisfy v8's minimum version floor (Node, React, React DOM, Vite).
- Keep the existing declarative routing pattern (`BrowserRouter`, `Routes`, `Route`, lazy-loaded route components, `RouteErrorBoundary` + `Suspense` wrapper) exactly as-is.

**Non-Goals:**
- Adopting framework mode, `RouterProvider`, loaders/actions, or middleware — this app doesn't use them today and this change doesn't introduce them.
- Changing the route table, navigation UX, or any component's rendering behavior.
- Touching `apps/chat-api` (NestJS backend) — it has no React Router dependency.

## Decisions

- **Single-package import, no `react-router/dom` needed**: since the app only uses declarative APIs (`BrowserRouter`, `Routes`, `Route`, `Link`, `NavLink`, navigation hooks) and never imports `RouterProvider`, every `react-router-dom` import becomes a `react-router` import. No file needs `react-router/dom`.
- **Codemod via find-and-replace, not manual file-by-file edits**: with ~50 files touched and a single mechanical transform (`'react-router-dom'` → `'react-router'` in import specifiers only), a scripted `sed`/codemod pass is lower-risk than hand editing, followed by `tsc`/lint/test to catch anything the mechanical pass missed (e.g. string literals in unrelated contexts, mock paths in tests).
- **Upgrade `package.json` in one step, not incrementally through v7 flags**: the official guide's `future.v8_*` flags (middleware, split route modules, Vite Environment API, pass-through requests, trailing-slash-aware data requests) only affect framework-mode / server behaviors this app doesn't use, so there is no incremental flag-enabling step needed — go straight from `react-router-dom@7` to `react-router@8`.
- **Bump React/React DOM to `^19.2.7` alongside the router**: v8 requires it, and it's a patch-level bump with no expected code impact.
- **Update the two spec files that name "React Router v6" literally**: `navigation-routing` and `conversation-routing` state the major version in requirement text; reword to version-agnostic "React Router" so specs don't keep drifting out of sync with the actual dependency version (they were already stale at v7 relative to what code runs).

## Risks / Trade-offs

- [Missed import site (e.g. a dynamic import string, a mock in a test file, or a re-export barrel)] → Run `grep -r "react-router-dom"` across `apps/**` after the codemod as a verification gate before considering the migration complete; also rely on `tsc`/build failing loudly on any leftover `react-router-dom` import since the package is uninstalled.
- [`@testing-library` or test utilities importing `react-router-dom` indirectly through a shared test helper] → Audit `*.spec.tsx` files in the same pass as source files; `apps/chat/src/context/tests/`, `apps/chat/src/components/**/tests/`, and `apps/chat/src/pages/**/tests/` all appear in the current `react-router-dom` usage list and need the same import swap.
- [React 19.2.7 bump surfaces an unrelated regression] → It's a patch version; run the full `nx affected` test/build/lint suite for `chat` after the bump to catch anything before merge.
- [Third-party dependency still pins `react-router-dom` as a peer/transitive dependency] → Not expected (no other workspace package declares a router dependency per `package.json` search), but `npm ls react-router-dom` after removal should show zero resolutions.

## Migration Plan

1. Bump `react`/`react-dom` to `^19.2.7` in `package.json`, install, run `chat` tests/build to confirm no regression from the patch bump alone.
2. Remove `react-router-dom` and add `react-router@^8` in `package.json`; install.
3. Run a repo-wide import codemod: replace `from 'react-router-dom'` with `from 'react-router'` across `apps/chat/src/**/*.ts(x)`.
4. Run `npm exec nx lint chat`, `npm exec nx build chat`, `npm exec nx test chat` to catch any remaining `react-router-dom` references (build/typecheck will fail hard since the package is uninstalled) and any subtle runtime regressions.
5. Update `navigation-routing` and `conversation-routing` specs per the delta files in this change (implemented at archive time via `openspec archive`).
6. `grep -r "react-router-dom" apps/` as a final zero-hits verification gate.

Rollback: revert the `package.json` dependency change and the import codemod commit — no data migration or persisted state is involved, so rollback is a plain `git revert`.

## Open Questions

- None — this is a contained, mechanical dependency upgrade with no framework-mode surface area in this codebase.
