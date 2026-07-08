## 1. Backend: Quick App create endpoint

- [ ] 1.1 Add `intro?: string` to `CreateApplicationBodyDto`
      (`apps/chat-api/src/applications/dto/create-application.dto.ts`) with
      `@ApiPropertyOptional({ example: '...', maxLength: 90 })`, `@IsString()`,
      `@IsOptional()`, `@MaxLength(90)`.
- [ ] 1.2 In `applications.service.ts` `createApplication`, forward `intro` into
      `dialBody.application_properties.intro` when `body.intro` is set (mirroring the
      existing `if (body.description != null) ...` pattern).
- [ ] 1.3 Add/update `apps/chat-api/src/applications/applications.service.spec.ts` (or
      equivalent) covering: create with a valid `intro`, create with `intro` omitted/empty,
      and DTO validation rejecting `intro` longer than 90 characters with a 400.

## 2. Backend: Toolset create endpoint

- [ ] 2.1 Add `intro?: string` to `ToolsetBodyDto`
      (`apps/chat-api/src/toolsets/dto/toolset-body.dto.ts`) with the same
      `@ApiPropertyOptional`/`@IsString`/`@IsOptional`/`@MaxLength(90)` decorators.
- [ ] 2.2 In `toolsets.service.ts` `toDialToolsetBody`, forward `intro` into
      `dialBody.defaults.intro` when `body.intro` is set (mirroring the existing
      `if (body.description != null) ...` pattern).
- [ ] 2.3 Add/update `apps/chat-api/src/toolsets/toolsets.service.spec.ts` covering: create
      with a valid `intro`, create with `intro` omitted/empty, and DTO validation rejecting
      `intro` longer than 90 characters with a 400.

## 3. Generated client regeneration

- [ ] 3.1 Run `npm run openapi` to regenerate `libs/chat-api-client/openapi.json` and the
      generated `ApplicationsApi`/`ToolsetsApi` models so `CreateApplicationBodyDto` and
      `ToolsetBodyDto` include `intro`.
- [ ] 3.2 Run `npm run openapi:check` to confirm the regenerated spec matches committed
      output; commit the regenerated files under `libs/chat-api-client/src/generated/**`
      without hand edits.

## 4. Frontend: Quick App editor

- [ ] 4.1 Add an `intro` field (state + `DialInput` or equivalent) to
      `apps/chat/src/pages/AppsEditor/GeneralForm.tsx`, alongside `description`/`iconUrl`.
- [ ] 4.2 Add an `introError` state and a 90-character length check in `handleSubmit`,
      mirroring the existing `nameError`/`versionError` checks; block submit and show the
      error when exceeded.
- [ ] 4.3 Include `intro` in the `CreateApplicationBodyDto` payload built in
      `GeneralForm.tsx` before calling `createApplication`
      (`apps/chat/src/server-api/applications.ts`).
- [ ] 4.4 Add the new label/error i18n keys to
      `apps/chat/src/constants/translation-keys.ts` (`AppsEditorI18nKeys`) and
      `apps/chat/src/i18n/locales/en.json`.
- [ ] 4.5 Add/update component tests for `GeneralForm.tsx` covering: valid intro, empty
      intro, and intro over 90 characters showing the length error and blocking submit.

## 5. Frontend: Toolset editor

- [ ] 5.1 Add `intro: string` to `ToolsetFormData` and `intro?: string` to
      `ToolsetFormErrors` (`apps/chat/src/types/toolsets.ts`).
- [ ] 5.2 Add an `intro` field to
      `apps/chat/src/pages/ToolsetEditor/EditorForm/GeneralForm.tsx`, alongside
      `description`/`iconUrl`, wired to `ToolsetFormData`/`ToolsetFormErrors`.
- [ ] 5.3 Add a 90-character length check for `intro` in `validate()`
      (`apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx`), alongside the existing
      `name`/`endpoint` checks.
- [ ] 5.4 Include `intro` in `formToToolsetBody` (`apps/chat/src/utils/toolsets.ts`) so it is
      sent to `createToolset` (`apps/chat/src/server-api/toolsets.ts`).
- [ ] 5.5 Add the new label/error i18n keys to
      `apps/chat/src/constants/translation-keys.ts` (`ToolsetEditorI18nKeys`) and
      `apps/chat/src/i18n/locales/en.json`.
- [ ] 5.6 Add/update tests for `GeneralForm.tsx` and `ToolsetEditor.tsx`'s `validate()`
      covering: valid intro, empty intro, and intro over 90 characters showing the length
      error and blocking save.

## 6. Verification

- [ ] 6.1 `npm exec nx test chat-api` and `npm exec nx lint chat-api`.
- [ ] 6.2 `npm exec nx test chat` and `npm exec nx lint chat` (or the affected project names
      for the frontend app).
- [ ] 6.3 `npm exec nx build chat-api` to confirm the DTO/Swagger changes compile.
- [ ] 6.4 Manually verify in the running app: create a Quick App and a Toolset each with a
      valid intro, an empty intro, and an intro over 90 characters, confirming the UI blocks
      the over-limit case and the backend rejects it if sent directly.
