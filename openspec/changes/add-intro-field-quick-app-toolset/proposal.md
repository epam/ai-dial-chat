## Why

Quick Apps and Toolsets are surfaced in the catalog with only a `name` and a long-form
`description`. Authors have no short, catalog-friendly summary field to help users scan
entries quickly. Adding a bounded `intro` field (max 90 characters) to both creation flows
gives authors a place to write a one-line pitch, consistent with how other short display
fields are already validated in this codebase (e.g. `firstMessage`/`deploymentId` in
`apps/chat-api/src/conversations/dto/create-conversation.dto.ts`).

## What Changes

- Add an optional `intro` string field, max length 90 characters, to Quick App creation
  (`apps/chat/src/pages/AppsEditor/GeneralForm.tsx` and
  `CreateApplicationBodyDto` in `apps/chat-api/src/applications/dto/create-application.dto.ts`).
- Add an optional `intro` string field, max length 90 characters, to Toolset creation
  (`apps/chat/src/pages/ToolsetEditor/EditorForm/GeneralForm.tsx`,
  `ToolsetFormData`/`ToolsetFormErrors` in `apps/chat/src/types/toolsets.ts`, and
  `ToolsetBodyDto` in `apps/chat-api/src/toolsets/dto/toolset-body.dto.ts`).
- Enforce the 90-character limit on both sides of the API boundary:
  - Frontend: inline manual validation (mirroring the existing `name`/`endpoint` checks in
    `AppsEditor/GeneralForm.tsx` and `ToolsetEditor.tsx`), surfaced as a field-level error
    before the request is sent.
  - Backend: `@IsString() @IsOptional() @MaxLength(90)` (+ `maxLength: 90` in the Swagger
    `@ApiProperty`/`@ApiPropertyOptional` decorator) on both DTOs, returning a 400 validation
    error when violated.
- Forward `intro` from the chat-api services to DIAL Core when creating a Quick App
  (`applications.service.ts` → `saveCustomApplication`) and a Toolset
  (`toolsets.service.ts` → `toDialToolsetBody` → `saveToolSet`).
- Regenerate `libs/chat-api-client` (generated OpenAPI client) from the updated chat-api
  Swagger spec so `CreateApplicationBodyDto`/`ToolsetBodyDto` types include `intro`.
- Add/update tests for: valid `intro`, omitted/empty `intro`, and `intro` longer than 90
  characters, on both the frontend forms and the backend DTO/service layers.

**Not breaking**: `intro` is optional; existing create requests without it continue to work
unchanged.

## Capabilities

### New Capabilities

- `quick-app-authoring`: frontend authoring behavior for the Quick App creation/edit form
  (General step fields, including the new `intro` field and its validation). This capability
  has no prior spec even though the underlying form already exists in code; this change
  establishes its spec baseline scoped to the fields relevant to this change (name, version,
  icon URL, description, topics, intro).
- `applications-write-api`: the `POST /api/v1/applications` create-application endpoint,
  including the new `intro` field validation and DIAL Core forwarding. No prior spec exists
  for this endpoint (only `applications-listing`, which covers `GET`).

### Modified Capabilities

- `toolset-authoring`: the "General step fields" requirement gains the `intro` field and its
  validation.
- `toolset-write-api`: the "Create toolset endpoint" requirement gains `intro` validation
  (max 90 characters, rejected with a 400) and its forwarding to DIAL Core.

## Impact

- **Frontend (`apps/chat/src`)**: `pages/AppsEditor/GeneralForm.tsx`,
  `pages/ToolsetEditor/EditorForm/GeneralForm.tsx`, `pages/ToolsetEditor/ToolsetEditor.tsx`
  (validate()), `types/toolsets.ts` (`ToolsetFormData`, `ToolsetFormErrors`),
  `types/apps-editor.ts` (if a shared form-state type exists there),
  `utils/toolsets.ts` (`formToToolsetBody`), `i18n/locales/en.json` +
  `constants/translation-keys.ts` (new label/error keys).
- **Backend (`apps/chat-api/src`)**: `applications/dto/create-application.dto.ts`,
  `applications/applications.service.ts`, `toolsets/dto/toolset-body.dto.ts`,
  `toolsets/toolsets.service.ts`.
- **Generated client (`libs/chat-api-client`)**: regenerated (not hand-edited) after the
  chat-api OpenAPI spec changes, via the repository's `openapi` scripts.
- **DIAL Core contract**: `Application`/`ToolSet` schemas
  (`@epam/ai-dial-typescript-sdk`) have no native `intro` field. This proposal stores it in
  the existing generic property bag (`application_properties.intro` for Application,
  `defaults.intro` for ToolSet) — see `design.md` for the rationale and the fallback if Core
  does not round-trip unknown properties as expected.
- **Tests**: new/updated unit tests in `apps/chat-api/src/applications/*.spec.ts`,
  `apps/chat-api/src/toolsets/*.spec.ts`, and frontend component/util tests for both editor
  forms.
