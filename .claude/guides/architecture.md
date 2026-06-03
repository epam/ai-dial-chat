---
# Architecture Guide

**Project**: ai-dial-chat v0.46.0-rc
**Style**: Modular NX Monorepo (Feature-sliced Redux + Next.js SSR)
**Language**: TypeScript 5.9.3 | **Framework**: Next.js 16 / React 19

---

## Architecture Overview

```
Browser Client (React 19)
  └─ Redux Store (RTK + RxJS Epics)
       ├─ store/conversations/   ──► Next.js API Routes
       ├─ store/models/          ──► /pages/api/models.ts
       ├─ store/files/           ──► /pages/api/files/
       └─ store/[domain]/        ──► /pages/api/[entity]/

Next.js API Routes (Server Proxy)
  └─ Validates session (next-auth)
       └─ Proxies to DIAL Core backend
```

**Key Decision**: No server-side state — all persistence via DIAL Core API. Client state is managed in Redux with async effects handled by RxJS epics.

---

## Component Structure

```
apps/chat/src/
├── components/          React UI components (functional, FC<Props>)
│   ├── Chat/            Chat messages, input, settings
│   ├── Chatbar/         Conversation list sidebar
│   ├── Common/          Shared UI building blocks
│   └── [Feature]/       Feature-specific components
├── store/               Redux slices by domain
│   ├── [domain]/
│   │   ├── *.reducers.ts     State + actions (createSlice)
│   │   ├── *.epics.ts        Side effects (RxJS observables)
│   │   ├── *.selectors.ts    Derived state (createSelector)
│   │   └── *.types.ts        TypeScript types
│   ├── selectors.ts     Re-exports ALL selectors (import from here)
│   ├── actions.ts       Re-exports ALL actions
│   └── rootEpic.ts      Combines all epics
├── pages/
│   ├── api/             Next.js API routes (server-side proxy)
│   └── *.tsx            Page components
├── hooks/               Custom React hooks
├── utils/app/           Client-side utilities
└── utils/server/        Server-only utilities

apps/chat-e2e/           Playwright E2E tests
libs/shared/             Shared types, constants, utils across apps
```

---

## Design Patterns Detected

| Pattern              | Usage                    | Location                                      |
| -------------------- | ------------------------ | --------------------------------------------- |
| Redux Slice          | Domain state + actions   | `apps/chat/src/store/[domain]/*.reducers.ts`  |
| RxJS Epic            | Async side effects       | `apps/chat/src/store/[domain]/*.epics.ts`     |
| Memoized Selector    | Derived state            | `apps/chat/src/store/[domain]/*.selectors.ts` |
| Functional Component | UI with Props interface  | `apps/chat/src/components/**/*.tsx`           |
| Server Proxy         | API gateway to DIAL Core | `apps/chat/src/pages/api/**/*.ts`             |
| Service Class        | Data access abstraction  | `apps/chat/src/utils/app/data/*-service.ts`   |

### Primary Pattern: Redux Slice + Epic

```typescript
// Source: apps/chat/src/store/conversations/conversations.reducers.ts:35
const initialState: ConversationsState = { initialized: false, conversations: [] };

const conversationsSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    init: (state) => {
      state.initialized = false;
    },
    setConversations: (state, { payload }: PayloadAction<Conversation[]>) => {
      state.conversations = payload;
    },
  },
});

export const ConversationsActions = conversationsSlice.actions;
```

**When to use**: Every new domain feature needs a Redux slice with reducers + epics.

---

## Layer Responsibilities

| Layer           | Responsibility              | Depends On              | Depended By                  |
| --------------- | --------------------------- | ----------------------- | ---------------------------- |
| Components      | Render UI, dispatch actions | store/selectors, hooks  | pages                        |
| Hooks           | Reusable component logic    | store, utils            | Components                   |
| Store/Reducers  | State mutations             | types                   | Epics, Selectors, Components |
| Store/Epics     | Async effects, API calls    | store/actions, services | rootEpic                     |
| Store/Selectors | Derived/computed state      | store                   | Components, Epics            |
| Pages/API       | Server-side session + proxy | utils/server, next-auth | Browser                      |
| Utils/App       | Business logic helpers      | types, constants        | Store, Components            |
| Utils/Server    | Server-only helpers         | next, next-auth         | Pages/API                    |
| Libs/Shared     | Types, constants, utils     | -                       | All apps                     |

---

## Dependency Rules

```
Components ──► store/selectors.ts (re-export barrel)
           ──► hooks/
           ──► utils/app/

Epics ──► store/actions.ts (re-export barrel)
      ──► utils/app/data/*-service.ts
      ──► pages/api/* (via fetch)

Pages/API ──► utils/server/* (server-only)
          ──► utils/auth/* (next-auth)
```

| Rule                                              | Enforced By                |
| ------------------------------------------------- | -------------------------- |
| Import selectors from `store/selectors.ts` barrel | Convention                 |
| Import actions from `store/actions.ts` barrel     | Convention                 |
| Server utils never imported in client code        | TypeScript path separation |
| `@/src/...` path alias for all internal imports   | tsconfig.json              |

**Violations to avoid:**

- ❌ Import selectors directly from `store/[domain]/*.selectors.ts` — use `store/selectors.ts`
- ❌ Import `utils/server/*` in components or client-side code

---

## Data Flow

```
User Action → Component → dispatch(Action)
                               │
                    Redux Reducer (sync state update)
                               │
                    RxJS Epic (ofType → async effect)
                               │
                    Next.js API Route (/api/...)
                               │
                    DIAL Core Backend
                               │
                    dispatch(successAction) → Reducer → State
                               │
                    Selector → Component re-render
```

**Example flow** (send chat message):

1. `ChatInput` dispatches `ConversationsActions.sendMessage(payload)`
2. `sendMessageEpic` catches action via `ofType`
3. Epic calls `fetch('/api/chat', { method: 'POST', body: ... })`
4. `/pages/api/chat.ts` validates session, streams from DIAL Core
5. Epic dispatches `ConversationsActions.updateConversation(result)`
6. Selector recomputes, component re-renders

---

## Key Abstractions

| Abstraction           | Purpose                   | Location                                               |
| --------------------- | ------------------------- | ------------------------------------------------------ |
| `AppEpic`             | Typed RxJS epic signature | `apps/chat/src/types/store.ts`                         |
| `AppAction`           | Union of all action types | `apps/chat/src/types/store.ts`                         |
| `Feature` enum        | Feature flags             | `@epam/ai-dial-shared`                                 |
| `ConversationService` | Conversation CRUD         | `apps/chat/src/utils/app/data/conversation-service.ts` |

---

## Adding New Features

### To add a new store domain:

1. **Create slice dir**: `apps/chat/src/store/[domain]/`
2. **Types**: `[domain].types.ts` — define state shape
3. **Reducers**: `[domain].reducers.ts` — `createSlice` with actions
4. **Epics**: `[domain].epics.ts` — `AppEpic` observables + `combineEpics`
5. **Selectors**: `[domain].selectors.ts` — `createSelector` from RTK
6. **Wire up**: Export selectors in `store/selectors.ts`, export epics in `store/rootEpic.ts`, export actions in `store/actions.ts`

### To add a new API route:

1. Create `apps/chat/src/pages/api/[route].ts`
2. Add session validation: `validateServerSession(session, req, res)`
3. Proxy to DIAL Core using server utilities

---

## Configuration

| Config Type   | Location                       | Accessed Via                               |
| ------------- | ------------------------------ | ------------------------------------------ |
| Environment   | `apps/chat/.env.local`         | `process.env.*` (server)                   |
| Feature Flags | `ENABLED_FEATURES` env var     | `Feature` enum from `@epam/ai-dial-shared` |
| Tailwind      | `apps/chat/tailwind.config.js` | CSS classes                                |
| Path Alias    | `apps/chat/tsconfig.json`      | `@/` → `apps/chat/`                        |

---

## Boundaries Summary

| ✅ DO                                      | ❌ DON'T                                       |
| ------------------------------------------ | ---------------------------------------------- |
| Import selectors from `store/selectors.ts` | Import directly from domain selector files     |
| Use `@/src/...` for all internal imports   | Use relative `../../` paths across directories |
| Put side effects in epics                  | Put async logic in reducers or components      |
| Use `createSelector` for derived state     | Compute derived state in components inline     |
| Validate session in every API route        | Skip session check in API handlers             |

---

## Quick Reference

| Need                   | Location                           |
| ---------------------- | ---------------------------------- |
| All selectors          | `apps/chat/src/store/selectors.ts` |
| All actions            | `apps/chat/src/store/actions.ts`   |
| All epics              | `apps/chat/src/store/rootEpic.ts`  |
| Redux store types      | `apps/chat/src/types/store.ts`     |
| Server utilities       | `apps/chat/src/utils/server/`      |
| Shared types/constants | `libs/shared/src/`                 |
| API routes             | `apps/chat/src/pages/api/`         |

---
