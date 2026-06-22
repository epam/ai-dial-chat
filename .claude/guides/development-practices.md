---
# Development Practices

**Project**: ai-dial-chat
**Language**: TypeScript 5.9.3 | **Framework**: Next.js 16 / React 19
**Linter**: ESLint 9 | **Formatter**: Prettier 3

---

## Code Style

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Component files | `PascalCase.tsx` | `ErrorMessageDiv.tsx` |
| Non-component files | `kebab-case.ts` | `conversation-service.ts` |
| React components | `PascalCase` named export | `export const ErrorMessageDiv: FC<Props>` |
| Hooks | `camelCase` with `use` prefix | `usePromptActions.ts` |
| Redux slices | `camelCase` + `Slice` | `conversationsSlice` |
| Redux actions export | `PascalCase` + `Actions` | `ConversationsActions` |
| Selectors export | `PascalCase` + `Selectors` | `ConversationsSelectors` |
| Types/Interfaces | `PascalCase` | `ConversationInfo`, `Props` |
| Constants | `UPPER_SNAKE_CASE` | `DEFAULT_TEMPERATURE` |
| Utility functions | `camelCase` | `getEntityBucket()` |

### Import Order (Prettier enforced)

```typescript
// 1. Third-party modules
import { FC } from 'react';
import { createSlice } from '@reduxjs/toolkit';

// 2. Local/internal imports (@/src/... or relative)
import { ErrorMessage } from '@/src/types/error';
import { someUtil } from './utils';
```

Single quotes, trailing commas — enforced by Prettier.

---

## React Component Pattern

```typescript
// Source: apps/chat/src/components/Chat/ErrorMessageDiv.tsx:1
import { IconCircleX } from '@tabler/icons-react';
import { FC } from 'react';

import { ErrorMessage } from '@/src/types/error';

interface Props {
  error: ErrorMessage;
}

export const ErrorMessageDiv: FC<Props> = ({ error }) => {
  return (
    <div className="mx-6 flex h-full flex-col items-center justify-center">
      {error.code && <i>Code: {error.code}</i>}
    </div>
  );
};
```

**Rules:**
- ✅ Named export (not default) for components
- ✅ `interface Props` defined in same file
- ✅ `FC<Props>` type annotation
- ✅ Tailwind CSS classes for styling
- ❌ No class components

---

## Redux Hook Pattern

```typescript
// In components, access store via typed hooks from store/hooks.ts
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors } from '@/src/store/selectors';
import { ConversationsActions } from '@/src/store/actions';

const dispatch = useAppDispatch();
const conversations = useAppSelector(ConversationsSelectors.selectConversations);

dispatch(ConversationsActions.setConversations(newConversations));
```

**Hooks file:** `apps/chat/src/store/hooks.ts`
**Selectors barrel:** `apps/chat/src/store/selectors.ts`
**Actions barrel:** `apps/chat/src/store/actions.ts`

---

## Epic (Async Side Effect) Pattern

```typescript
// Source: apps/chat/src/store/conversations/conversations.epics.ts:145
const initEpic: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType(ConversationsActions.init.type),
    filter(() => !ConversationsSelectors.selectInitialized(state$.value)),
    switchMap(() => {
      return concat(
        of(ConversationsActions.initLastConversationSettings()),
        // more actions...
      );
    }),
  );

export const conversationsEpics = combineEpics(initEpic, ...otherEpics);
```

**Rules:**
- ✅ Type epics as `AppEpic`
- ✅ Combine with `combineEpics` and export
- ✅ Use `ofType` to filter action types
- ✅ Use `switchMap` for cancellable operations, `mergeMap` for concurrent
- ❌ No side effects in reducers

---

## Code Quality Commands

| Action | Command | Auto-fix |
|--------|---------|----------|
| Lint all | `npm run lint` | `npm run lint:fix` |
| Format check | `npm run format` | `npm run format:fix` |
| Lint single project | `npm run nx lint chat` | `npm run nx lint chat -- --fix` |
| Format single project | `npm run nx format:fix chat` | - |
| Type check | `npx tsc --noEmit` | - |
| Affected only | `npm run affected:lint` | - |

### Configuration Files

| Tool | Config File |
|------|-------------|
| ESLint | `eslint.config.mjs` |
| Prettier | `prettier.config.js` |
| TypeScript | `tsconfig.json` (root) + per-project tsconfig |
| Vitest | `apps/chat/vite.config.ts` |

---

## Styling (Tailwind CSS)

```tsx
// Tailwind classes directly on elements - NO separate CSS files for components
<div className="flex h-full flex-col items-center justify-center text-error">
  <div className="mb-3 text-2xl font-medium">{title}</div>
</div>
```

- Config: `apps/chat/tailwind.config.js`
- Theme tokens (colors, spacing) defined in tailwind config
- SVG imports: `import Icon from './icon.svg'` (as React component) or `import url from './icon.svg?url'`

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DIAL_API_HOST` | Yes | DIAL Core backend URL |
| `DIAL_API_KEY` | Optional | API key if no JWT auth |
| `NEXTAUTH_SECRET` | Yes | next-auth session secret |
| `ENABLED_FEATURES` | No | Comma-separated feature flags |
| `THEMES_CONFIG_HOST` | No | Custom theme URL |
| `STORAGE_TYPE` | No | `api` (default) or `browserStorage` |

**Access in server code:** `process.env.DIAL_API_HOST`
**Access in client code:** `NEXT_PUBLIC_*` prefix required for public vars

---

## Dependencies

```bash
# Production dependency
npm install <package-name>

# Dev dependency
npm install -D <package-name>

# After installing, run affected tests
npm run affected:test
```

**Lock file**: `package-lock.json` — always commit

---

## Git Workflow

### Branch Naming
```
feature/[ticket-id]-[short-description]
fix/[ticket-id]-[short-description]
```

### Commit Message (Conventional Commits)
```
feat(chat): add replay button to chat header
fix(sidebar): resolve folder expansion state issue
refactor(store): move conversation utils to shared
```

**Types**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`

### Pre-PR Checklist
- [ ] `npm run lint:fix` — no lint errors
- [ ] `npm run format:fix` — formatted
- [ ] `npm run affected:test` — affected tests pass
- [ ] No hardcoded secrets or API keys

---

## Don't Do

| ❌ Avoid | ✅ Instead | Why |
|----------|-----------|-----|
| Default exports for components | Named exports | Better refactoring support |
| `../../` deep relative imports | `@/src/...` alias | Consistent, refactor-safe |
| Async logic in reducers | Put in epics | Redux reducers must be pure |
| Direct selector file imports | Import from `store/selectors.ts` | Barrel pattern, avoids circular deps |
| `console.log` in production code | Remove before commit | No logging framework; clean code |

---

## Quick Reference

| Need | Location |
|------|----------|
| ESLint config | `eslint.config.mjs` |
| Prettier config | `prettier.config.js` |
| Tailwind config | `apps/chat/tailwind.config.js` |
| TypeScript config | `apps/chat/tsconfig.json` |
| Redux hooks | `apps/chat/src/store/hooks.ts` |
| App constants | `apps/chat/src/constants/` |
| Shared utilities | `libs/shared/src/utils/` |
| App utilities | `apps/chat/src/utils/app/` |

---
