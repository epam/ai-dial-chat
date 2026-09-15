## 1. `UpdateApplicationBodyDto`

- [x] 1.1 In `apps/chat-api/src/applications/dto/update-application.dto.ts`, add an optional
      `applicationProperties?: Record<string, unknown>` field with `@ApiPropertyOptional()`,
      `@IsObject()`, `@IsOptional()` — copy the annotation shape from
      `create-application.dto.ts`'s `applicationProperties` field.
- [x] 1.2 Update the file's top-of-class comment: it currently says
      `applicationProperties` and `type` are "intentionally excluded"; correct it to say only
      `type` is excluded, and briefly note `applicationProperties`, when supplied, fully
      replaces the stored value (point to the service for the hoist/replacement details rather
      than duplicating them in a comment).
- [x] 1.3 In `apps/chat-api/src/applications/tests/update-application.dto.spec.ts`, add cases:
      valid object `applicationProperties` passes validation; `applicationProperties: null`
      passes validation (treated as not supplied); a non-object `applicationProperties` (string,
      array) fails validation.

## 2. `updateApplication` service logic

- [x] 2.1 In `apps/chat-api/src/applications/applications.service.ts`, extract the existing
      endpoint/features/inputAttachmentTypes/maxInputAttachments-hoisting logic already used in
      `createApplication` (lines ~139-145) into a small shared private helper (or a function in
      `common/utils/`) so both methods call the same hoist, rather than duplicating the
      destructure.
- [x] 2.2 In `updateApplication`, after fetching `existingResponse.data` and before building
      `mergedBody`: when `body.applicationProperties != null`, hoist
      `endpoint`/`features`/`inputAttachmentTypes`/`maxInputAttachments` out of it via the
      shared helper, then set `mergedBody.application_properties` to the remaining object
      (even when empty, `{}`) — a full replacement of whatever was previously stored, not a
      merge. When `body.applicationProperties == null`, leave `mergedBody.application_properties`
      untouched (as today).
- [x] 2.3 Apply the hoisted `endpoint`/`features`/`inputAttachmentTypes`/`maxInputAttachments`
      values only where the DTO's own top-level field of the same name is absent — i.e. the
      existing `if (body.endpoint != null) mergedBody.endpoint = body.endpoint;`-style lines stay
      first/authoritative, and each hoisted value is applied only as a fallback when the
      corresponding top-level DTO field was not supplied.
- [x] 2.4 In `apps/chat-api/src/applications/tests/applications.service.spec.ts`, add
      `updateApplication` cases covering the `applications-write-api` delta spec's new scenarios:
      applicationProperties omitted preserves existing config; `applicationProperties: null`
      preserves existing config; a supplied object fully replaces `application_properties`;
      empty arrays inside it are preserved (not dropped); the four keys are hoisted out of a
      supplied `applicationProperties` when no top-level field is set; a top-level field wins
      over the same key nested in `applicationProperties`; `application_type_schema_id` and
      `displayVersion` (when `version` is absent) remain untouched regardless of
      `applicationProperties`.

## 3. Controller documentation

- [x] 3.1 In `apps/chat-api/src/applications/applications.controller.ts`, update the
      `updateApplication` `@ApiOperation.description` — it currently states "Settings-step
      configuration (application_properties, version) is preserved untouched"; correct it to
      describe the new opt-in replacement behavior.
- [x] 3.2 In `apps/chat-api/src/applications/tests/applications.controller.spec.ts`, add/adjust
      a case asserting the controller passes `applicationProperties` through to
      `ApplicationsService.updateApplication` unchanged.

## 4. `deployments-details.service.ts` features passthrough fix

- [x] 4.1 In `apps/chat-api/src/deployments/details/deployments-details.service.ts`'s
      `buildApplicationDetails`, remove the `storedFeatures`/`merged` logic that mixes
      `customAppRaw?.features` into the returned `applicationProperties` — `applicationProperties`
      SHALL become `isRecord(raw.application_properties) ? raw.application_properties :
      undefined`, a verbatim passthrough.
- [x] 4.2 Add a new `customAppFeatures` field to the returned `applicationDetails` object, sourced
      from `customAppRaw?.features` (same `typeof`/existence guard the removed code used),
      populated only when that value is present.
- [x] 4.3 In `apps/chat-api/src/deployments/dto/deployment-details.dto.ts`'s
      `ApplicationDetailsDto`, add `customAppFeatures?: Record<string, unknown>` with
      `@ApiPropertyOptional({ type: 'object', additionalProperties: true, description: ... })`,
      cross-referencing `applicationProperties` and `features` in the description per the
      `deployment-details-api` delta spec's field docs.
- [x] 4.4 In `apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts`,
      add cases: an application whose `application_properties.features` key is preserved
      unchanged even when the raw custom-app response also has a top-level `features` JSON; the
      top-level JSON appears under `customAppFeatures`; a plain custom app with no
      `application_properties` still gets `customAppFeatures` populated from the top-level JSON.

## 5. Frontend consumer: `CustomAppEditor.tsx`

- [x] 5.1 In `apps/chat/src/pages/ToolsetEditor/CustomAppEditor.tsx`, change the `settingsForm`
      population effect to read `loadedDto.applicationDetails?.customAppFeatures` instead of
      `appProps.features` (from `loadedDto.applicationDetails?.applicationProperties`) for the
      `featuresData` textarea value.
- [x] 5.2 In `apps/chat/src/pages/ToolsetEditor/tests/CustomAppEditor.spec.tsx`, update the
      mocked `DeploymentDetailsDto` fixture(s) and assertions to use `customAppFeatures` instead
      of `applicationProperties.features`, and add a case confirming an unrelated
      `applicationProperties` key survives untouched when `customAppFeatures` is also present.

## 6. Generated API client

- [x] 6.1 Run `npm run openapi` to regenerate the OpenAPI spec and
      `@epam/ai-dial-chat-api-client` from the updated DTOs (`UpdateApplicationBodyDto`,
      `ApplicationDetailsDto`).
- [x] 6.2 Run `npm run openapi:check` and confirm it passes.
- [x] 6.3 Confirm `libs/chat-api-client`'s generated `UpdateApplicationBodyDto` type now
      includes `applicationProperties?: { [key: string]: any }` and `ApplicationDetailsDto`
      includes `customAppFeatures?: { [key: string]: any }`; build/lint `chat-api-client` if the
      generator touched non-generated files.

## 7. Verification

- [x] 7.1 `npm exec nx test chat-api` — backend unit tests for `applications` and
      `deployments/details`. (3238/3239 pass; the 1 failure,
      `attach-generation.integration.spec.ts`, is an unrelated pre-existing flake — passes in
      isolation and touches conversation-generation SSE resume, nothing this change modified.)
- [x] 7.2 `npm run test:file -- apps/chat/src/pages/ToolsetEditor/tests/CustomAppEditor.spec.tsx`
      — frontend test for the relocated features field.
- [x] 7.3 `npm exec nx lint chat-api` and `npm exec nx lint chat` for the touched files.
- [x] 7.4 `npm run verify:changed` for the full changed-slice check (build + lint + test +
      typecheck) before considering the change complete.
      (`lint:affected` passes clean. `test:changed`: `@epam/chat-api:test` passes fully;
      `@epam/chat:test` has 2 unrelated pre-existing flakes
      (`ScheduledTaskCreatePage.spec.tsx`, `SkillEditorPreview.spec.tsx`, neither touching
      applications/deployments-details/CustomAppEditor) that both pass in isolation.
      `typecheck:affected` fails, but only via a pre-existing `tsc --build` project-reference
      staleness cascade (TS6305) across dozens of files this change never touches — skills,
      telemetry, themes, toolsets, transcription, user-config — plus a few pre-existing
      semantic errors in those same untouched files; none of this change's files appear in the
      failure list, and this repo's `@nx/js/typescript`-based type-aware ESLint pass on every
      touched file is clean.)
- [x] 7.5 `npm run validate:docs` if any README or `docs/**` content ends up touched (not
      expected for this change, but confirm no drift was introduced by the DTO/Swagger edits).
      (No docs were touched by this change; `npm run validate:docs` passes cleanly regardless —
      43 markdown files checked, no drift.)
