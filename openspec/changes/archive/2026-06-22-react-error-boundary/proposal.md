## Why

The AI DIAL Chat frontend has no React ErrorBoundary. When a React component throws during render or a lifecycle method, the result is a blank, broken screen with no recovery path for the user. The README already names `ErrorBoundary` as a planned component (`apps/chat/README.md:20,81`), but it has never been implemented. This gap represents a reliability and accessibility failure in the production application.

## What Changes

- **New** root and route wrappers around the `react-error-boundary` component at `apps/chat/src/components/ErrorBoundary/ErrorBoundary.tsx`
- **New** accessible fallback UI with a retry/reload action and i18n strings
- **New** unit tests under `apps/chat/src/components/ErrorBoundary/tests/`
- **Modified** `apps/chat/src/main.tsx` — wraps the root provider tree in the root-level boundary
- **Modified** `apps/chat/src/app/app.tsx` — wraps each lazy-loaded route (`CatalogView`, `ConversationPage`) in isolated per-route boundaries so a single route crash does not destroy the entire shell
- **Modified** `apps/chat/src/i18n/locales/en.json` — adds `errorBoundary.*` fallback text keys
- Adds `react-error-boundary` as a frontend runtime dependency; no backend changes; no changes under `libs/*`

## Capabilities

### New Capabilities

- `error-boundary`: Reusable root and route error-boundary wrappers that catch descendant render/lifecycle errors, display an accessible fallback UI, support explicit user-triggered recovery, and log root errors via `console.error`.

### Modified Capabilities

*(none — no existing spec-level requirements change)*

## Impact

**Code touched:**
- `apps/chat/src/components/ErrorBoundary/ErrorBoundary.tsx` — new component
- `apps/chat/src/components/ErrorBoundary/tests/ErrorBoundary.spec.tsx` — new tests
- `apps/chat/src/main.tsx` — root boundary wraps provider tree
- `apps/chat/src/app/app.tsx` — per-route boundaries around lazy-loaded routes
- `apps/chat/src/i18n/locales/en.json` — new `errorBoundary.*` i18n keys

**Dependencies:**
- `react-error-boundary` provides the underlying boundary and navigation reset support
- `@tabler/icons-react` already installed — used for the warning icon in the fallback UI
- `react-i18next` already installed — used for fallback text
- `@epam/ai-dial-ui-kit` already installed — Button component available if suitable

**Systems not affected:**
- Backend (`apps/chat-api`) — unchanged
- Libraries (`libs/*`) — unchanged
- Notification system — unchanged (toast errors remain; ErrorBoundary is for render crashes only)
- API error handling in `apps/chat/src/server-api/` — unchanged
