## 1. Explore current forms and design the shared lib

- [x] 1.1 Re-confirm the current field set and ownership shape of
      `apps/chat/src/pages/AppsEditor/GeneralForm.tsx` (self-contained: local state,
      `NAME_PATTERN`/`VERSION_PATTERN` validation, `createApplication` call, catalog `Card`
      preview) and `apps/chat/src/pages/ToolsetEditor/EditorForm/GeneralForm.tsx` (pure
      controlled view driven by `ToolsetEditor.tsx`), and confirm no other page reuses either
      component.
- [x] 1.2 Identify common fields (name, description, iconUrl, version, topics) vs.
      form-specific behavior (Quick App: `schemaId`, preview, submit call, `onCreated`/
      `onCancel`; Toolset: `endpoint`/auth/settings sections owned by sibling files) that must
      stay out of the shared lib.
- [x] 1.3 Resolved design.md Open Question 5: `NAME_PATTERN`/`VERSION_PATTERN` are fixed
      constants inside the lib's `validateDeploymentCreationFields`, but pattern checks are
      opt-in via a `DeploymentCreationFormValidationOptions` flag
      (`validateNamePattern`/`validateVersionPattern`), defaulting to off. This preserves each
      flow's current behavior exactly (Quick App enables both flags; Toolset enables neither,
      since it never enforced a name/version pattern before this change) — only the required-
      name and intro-length checks are unconditionally shared.
- [x] 1.4 Confirmed the target lib location/name (`libs/deployment-creation-form`, package
      `@epam/ai-dial-deployment-creation-form`) against existing `libs/*` naming (e.g.
      `libs/attachment-input` → `@epam/ai-dial-attachment-input`) and scaffolded it by hand
      (the `nx-generate` skill was not available in this session), matching
      `libs/starter-buttons`'s project config as a template. Added the
      `@epam/ai-dial-deployment-creation-form/*` path in `tsconfig.base.json` and a
      `tsconfig.lib.json` reference from `apps/chat/tsconfig.app.json` (re-verified after
      wiring real imports in tasks 3–4, since `nx sync` derives references from actual usage).

## 2. Build `libs/deployment-creation-form`

- [x] 2.1 Defined `DeploymentCreationFormValues`, `DeploymentCreationFormFieldErrors`,
      `DeploymentCreationFormLabels`, and `DeploymentCreationFormClassNames` models in
      `libs/deployment-creation-form/src/models/deployment-creation-form.ts` (fields: `name`,
      `description`, `iconUrl`, `version`, `topics`, `intro`). Validation-related types
      (`DeploymentCreationFieldErrorCode`, `DeploymentCreationFormErrorCodes`,
      `DeploymentCreationFormValidationOptions`) live in a separate `models/validation.ts`, since
      the validator returns untranslated error codes, not display strings (per the
      no-i18n-in-libs rule) — the host app maps codes to translated messages itself.
- [x] 2.2 Implemented the pure `validateDeploymentCreationFields(values, options?)` function in
      `libs/deployment-creation-form/src/utils/validate-deployment-creation-fields.ts`, covering:
      name required (always) + `NAME_PATTERN` (opt-in), version + `VERSION_PATTERN` (opt-in,
      only when non-empty), and `intro` max length (default 90, configurable). No side
      effects, no i18n, no app imports.
- [x] 2.3 Implemented the controlled `DeploymentCreationForm` component
      (`libs/deployment-creation-form/src/components/DeploymentCreationForm/DeploymentCreationForm.tsx`)
      rendering `Input` (name), `Textarea` (description), `Input` (iconUrl),
      `Input` (version), `DialTagInput` (topics), and a new `Input` (intro,
      single-line, `maxLength` HTML attribute) from `@epam/ai-dial-ui-kit`, wired to
      `values`/`errors`/`onChange`, with a default `flex flex-col gap-4` layout and an
      optional `classNames.root`/`classNames.field` passthrough.
- [x] 2.4 Verified library isolation: no imports of `apps/chat/src/server-api`,
      `@epam/chat-api-client`, `react-i18next`, routing, storage, or DIAL Core types anywhere
      in `libs/deployment-creation-form/src` (only `react`, `@epam/ai-dial-chat-shared`
      (`mergeClasses`), and `@epam/ai-dial-ui-kit`).
- [x] 2.5 Added unit tests for `validateDeploymentCreationFields` (11 cases: valid/empty/
      over-limit/custom-limit `intro`; name required/pattern opt-in/opt-out; version
      pattern opt-in/opt-out/empty) and component tests for `DeploymentCreationForm` (7 cases:
      renders all fields, `onChange` patches per field, surfaces/omits passed-in errors).
      `npm exec nx test @epam/ai-dial-deployment-creation-form` — 18/18 passing;
      `npm exec nx lint @epam/ai-dial-deployment-creation-form` and
      `npm exec nx typecheck @epam/ai-dial-deployment-creation-form` — both clean.

## 3. Wire Quick App creation to the shared form

- [x] 3.1 Refactored `apps/chat/src/pages/AppsEditor/GeneralForm.tsx` to hold its `useState`
      values in the `DeploymentCreationFormValues` shape (adding `intro`), render
      `<DeploymentCreationForm>` in place of the inline `Input`/`Textarea`/`DialTagInput`
      block, and keep its own two-pane layout, `Card` preview, and Cancel/Next buttons around
      it.
- [x] 3.2 `handleSubmit` calls `validateDeploymentCreationFields(values, { validateNamePattern:
      true, validateVersionPattern: true })` in place of the inline
      `NAME_PATTERN`/`VERSION_PATTERN`/required checks, mapping the returned error codes to
      translated messages; kept `submitError`/`isSubmitting` for the network-call outcome.
- [x] 3.3 `intro` is included in the `createApplication` payload
      (`apps/chat/src/server-api/applications.ts`) when non-empty (`values.intro.trim() ||
      undefined`).
- [x] 3.4 Added the new intro label/placeholder/error i18n keys to
      `apps/chat/src/constants/translation-keys.ts` (`AppsEditorI18nKeys`) and
      `apps/chat/src/i18n/locales/en.json`; passed into `DeploymentCreationForm`'s `labels` prop.
- [x] 3.5 Updated `apps/chat/src/pages/AppsEditor/tests/GeneralForm.spec.tsx` (10 tests): the
      existing pre-refactor cases still pass, plus new cases for intro length validation
      blocking submit and a trimmed intro reaching the create call.

## 4. Wire Toolset creation to the shared form

- [x] 4.1 Added `intro: string` to `ToolsetFormData` and `intro?: string`/`version?: string`
      to `ToolsetFormErrors` (`apps/chat/src/types/toolsets.ts`).
- [x] 4.2 Refactored `apps/chat/src/pages/ToolsetEditor/EditorForm/GeneralForm.tsx` into a
      thin wrapper rendering `<DeploymentCreationForm>` with `values`/`errors` mapped from
      `form`/`errors` and `onChange` forwarded as-is.
- [x] 4.3 `validate()` (`apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx`) calls
      `validateDeploymentCreationFields(data)` (no pattern flags, preserving prior behavior) for
      `name`/`intro`, merged with the existing `endpoint`/auth-specific checks; `handleSave`'s
      step-routing also switches to the General step when `nextErrors.intro` is set.
- [x] 4.4 `intro` is included in `formToToolsetBody` (`apps/chat/src/utils/toolsets.ts`) as
      `form.intro.trim() || undefined`, sent to `createToolset`
      (`apps/chat/src/server-api/toolsets.ts`).
- [x] 4.5 Added the new intro label/placeholder/error i18n keys to
      `apps/chat/src/constants/translation-keys.ts` (`ToolsetEditorI18nKeys`) and
      `apps/chat/src/i18n/locales/en.json`.
- [x] 4.6 Updated `apps/chat/src/pages/ToolsetEditor/EditorForm/tests/GeneralForm.spec.tsx`
      (7 tests, including new intro render/error/onChange cases) and fixed the `ToolsetFormData`
      fixtures broken by the new required `intro` field in
      `apps/chat/src/pages/ToolsetEditor/EditorForm/tests/SettingsForm.spec.tsx` and
      `apps/chat/src/utils/tests/toolsets.spec.ts` (added an intro-trimming test there too).
      `ToolsetEditor.spec.tsx` needed no changes (3 tests, unaffected).

## 5. Backend: Quick App create endpoint

- [x] 5.1 Added `intro?: string` to `CreateApplicationBodyDto`
      (`apps/chat-api/src/applications/dto/create-application.dto.ts`) with
      `@ApiPropertyOptional({ example: '...', maxLength: 90 })`, `@IsString()`,
      `@IsOptional()`, `@MaxLength(90)`.
- [x] 5.2 In `applications.service.ts` `createApplication`, `intro` is forwarded into
      `dialBody.application_properties.intro` when `body.intro` is set (mirroring the
      existing `if (body.description != null) ...` pattern).
- [x] 5.3 Added `apps/chat-api/src/applications/tests/create-application.dto.spec.ts` (4 new
      DTO-validation tests: omitted/empty/exactly-90/over-90 `intro`) and two new
      `applications.service.spec.ts` tests covering `intro` forwarding to
      `application_properties` and its absence when omitted.

## 6. Backend: Toolset create endpoint

- [x] 6.1 Added `intro?: string` to `ToolsetBodyDto`
      (`apps/chat-api/src/toolsets/dto/toolset-body.dto.ts`) with the same
      `@ApiPropertyOptional`/`@IsString`/`@IsOptional`/`@MaxLength(90)` decorators.
- [x] 6.2 In `toolsets.service.ts` `toDialToolsetBody`, `intro` is forwarded into
      `dialBody.defaults.intro` when `body.intro` is set (mirroring the existing
      `if (body.description != null) ...` pattern).
- [x] 6.3 Added `apps/chat-api/src/toolsets/tests/toolset-body.dto.spec.ts` (4 new
      DTO-validation tests) and two new `toolsets.service.spec.ts` tests covering `intro`
      forwarding to `defaults` and its absence when omitted.

## 7. Generated client regeneration

- [x] 7.1 Ran `npm run openapi`; regenerated `libs/chat-api-client/openapi.json` and the
      generated `ApplicationsApi`/`ToolsetsApi` models — `CreateApplicationBodyDto` and
      `ToolsetBodyDto` in `libs/chat-api-client/src/generated/src/models/index.ts` now include
      `intro?: string`.
- [x] 7.2 `npm run openapi:check` passes; the regenerated files under
      `libs/chat-api-client/src/generated/**` were produced entirely by the generator/postprocess
      pipeline, no hand edits.

## 8. Verification

- [x] 8.1 `npm exec nx test @epam/ai-dial-deployment-creation-form` — 18/18 passing;
      `npm exec nx lint @epam/ai-dial-deployment-creation-form` — clean;
      `npm exec nx typecheck @epam/ai-dial-deployment-creation-form` — clean.
- [x] 8.2 `npm exec nx test @epam/chat-api` — 963/963 passing (59 files);
      `npm exec nx lint @epam/chat-api` — 0 errors (1 pre-existing unrelated warning).
- [x] 8.3 `npm exec nx test @epam/chat` — 869 passing / 2 skipped (97 files);
      `npm exec nx lint @epam/chat` — 0 errors (18 pre-existing unrelated warnings);
      `npm exec nx typecheck @epam/chat` — clean.
- [x] 8.4 `npm exec nx build @epam/chat-api` — webpack build succeeds; also verified
      `npm exec nx build @epam/ai-dial-deployment-creation-form` succeeds.
- [ ] 8.5 Manual verification in the running app (create a Quick App and a Toolset each with a
      valid intro, an empty intro, and an intro over 90 characters against a live DIAL Core
      instance) was not performed in this session — automated coverage (unit/DTO/component
      tests above) confirms the logic, but the DIAL Core round-trip for
      `application_properties.intro` / `defaults.intro` (design.md Decision 1's flagged risk)
      still needs manual/Core-team confirmation before this ships broadly.

## 9. Visual parity follow-up (post-implementation feedback)

- [x] 9.1 Reordered the shared field stack in `DeploymentCreationForm.tsx` so `intro` renders
      directly under `description` (was after `topics`), per user review against the running
      app.
- [x] 9.2 Fixed a real Catalog-parity gap: replaced `border-*-primary` dividers with
      `border-*-tertiary` (matching `libs/catalog`'s own `Catalog.module.scss`/
      `DetailsPanel.module.scss` convention) in `AppsEditor.tsx`, `AppsEditor/GeneralForm.tsx`,
      `ToolsetEditorHeader.tsx`, and `ToolsetEditorView.tsx`; bumped inner form padding from
      `p-4` to `p-6`.
- [x] 9.3 Investigated and ruled out two other reported mismatches as out-of-scope,
      pre-existing, intentional app-shell behavior rather than regressions from this change:
      the chat-history-panel auto-collapsing to an icon rail on non-conversation routes
      (`apps/chat/src/app/app.tsx`'s `isHistoryPanelOpen` effect — also affects Catalog and
      File Manager), and `Input`'s built-in 4px corner radius (used identically
      app-wide, not something specific to the new lib).
- [x] 9.4 Added `Input`, `Textarea`, and `TagInput` wrappers to `libs/ai-dial-kit`
      (`libs/ai-dial-kit/src/components/{Input,Textarea,TagInput}/`), following the
      `Button/Buttons.tsx` wrapper pattern, so the app's field corner radius can be restyled
      once (`!rounded-xl` on `Input`/`Textarea`, matching `SearchBar`) instead of diverging
      per call site. Exported from `libs/ai-dial-kit/src/index.ts`; added component tests
      (`Input.spec.tsx`, `Textarea.spec.tsx`, 4 tests, passing) and JSDoc per `libs.md`.
- [x] 9.4.1 Follow-up after further review: the field **border color**, not just page-level
      dividers, was also flagged as mismatched against `libs/catalog`. Added
      `Input.scss` (imported by both `Input.tsx` and `Textarea.tsx`, since `Textarea`
      shares the `.dial-input` class) overriding the resting `border-color` from
      `--stroke-primary` to `--stroke-tertiary`, with explicit `!important` restores for the
      hover/focus/error state colors so those interactions keep working. `TagInput` still has
      no border-color override (same missing-CSS-hook limitation as its radius).
- [x] 9.4.2 Found and fixed a real bug in 9.4/9.4.1: `Input.tsx` was passing the radius/border
      overrides through the `className` prop, which `Input` forwards to its **inner**,
      always-borderless `<input>` (`border-0 bg-transparent`) — `Input`'s real visible
      border lives on a separate wrapper `<div>` ("input-container"), reachable only via the
      `wrapperClassName` prop. This meant the radius override never reached the real border
      (still square), and forcing `border-radius` onto the inner input — which has
      `overflow: hidden` for text-overflow ellipsis — clipped text/cursor near the corners on
      focus (`Textarea` does put `.dial-input` directly on the `<textarea>`, so it wasn't
      affected). Fixed by moving `border-radius` into the global `.dial-input` class override
      in `Input.scss` (reaches the wrapper `<div>` for `Input` and the `<textarea>` for
      `Textarea` uniformly) and removing all `className` manipulation from `Input.tsx`/
      `Textarea.tsx`, which are now pure pass-throughs. Also swapped the focus border color
      from the ui-kit default `--stroke-focus-black` (near-white, barely visible on a light theme,
      and after 9.4.1 nearly identical to the new lighter resting `--stroke-tertiary`) to
      `--stroke-accent-primary` plus a soft focus box-shadow ring, matching `SearchBar`'s own
      focus treatment. Updated `Input.spec.tsx`/`Textarea.spec.tsx` (className is now forwarded
      verbatim, no injected class). Re-verified: `@epam/ai-dial-kit` test/lint/typecheck/build,
      `@epam/ai-dial-deployment-creation-form` test/lint, and `@epam/chat`
      test/lint/typecheck — all clean (869 chat tests passing).
- [x] 9.5 Migrated `libs/deployment-creation-form`'s `DeploymentCreationForm.tsx` to import
      `Input`/`Textarea`/`TagInput` from `@epam/ai-dial-kit` instead of the primitives from
      `@epam/ai-dial-ui-kit` directly; removed `@epam/ai-dial-ui-kit` from
      `deployment-creation-form`'s `package.json` peerDependencies and `vite.config.mts`
      externals (no longer a direct dependency), added `@epam/ai-dial-kit` to both plus a
      `tsconfig.lib.json` project reference; updated `DeploymentCreationForm.spec.tsx` to mock
      `@epam/ai-dial-kit` instead of `@epam/ai-dial-ui-kit` (18/18 tests passing).
- [x] 9.6 Added a "Text fields" entry to `.claude/rules/all-tsx.md` banning direct
      `Input`/`Textarea`/`DialTagInput` imports app-wide, alongside the existing
      Button/SearchBar/Spinner/Tabs entries.
- [ ] 9.7 Not done (flagged as follow-up, see design.md Open Questions 6–7): no override was
      found/applied for `TagInput`'s own corner radius (no stable CSS class hook located in
      the shipped ui-kit bundle); other existing `Input`/`Textarea`/`DialTagInput`
      call sites in the app (Toolset's `SettingsForm.tsx`, `AuthSection.tsx`) were not migrated
      to the new wrappers.
- [x] 9.8 Re-verified after all 9.x changes: `npm exec nx test/lint/typecheck` clean for
      `@epam/ai-dial-kit`, `@epam/ai-dial-deployment-creation-form`, and `@epam/chat` (869 tests
      passing, 0 lint errors); `npm exec nx build @epam/ai-dial-deployment-creation-form`
      succeeds.

## 10. Native Core `intro` field + GET/listing round-trip (post-implementation, SDK update)

- [x] 10.1 User bumped `@epam/ai-dial-typescript-sdk` to `0.1.0-dev.31` in root `package.json`;
      found and fixed a stale separate pin (`0.1.0-dev.28`) in `apps/chat-api/package.json`
      that was shadowing it via a nested `apps/chat-api/node_modules` copy — `npm install`
      removed the stale nested copy after the fix.
- [x] 10.2 Switched `applications.service.ts`/`toolsets.service.ts` from stashing `intro` in
      `application_properties`/`defaults` to setting the SDK's new native top-level
      `dialBody.intro` field directly; removed the now-unneeded `application_properties: {}`
      initializer. Updated the corresponding service spec assertions.
- [x] 10.3 Added `intro?: string` to the GET/listing response DTOs so it round-trips back to
      the frontend: `ApplicationDto` (`apps/chat-api/src/applications/dto/application.dto.ts`),
      `DialToolsetDto` (`apps/chat-api/src/openapi/openapi-response.dto.ts`), and
      `DeploymentItemDto`/`RawDeploymentDto` (`apps/chat-api/src/deployments/dto/`) — the last
      pair backs `GET /api/v1/deployments`, the endpoint that actually populates the Catalog
      listing via `DeploymentsContext`. Wired `raw.intro` into `mapToDeploymentItem`. Added
      4 new tests (2 in `applications`/`toolsets` service specs already counted in section 9;
      2 new in `deployments.service.spec.ts` for intro forwarding/omission).
- [x] 10.4 Regenerated `libs/chat-api-client` (`npm run openapi` + `openapi:check`); confirmed
      `intro` now appears on the generated `ApplicationDto`, `DialToolsetDto`, and
      `DeploymentItemDto` models.
- [x] 10.5 Updated `apps/chat/src/utils/toolsets.ts`'s `toolsetDtoToForm` to read
      `intro: dto.intro ?? ''` instead of hardcoding `''`, so the Toolset edit form now
      pre-fills the `intro` set at creation.
- [x] 10.6 Re-verified: `npm exec nx test/lint/build @epam/chat-api` (965 tests passing, 0 lint
      errors, build succeeds); `npm exec nx test/lint/typecheck @epam/chat` (869 tests passing,
      0 lint errors, typecheck clean).
- [ ] 10.7 Not done: forwarding `intro` on toolset **update**, and rendering `intro` on Catalog
      cards (`CatalogItem`/`Card`) — both remain open per design.md's Open Questions/Non-Goals.
