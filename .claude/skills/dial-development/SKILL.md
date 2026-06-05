---
name: dial-development
description: Reference for ai-dial-chat code style and conventions - naming (PascalCase components, kebab-case files), import order, React FC component pattern, Redux hooks/epic patterns, lint/format/typecheck commands, conventional commits, and the pre-PR checklist. Use when writing components, hooks, or store code, or preparing a commit/PR.
metadata:
  author: ai-dial-chat
  version: "1.0"
---

The full development practices guide lives at `.claude/guides/development-practices.md`. Read it for the complete reference, then apply the conventions below.

## When this applies

- Writing components, hooks, or store code
- Naming files/exports, ordering imports
- Preparing a commit or PR

## Naming

| Element | Convention | Example |
|---------|------------|---------|
| Component files | `PascalCase.tsx` | `ErrorMessageDiv.tsx` |
| Other files | `kebab-case.ts` | `conversation-service.ts` |
| Components | `PascalCase` **named** export | `export const ErrorMessageDiv: FC<Props>` |
| Hooks | `use` + `camelCase` | `usePromptActions` |
| Actions / Selectors export | `PascalCase` + suffix | `ConversationsActions`, `ConversationsSelectors` |
| Constants | `UPPER_SNAKE_CASE` | `DEFAULT_TEMPERATURE` |

## Patterns

- **Components**: named export, `interface Props` in the same file, `FC<Props>`, Tailwind classes. No class components, no default exports.
- **Redux in components**: `useAppDispatch` / `useAppSelector` from `@/src/store/hooks`; selectors from `store/selectors.ts`, actions from `store/actions.ts`.
- **Epics**: type as `AppEpic`, filter with `ofType`, `switchMap` for cancellable / `mergeMap` for concurrent, export via `combineEpics`. No side effects in reducers.
- **Imports**: third-party first, then local; single quotes, trailing commas (Prettier-enforced). Use `@/src/...`, not `../../`.

## Commands

| Action | Command |
|--------|---------|
| Lint / fix | `npm run lint` / `npm run lint:fix` |
| Format / fix | `npm run format` / `npm run format:fix` |
| Type check | `npx tsc --noEmit` |
| Affected | `npm run affected:lint`, `npm run affected:test` |

## Commits (Conventional Commits)

`feat(chat): ...`, `fix(sidebar): ...`, `refactor(store): ...` — types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`.

**Pre-PR**: `lint:fix` clean, `format:fix` applied, `affected:test` passing, no hardcoded secrets.

See `.claude/guides/development-practices.md` for the full style guide, env vars, and anti-patterns.
