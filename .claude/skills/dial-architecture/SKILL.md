---
name: dial-architecture
description: Reference for the ai-dial-chat architecture - NX monorepo layout, Redux Toolkit + RxJS epics, Next.js API proxy, store/selectors/actions barrels, layer responsibilities and dependency rules. Use when adding a new store domain or API route, wiring up epics/selectors/actions, or reasoning about how data flows from a component through the store to DIAL Core.
metadata:
  author: ai-dial-chat
  version: "1.0"
---

The full architecture guide lives at `.claude/guides/architecture.md`. Read it for the complete reference, then apply the patterns below.

## When this applies

- Adding a new store domain (slice + reducers + epics + selectors)
- Adding or changing a Next.js API route
- Tracing data flow (component → dispatch → epic → API → DIAL Core → reducer → selector)
- Deciding where logic belongs across layers

## Core rules

- **Redux Toolkit + RxJS epics** for all state and side effects. No async logic in reducers — put it in epics.
- **Import selectors only from** `apps/chat/src/store/selectors.ts` (barrel). Never import directly from `store/[domain]/*.selectors.ts`.
- **Import actions only from** `apps/chat/src/store/actions.ts` (barrel).
- **No server-side state** — all persistence goes through DIAL Core via Next.js API routes.
- **`utils/server/*` is server-only** — never import it into components or client code.
- Use the **`@/src/...`** path alias for internal imports, not deep `../../` relatives.

## Adding a new store domain

1. Create `apps/chat/src/store/[domain]/`
2. `[domain].types.ts` — state shape
3. `[domain].reducers.ts` — `createSlice` with actions
4. `[domain].epics.ts` — `AppEpic` observables + `combineEpics`
5. `[domain].selectors.ts` — `createSelector`
6. Wire up: export selectors in `store/selectors.ts`, epics in `store/rootEpic.ts`, actions in `store/actions.ts`

## Adding a new API route

1. Create `apps/chat/src/pages/api/[route].ts`
2. Validate session first: `validateServerSession(session, req, res)`
3. Proxy to DIAL Core via server utilities

See `.claude/guides/architecture.md` for the full layer responsibility table, dependency rules, and quick reference.
