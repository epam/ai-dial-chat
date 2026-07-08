## Context

Quick App creation (`POST /api/v1/applications`) and Toolset creation (`POST /api/v1/toolsets`)
both accept `name`, `description`, `iconUrl`, `version`, and `topics`, validated with
`class-validator` DTOs in `apps/chat-api/src` and forwarded to DIAL Core via
`@epam/ai-dial-typescript-sdk` (`saveCustomApplication` / `saveToolSet`). Neither the DIAL
Core `Application` nor `ToolSet` schema (`node_modules/@epam/ai-dial-typescript-sdk/dist/index.d.ts`)
has a dedicated `intro` field. Both schemas do expose a generic string-keyed property bag:
`application_properties` (`MapStringObject`) on `Application`, and `defaults`
(`MapStringObject`) on `ToolSet`.

Both frontend forms (`AppsEditor/GeneralForm.tsx`, `ToolsetEditor/EditorForm/GeneralForm.tsx`)
currently validate fields with plain manual `if` checks and local error state — there is no
shared schema-validation library (no zod/yup) in these flows.

## Goals / Non-Goals

**Goals:**
- Let authors set a short `intro` (≤ 90 chars) when creating a Quick App or a Toolset.
- Reject `intro` over 90 characters with a clear error on both the frontend (before submit)
  and the backend (400 on the create endpoint), mirroring the existing `@MaxLength` pattern
  used in `apps/chat-api/src/conversations/dto/create-conversation.dto.ts`.
- Forward `intro` to DIAL Core as part of the create request body.
- Keep `libs/chat-api-client` as a generated artifact — no hand edits.

**Non-Goals:**
- Editing/pre-filling `intro` on the update flow or displaying it back after creation
  (`GET`/edit-mode round-trip) — the task scope is creation only. See **Open Questions** for
  the follow-up this implies.
- Rendering `intro` anywhere in the catalog UI (card, preview) — no catalog-display
  requirement was requested.
- Changing the DIAL Core schema itself.

## Decisions

### 1. Where `intro` lives in the DIAL Core request body

**Decision**: send `intro` inside the existing generic property bag on each schema —
`application_properties.intro` for `saveCustomApplication`, and `defaults.intro` for
`saveToolSet` — rather than as a top-level field (which the Core SDK type does not declare
and would fail TypeScript compilation), and rather than overloading `descriptionKeywords`.

**Alternatives considered**:
- *Top-level field on `DialApplication`/Toolset request body*: not possible without a Core
  schema change; the SDK types are generated from Core's own OpenAPI contract.
- *Encode into `descriptionKeywords`*: would corrupt the existing topics/keywords semantics
  and complicate parsing back out.
- *Store only in chat-api's own layer (not forwarded to Core)*: rejected — the requirement
  explicitly asks for `intro` to be forwarded to Core, and chat-api has no independent
  persistence layer for application/toolset metadata.

**Risk this decision carries**: `application_properties` / `defaults` are generic maps
historically used for schema-specific configuration values, not simple display metadata, and
it is **not confirmed** that DIAL Core preserves arbitrary keys under these maps for custom
application/toolset schemas across writes and reads. This must be verified against a real
DIAL Core instance during implementation (or confirmed with the Core team) before treating
this as final. If Core drops or rejects unrecognized keys in these maps, the fallback is to
request a native `intro` field addition on the Core side; this proposal's frontend/backend
validation logic does not change either way.

### 2. Frontend validation approach

**Decision**: extend the existing manual validation (no new schema-validation library
introduced), consistent with how `name`/`version`/`endpoint` are validated today:
- `AppsEditor/GeneralForm.tsx`: add an `introError` state and a length check inside
  `handleSubmit`, following the same pattern as `nameError`/`versionError`.
- `ToolsetEditor.tsx` `validate()`: add an `intro` length check alongside `name`/`endpoint`,
  extending `ToolsetFormErrors` (`apps/chat/src/types/toolsets.ts`) with `intro?: string`.

**Alternative considered**: introducing a schema-validation library (zod) for these forms —
rejected as out of scope; it would touch unrelated existing fields and is a larger refactor
than this change warrants.

### 3. Backend validation approach

**Decision**: `@IsString() @IsOptional() @MaxLength(90)` on `intro` in both
`CreateApplicationBodyDto` and `ToolsetBodyDto`, with `@ApiPropertyOptional({ example: '...',
maxLength: 90 })` for Swagger, matching the `firstMessage`/`deploymentId` pattern in
`apps/chat-api/src/conversations/dto/create-conversation.dto.ts`. The global `ValidationPipe`
(`whitelist: true, forbidNonWhitelisted: true, transform: true`, per
`apps/chat-api/AGENTS.md`) already turns a `class-validator` failure into a 400 response with
no extra controller code needed.

### 4. Generated client regeneration

**Decision**: after updating the two backend DTOs, regenerate `libs/chat-api-client` from the
chat-api OpenAPI spec using the repository's existing `openapi` / `openapi:check` npm scripts
(source of truth: `apps/chat-api/src/openapi-spec.ts` → `libs/chat-api-client/openapi.json` →
`openapi-generator-cli`). Do not hand-edit `libs/chat-api-client/src/generated/**`.

## Risks / Trade-offs

- **[Risk]** DIAL Core may not persist unrecognized keys under `application_properties` /
  `defaults` for custom schemas. → **Mitigation**: verify against a real Core instance during
  implementation; if it fails, treat this as a Core-side follow-up and keep the
  frontend/backend validation work (which is independently valuable) while deferring the
  Core-forwarding piece.
- **[Risk]** Without a GET-side mapping, `intro` set at creation cannot currently be
  retrieved back through chat-api's existing read endpoints/DTOs. → **Mitigation**: explicitly
  scoped as a non-goal in this change (see Open Questions); does not block shipping creation
  support.
- **[Trade-off]** No shared frontend validation schema library is introduced, keeping the
  diff small but continuing the existing pattern of ad hoc manual validation in both editor
  forms.

## Open Questions

1. Should a follow-up change add `intro` to the GET/list response DTOs
   (`apps/chat-api/src/applications/dto/application.dto.ts`,
   `apps/chat-api/src/toolsets/dto/get-toolset.dto.ts`) and to the edit-mode pre-fill in both
   forms, so an author can see/edit the `intro` they set at creation? This was out of scope
   for the current request but is a natural next step.
2. Should `intro` also be forwarded on **update** (`updateApplication`/`updateToolset`), not
   just create? The current request is scoped to creation only; if `intro` cannot be changed
   after creation, that should be communicated as a known limitation to authors.
3. Confirm with the DIAL Core team whether `application_properties.intro` / `defaults.intro`
   is an acceptable interim placement, or whether a native Core field is preferred before this
   ships broadly.
