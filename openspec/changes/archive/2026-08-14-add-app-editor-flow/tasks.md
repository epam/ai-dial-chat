## 1. Backend — Create Application Endpoint

- [x] 1.1 Create `apps/chat-api/src/applications/dto/create-application.dto.ts` with `CreateApplicationBodyDto` (name required, type required, description/iconUrl/version optional; use `@IsString`, `@IsNotEmpty`, `@IsOptional`, `@IsUrl` from class-validator; also `topics?: string[]` with `@IsArray`, `@IsString({ each: true })`, `@IsOptional`)
- [x] 1.2 Add `createApplication(userSub, accessToken, body)` method to `apps/chat-api/src/applications/applications.service.ts` — proxy `POST /openai/applications` via `@epam/ai-dial-typescript-sdk` client, invalidate `applications:list:<userSub>` cache on success; map `topics` into the DIAL Core body when non-empty
- [x] 1.3 Add `@Post()` handler to `apps/chat-api/src/applications/applications.controller.ts` — validate body with `CreateApplicationBodyDto`, call service, apply `@Throttle({ default: { limit: 10, ttl: 60000 } })`, add `@ApiBody` + `@ApiResponse` Swagger decorators
- [x] 1.4 Write unit tests for the new service method in `apps/chat-api/src/applications/tests/applications.service.spec.ts` — success (cache cleared), DIAL Core 4xx forwarded, DIAL Core timeout → 503
- [x] 1.5 Write controller integration test in `apps/chat-api/src/applications/tests/applications.controller.spec.ts` — 201 on success, 400 on missing name, 401 without session, 429 on rate limit

## 2. Generated Client — createApplication Method

- [x] 2.1 Add `CreateApplicationRequest` model to `libs/chat-api-client/src/generated/src/models/` (name, type, description?, iconUrl?, version?) and add it to `libs/chat-api-client/src/generated/src/models/index.ts`
- [x] 2.2 Add `CreatedApplicationDto` model to `libs/chat-api-client/src/generated/src/models/` (id, name, and any fields echoed by DIAL Core) and add it to the models index
- [x] 2.3 Add `createApplicationRaw` and `createApplication` methods to `libs/chat-api-client/src/generated/src/apis/ApplicationsApi.ts` following the existing `listApplications` pattern
- [x] 2.4 Update `libs/chat-api-client/openapi.json` with the `POST /api/v1/applications` operation (operationId: `createApplication`, request body, 201/400/401/429/503 responses)

## 3. Frontend — DeploymentsContext: Expose Schemas

- [x] 3.1 Add `schemas: ApplicationSchemaSummaryDto[]` field to `DeploymentsContextType` interface in `apps/chat/src/context/DeploymentsContext.tsx`
- [x] 3.2 Add `schemas` state (`useState<ApplicationSchemaSummaryDto[]>([])`) to `DeploymentsProvider`
- [x] 3.3 Fetch schemas in parallel with deployments via `Promise.allSettled([getDeployments(...), getApplicationSchemas()])` inside `loadDeployments`; on schemas rejection log a warning but do not set `error`
- [x] 3.4 Include `schemas` in the `useMemo` context value (and in its dependency array)
- [x] 3.5 Update `apps/chat/src/context/tests/DeploymentsContext.spec.tsx` — add tests for: schemas populated on successful fetch, schemas empty on fetch failure (deployments still load), schemas in context value

## 4. Frontend — Constants and Route

- [x] 4.1 Create `apps/chat/src/constants/apps-editor.ts` with `AppsEditorQuery` enum, `AppsEditorStep` enum, `QUERY_VALUE_TRUE`, `READY_TO_INTERACT_EVENT`, and `UPDATED_SUCCESS_EVENT` constants
- [x] 4.2 Add `AppsEditor = '/apps-editor'` to the `ROUTES` enum in `apps/chat/src/types/routes.ts`
- [x] 4.3 Add all `appsEditor.*` i18n keys to `apps/chat/src/i18n/locales/en.json` and enum members to `AppsEditorI18nKeys` in `translation-keys.ts` (see key table in app-editor-flow spec; includes version, topics, and previewTitle keys)

## 5. Frontend — Server-API Wrapper

- [x] 5.1 Add `createApplication` export to `apps/chat/src/server-api/applications.ts` (thin wrapper calling `applicationsApi.createApplication` from the generated client)

## 6. Frontend — Routing

- [x] 6.1 Add lazy import and `<Route path={ROUTES.AppsEditor} ...>` to `apps/chat/src/app/app.tsx` following the existing `CatalogView` lazy-load pattern with `RouteErrorBoundary` + `Suspense`

## 7. Frontend — CatalogView Entry Point

- [x] 7.1 Consume `useDeployments().schemas` in `apps/chat/src/components/CatalogView/CatalogView.tsx`
- [x] 7.2 Replace the stub `createOptions` with schema-driven entries: find quickapps2 / toolset schemas by `id?.includes(...)`, hide each entry when no matching schema found
- [x] 7.3 Wire each `onClick` to `navigate(...)` with the correct query params (`step`, `schema`, `returnUrl`, `isCreating`)
- [x] 7.4 Wrap `createOptions` in `useMemo([schemas, navigate, t])`

## 8. Frontend — AppsEditor Page

- [x] 8.1 Create `apps/chat/src/pages/AppsEditor/AppsEditor.tsx` — read search params, resolve schema from `useDeployments().schemas`, own `createdAppId` + `isSubmitting` state, render step indicator and back button, render `<GeneralForm>` or `<SettingsStep>` based on current step
- [x] 8.2 Create `apps/chat/src/pages/AppsEditor/GeneralForm.tsx` — two-column layout: left column has `Input` (name, icon URL, version), `Textarea` (description), `DialTagInput` (topics), footer with `NeutralButton` (Cancel) + `PrimaryButton` (Next); right column (`bg-layer-1`) shows a live `<Card>` preview centered in the area, driven by `useMemo`-derived `CatalogItem` from form state; call `createApplication` on submit, invoke `onCreated(appId)` on success, show inline error on failure
- [x] 8.3 Create `apps/chat/src/pages/AppsEditor/SettingsStep.tsx` — receive `schema` + `appId` props, render `<AppEditorIframe>` when `schema.editorUrl` is truthy, else render placeholder message
- [x] 8.4 Create `apps/chat/src/pages/AppsEditor/AppEditorIframe.tsx` — build iframe src with auth params, render `<iframe>` + `<Spinner>` overlay, `useEffect` for `message` listener (readyToInteract → hide spinner, updatedApplicationSuccess → call onUpdated), cleanup on unmount

## 9. Frontend — Unit Tests

- [x] 9.1 Create `apps/chat/src/pages/AppsEditor/tests/GeneralForm.spec.tsx` — cover: renders fields, empty name shows error + no API call, valid submit calls API + onCreated, Next disabled while submitting, API failure shows error
- [x] 9.2 Create `apps/chat/src/pages/AppsEditor/tests/AppEditorIframe.spec.tsx` — cover: iframe src includes correct params, spinner visible on mount, spinner hidden after load event, spinner hidden after readyToInteract message, onUpdated called on updatedApplicationSuccess, listener removed on unmount

## 10. Verification

- [ ] 10.1 Run `npm exec nx lint chat-api` and `npm exec nx lint chat` — fix any lint errors
- [ ] 10.2 Run `npm exec nx test chat-api` — all tests pass
- [ ] 10.3 Run `npm exec nx test chat` — all tests pass
- [ ] 10.4 Run `npm exec nx build chat-api` — no TypeScript errors
- [ ] 10.5 Run `npm exec nx build chat` — no TypeScript errors
