## 1. Baseline version bump

- [x] 1.1 Bump `react` and `react-dom` to `^19.2.7` in `package.json` (v8's minimum floor); reinstall
- [x] 1.2 Run `npm exec nx test chat`, `npm exec nx lint chat`, `npm exec nx build chat` to confirm the patch bump alone introduces no regression
- [x] 1.3 Confirm Node (22.22+) and Vite (`^8.0.0`, already installed) already satisfy v8's floor; no action needed if satisfied

## 2. Dependency swap

- [x] 2.1 Remove `react-router-dom` (and `@types/react-router-dom` if present) from `package.json`
- [x] 2.2 Add `react-router@^8` as a direct dependency in `package.json`
- [x] 2.3 Install and confirm `npm ls react-router-dom` resolves to zero packages

## 3. Import migration

- [x] 3.1 Replace every `from 'react-router-dom'` with `from 'react-router'` across `apps/chat/src/**/*.ts(x)` (components, pages, hooks, contexts) — no `react-router/dom` import is needed since the app never uses `RouterProvider`
- [x] 3.2 Apply the same import replacement to all `*.spec.tsx` test files that import from `react-router-dom` (e.g. `ConversationsContext.spec.tsx`, `OverlayContext.spec.tsx`, `ChatLayout.spec.tsx`, `ErrorBoundary.spec.tsx`, `UserMenu.spec.tsx`, `Navigation.spec.tsx`, `RequireAuth.spec.tsx`, `LogoutConfirmationModal.spec.tsx`, `CatalogView.spec.tsx`, `Header.spec.tsx`, `ScheduledTaskCreatePage.spec.tsx`, `SharedInvitation.spec.tsx`, `ToolsetEditor.spec.tsx`, `NotFound.spec.tsx`, `ScheduledTasksPage.spec.tsx`, `ConversationSharedInvitation.spec.tsx`, `ConversationRoute.spec.tsx`)
- [x] 3.3 Run `grep -r "react-router-dom" apps/chat/src` and confirm zero hits

## 4. Verification

- [x] 4.1 Run `npm exec nx build chat` — confirm it succeeds with no unresolved `react-router-dom` imports
- [x] 4.2 Run `npm exec nx lint chat` — fix any lint findings from the import change
- [x] 4.3 Run `npm exec nx test chat` — confirm all existing routing-related tests pass unchanged (`Navigation`, `RequireAuth`, `ConversationRoute`, `CatalogView`, page-level route tests)
- [x] 4.4 Manually smoke-test the app (`npm start`): navigate `/`, `/catalog`, `/conversations/:id`, an unknown path (404), and browser back/forward, to confirm no behavioral regression

## 5. Spec updates

- [x] 5.1 Verify the `navigation-routing` and `conversation-routing` delta specs in this change accurately describe the version-agnostic wording (no other content changes)
- [ ] 5.2 Run `openspec archive` at the end of implementation to fold the delta specs into `openspec/specs/navigation-routing/spec.md` and `openspec/specs/conversation-routing/spec.md`
