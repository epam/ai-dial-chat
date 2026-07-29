## 0. Prerequisite

- [x] 0.1 Confirm `add-scheduled-tasks-api` is merged or available on the same branch stack: `POST /api/v1/scheduled-tasks`, OpenAPI regen, and `apps/chat/src/server-api/scheduled-tasks.api.ts` exporting `createScheduledTask`. Do not start slice 3 until this passes `npm exec nx test chat-api` and `npm run openapi:check`.

## 1. Route + flag guard + returnUrl plumbing

- [x] 1.1 Add `ScheduledTaskCreate = '/scheduled-tasks/new'` to `ROUTES` in `apps/chat/src/types/routes.ts`
- [x] 1.2 Create `apps/chat/src/pages/ScheduledTaskCreatePage/ScheduledTaskCreatePage.tsx` skeleton: `useFeatureFlag('scheduledTasksEnabled')` → `NotFoundPage` when disabled; `useSearchParams` for `returnUrl` (default `ROUTES.ScheduledTasks`); placeholder render until slice 3
- [x] 1.3 Register the lazy-loaded route in `apps/chat/src/app/app.tsx` (new `lazy(() => import(...))` + `<Route path={ROUTES.ScheduledTaskCreate}>` wrapped in `RouteErrorBoundary` + `Suspense` + `RouteFallback`)
- [x] 1.4 `npm exec nx lint chat` && smoke test: flag off → NotFound; flag on → page loads

## 2. Lib create-form component

- [x] 2.1 Add `libs/scheduled-tasks/src/models/scheduled-task-create-form-props.ts`: `ScheduledTaskCreateFormValues` (`displayName`, `scheduleType`, `runAt?`, `frequency?`, `time`, `dayOfWeek?`, `dayOfMonth?`, `modelId`, `prompt`, `stream`), `ScheduledTaskCreateFormErrors`, `ScheduledTaskCreateFormTexts`, `ScheduledTaskCreateFormModelOption`, `ScheduledTaskCreateFormProps` (JSDoc on every exported member)
- [x] 2.2 Implement `libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/ScheduledTaskCreateForm.tsx`: display name `Input`, schedule type control, conditional once/recurring fields, model `DialDropdown` from `modelOptions`, prompt `Textarea`, stream toggle, `NeutralButton` Cancel + `PrimaryButton` Create (disabled when `isSubmitting` or required fields empty); optional `styles` prop per libs typography rule
- [x] 2.3 Export component and types from `libs/scheduled-tasks/src/index.ts`
- [x] 2.4 Add `libs/scheduled-tasks/src/components/ScheduledTaskCreateForm/tests/ScheduledTaskCreateForm.spec.tsx`: renders all field groups, Create disabled when displayName/modelId/prompt empty, Create disabled when `isSubmitting`, callbacks fire, no host-integration imports, no description field
- [x] 2.5 `npm exec nx lint scheduled-tasks` && `npm exec nx test scheduled-tasks`

## 3. Trigger mapper + app page wiring (i18n, API submit, RTL/a11y)

- [x] 3.1 Add `apps/chat/src/utils/scheduled-task-trigger.ts` (or co-locate in page): `mapFormValuesToCreateBody(values)` → `{ displayName, trigger, model, prompt, stream }` per `design.md` cron/date mapping; unit test daily/weekly/monthly/once cases
- [x] 3.2 Add `scheduledTasks.create.*` keys to `ScheduledTasksI18nKeys`; add strings to `en.json` and mirror all locales; reuse `EditorI18nKeys.NameLabel/NameRequired` and `ButtonsI18nKeys.Cancel/Create`
- [x] 3.3 Wire `ScheduledTaskCreatePage`: `useDeployments()` (or existing hook) → `modelOptions`; controlled `values`/`errors`; `onCancel` → `navigate(returnUrl)`; `onSubmit` → validate → `createScheduledTask(...)` from `server-api/scheduled-tasks.api.ts` → success toast + navigate, error toast + preserve form
- [x] 3.4 Add page header (title + Cancel/Create) per design — single-step, not `EditorHeader` with steps (implemented as part of `ScheduledTaskCreateForm`'s own header row, consistent with `ScheduledTasksPage` rendering `ScheduledTasks`)
- [x] 3.5 Mobile-first logical Tailwind; AAA a11y on all fields and dropdowns
- [x] 3.6 Add `apps/chat/src/pages/ScheduledTaskCreatePage/tests/ScheduledTaskCreatePage.spec.tsx`: flag off → NotFound; valid submit → mocks `createScheduledTask`, asserts POST body shape including `trigger`; API error → error notification, no navigation; Cancel → `returnUrl`
- [x] 3.7 `npm exec nx lint chat` && `npm exec nx test chat`

## 4. Wire list page's New task button

- [x] 4.1 Update `ScheduledTasksPage`: replace no-op `onCreateClick` with `navigate(\`${ROUTES.ScheduledTaskCreate}?returnUrl=${encodeURIComponent(ROUTES.ScheduledTasks)}\`)`
- [x] 4.2 Update `ScheduledTasksPage.spec.tsx`: New task click navigates to create route with `returnUrl`
- [x] 4.3 `npm exec nx lint chat` && `npm exec nx test chat`

## 5. Final verification

- [x] 5.1 `npm exec nx affected --target=lint --base=origin/development-1.0`
- [x] 5.2 `npm exec nx affected --target=test --base=origin/development-1.0`
- [x] 5.3 `npm exec nx affected --target=build --base=origin/development-1.0`
- [x] 5.4 Manual verify: New task → fill form → Create persists (201) and returns to list; API error shows notification; Cancel returns without call; flag off → NotFound; RTL layout OK
