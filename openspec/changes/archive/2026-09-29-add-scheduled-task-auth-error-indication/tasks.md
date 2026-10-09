# Tasks: add-scheduled-task-auth-error-indication

Slicing strategy: **vertical** — i18n first, then the shared helper with its tests, then each page wired and verified, then docs/validation. No new endpoint, client operation, or flag is introduced.

## 1. i18n key

- [x] 1.1 Add `scheduledTasks.authSessionExpiredNotification` ("The external scheduler service session has expired. Log in again from the Scheduled tasks page.") to `apps/chat/src/i18n/locales/en.json` and the matching `ScheduledTasksI18nKeys` member in `apps/chat/src/constants/translation-keys.ts` (grep `en.json` first for an existing equivalent value per the duplicate-value rule) — done: no duplicate value existed; key added as a `scheduledTasks` sibling of `disconnect`; app type-checks clean, key resolves from `en.json`

## 2. Shared helper

- [x] 2.1 Create the app-level check-and-decide helper (hook or util in `apps/chat/src/hooks/scheduledTasks/` or `utils/`): input — the caught submit error; returns whether the failure is auth-session-attributed. Logic: `getApiErrorStatus(error) === 403` → exactly one `getOfflineCredentials()` call → true iff `connected: false && available: true`; false for non-403, still-connected, and failed-check outcomes. JSDoc on every exported symbol; `useCallback` where a hook — done: `apps/chat/src/utils/scheduled-task-auth-error.ts`, plain async util (`isScheduledTaskAuthSessionError`), one request max, only on the 403 path
- [x] 2.2 Write the helper's spec (co-located `tests/`), covering: 403+disconnected → attributed; 403+connected → not attributed (generic path); 403+failed check → not attributed; non-403 → not attributed and **no** status request issued; exactly one request per 403 — **Verification:** `npm run test:file -- apps/chat/src/utils/tests/scheduled-task-auth-error.spec.ts` — PASS (5 tests)

## 3. Edit page

- [x] 3.1 Wire the helper into `ScheduledTaskEditPage`'s `handleSubmit` catch: after the existing field-error mapping and 404 handling, before the generic toast, use the helper; on `true` show the `authSessionExpiredNotification` toast instead of `EditErrorNotification`; form state and navigation unchanged — **Verification:** extend `apps/chat/src/pages/ScheduledTaskEditPage/tests/` spec: 403+disconnected → auth toast (generic absent, form intact, no navigation); 403+connected → generic toast; non-403 failure → today's behavior with zero status requests; `npm run test:file -- <edit page spec>`

## 4. Create page

- [x] 4.1 Wire the same helper into `ScheduledTaskCreatePage`'s submit catch identically — **Verification:** extend the create page's spec with the same paths; `npm run test:file -- apps/chat/src/pages/ScheduledTaskCreatePage/tests/ScheduledTaskCreatePage.spec.tsx` — PASS (the chat-hooks mock falls back to the real parsers so pre-existing real-error tests keep passing)

## 5. Docs + validation

- [x] 5.1 Check `docs/auth/auth-bff-encrypted-cookie.md` (the offline-credentials flow section) and `docs/architecture.md` (scheduled-tasks prose) for whether the 403-disambiguation leg needs a sentence; add only if otherwise stale — done: one bullet added to the offline-credentials Mechanics section (the 403-disambiguation leg); `docs/architecture.md` checked conceptually — page-level error handling is below its cross-cutting scope, no change
- [x] 5.2 Run `npm run validate:docs` and `openspec validate --changes`; fix anything flagged — both PASS (46 markdown files; change validates)
- [x] 5.3 Close the change: one `npm run verify:changed` (full non-mutating verification if bundling is unaffected), then the five-axis quality review over the diff — verify:changed PASS (typecheck + lint + test; one import-order error auto-fixed); five-axis review done — verdict Approve, no blocking findings, one FYI (helper-level single-request contract) — 9/9 complete
