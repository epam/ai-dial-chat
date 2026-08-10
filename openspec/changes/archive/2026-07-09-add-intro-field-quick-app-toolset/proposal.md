## Why

Quick Apps and Toolsets are surfaced in the catalog with only a `name` and a long-form
`description`. Authors have no short, catalog-friendly summary field to help users scan
entries quickly. Adding a bounded `intro` field (max 90 characters) to both creation flows
gives authors a place to write a one-line pitch, consistent with how other short display
fields are already validated in this codebase (e.g. `firstMessage`/`deploymentId` in
`apps/chat-api/src/conversations/dto/create-conversation.dto.ts`).

Today `apps/chat/src/pages/AppsEditor/GeneralForm.tsx` and
`apps/chat/src/pages/ToolsetEditor/EditorForm/GeneralForm.tsx` independently duplicate the
same "General step" field set — name, description, icon URL, version, topics — with the same
`Input`/`Textarea`/`DialTagInput` components from `@epam/ai-dial-ui-kit`, differing
only in state ownership (Quick App owns local state, validation, and the API call itself;
Toolset is a pure controlled view driven by its parent `ToolsetEditor.tsx`). Adding `intro` to
both forms separately would extend that duplication. This change instead extracts the shared
field set into a library once, and adds `intro` to the extracted form.

## What Changes

- Extract the fields shared by both "General step" forms — name, description, icon URL,
  version, topics, and the new `intro` — into a new library, `libs/deployment-creation-form`
  (package `@epam/ai-dial-deployment-creation-form`), as a fully controlled presentation
  component (`values`/`errors`/`onChange` props, no local state, no API calls, no network
  awareness) plus a pure field-validation function (`validateDeploymentCreationFields`) covering
  the name pattern/required check, the version pattern check, and the `intro` length check.
  This follows the existing controlled shape already used by
  `ToolsetEditor/EditorForm/GeneralForm.tsx`, rather than the Quick App form's
  self-contained shape.
- Add an optional `intro` string field, max length 90 characters, to the shared form's field
  set and to Quick App creation (`CreateApplicationBodyDto` in
  `apps/chat-api/src/applications/dto/create-application.dto.ts`).
- Add an optional `intro` string field, max length 90 characters, to the shared form's field
  set and to Toolset creation (`ToolsetFormData`/`ToolsetFormErrors` in
  `apps/chat/src/types/toolsets.ts`, and `ToolsetBodyDto` in
  `apps/chat-api/src/toolsets/dto/toolset-body.dto.ts`).
- Rewire both app-level forms to render the shared `libs/deployment-creation-form` component
  instead of their own duplicated field markup:
  - `AppsEditor/GeneralForm.tsx` keeps owning local state, submit timing, the
    `createApplication` call, and its app-specific two-pane layout with the live catalog
    `Card` preview (`@epam/ai-dial-catalog`) — none of that is shared, since Toolset creation
    has no equivalent preview.
  - `ToolsetEditor/EditorForm/GeneralForm.tsx` keeps forwarding `form`/`errors`/`onChange`
    from its parent `ToolsetEditor.tsx`, which keeps owning `validate()` and the
    multi-section editor layout (General/Settings/Auth).
- New `Input`, `Textarea`, and `TagInput` wrappers are added to `libs/ai-dial-kit` (thin
  pass-throughs around `Input`/`Textarea`/`DialTagInput`, following the existing
  `PrimaryButton`/`SearchBar`/`TabRow` wrapper convention), so the app's text-field visual
  style (e.g. corner radius) is restyled once and stays consistent everywhere, including
  other `libs/*` consumers such as `libs/catalog`. This supersedes this proposal's original
  decision to consume `Input`/`Textarea`/`DialTagInput` directly — reversed after
  visual-parity feedback against the Catalog page showed the app needs a single place to
  restyle these fields without diverging per call site. `.claude/rules/all-tsx.md` is updated
  with a new "Text fields" entry alongside the existing Button/SearchBar/Spinner/TabRow rules.
  `libs/deployment-creation-form` consumes `Input`/`Textarea`/`TagInput` from `@epam/ai-dial-kit`
  instead of importing `@epam/ai-dial-ui-kit` directly.
- Keep the two current visual layouts entirely app-owned: Quick App's two-column
  form-plus-preview layout and Toolset's stacked single-column layout are not part of the
  extracted lib. The lib renders only the field stack with neutral default layout classes,
  plus an optional `classNames`/style-override passthrough modeled on the existing
  CSS-custom-property override pattern in `libs/catalog/src/models/catalog-styles.ts`
  (`CatalogColors`/`CatalogTypography`) and the `Input`-specific precedent from
  `openspec/changes/archive/2026-05-16-add-input-component`
  (`InputColors`/`InputTypography` mapped to `--ci-*` CSS variables). This lets the two
  current call sites — and any future Chat-embedded usage outside the current Catalog view
  (`apps/chat/src/components/CatalogView/CatalogView.tsx`), since there is no separate Catalog
  app today — adapt spacing/visuals through composition without forking form logic.
- Enforce the 90-character `intro` limit on both sides of the API boundary:
  - Frontend: the shared `validateDeploymentCreationFields` function checks `intro` length,
    called from both `AppsEditor/GeneralForm.tsx`'s `handleSubmit` and
    `ToolsetEditor.tsx`'s `validate()`, surfaced as a field-level error before the request is
    sent.
  - Backend: `@IsString() @IsOptional() @MaxLength(90)` (+ `maxLength: 90` in the Swagger
    `@ApiProperty`/`@ApiPropertyOptional` decorator) on both DTOs, returning a 400 validation
    error when violated.
- Forward `intro` from the chat-api services to DIAL Core when creating a Quick App
  (`applications.service.ts` → `saveCustomApplication`) and a Toolset
  (`toolsets.service.ts` → `toDialToolsetBody` → `saveToolSet`).
- Regenerate `libs/chat-api-client` (generated OpenAPI client) from the updated chat-api
  Swagger spec so `CreateApplicationBodyDto`/`ToolsetBodyDto` types include `intro`.
- Add/update tests for: valid `intro`, omitted/empty `intro`, and `intro` longer than 90
  characters, on the shared lib's validator/component, on both app-level forms, and on the
  backend DTO/service layers.

**Not breaking**: `intro` is optional; existing create requests without it continue to work
unchanged. The form extraction is an internal refactor of `AppsEditor`/`ToolsetEditor`; it
does not change either creation flow's user-observable behavior beyond adding `intro`.

## Capabilities

### New Capabilities

- `deployment-creation-form`: the shared, host-agnostic "general fields" form library
  (`libs/deployment-creation-form`) used by both Quick App and Toolset creation — its field set
  (name, description, icon URL, version, topics, intro), controlled component contract, pure
  validation function, and library-isolation boundary (no routes, no API calls, no generated
  client imports, no i18n).
- `quick-app-authoring`: frontend authoring behavior for the Quick App creation/edit form
  (General step fields, including the new `intro` field and its validation, now rendered via
  `deployment-creation-form`). This capability has no prior spec even though the underlying form
  already exists in code; this change establishes its spec baseline scoped to the fields
  relevant to this change (name, version, icon URL, description, topics, intro).
- `applications-write-api`: the `POST /api/v1/applications` create-application endpoint,
  including the new `intro` field validation and DIAL Core forwarding. No prior spec exists
  for this endpoint (only `applications-listing`, which covers `GET`).

### Modified Capabilities

- `toolset-authoring`: the "General step fields" requirement gains the `intro` field and its
  validation, and is now rendered via the shared `deployment-creation-form` library instead of
  its own duplicated field markup.
- `toolset-write-api`: the "Create toolset endpoint" requirement gains `intro` validation
  (max 90 characters, rejected with a 400) and its forwarding to DIAL Core.

## Impact

- **New library (`libs/deployment-creation-form`)**: new `libs/deployment-creation-form/src/`
  package exporting the controlled form component, its prop/value/error models, and the pure
  `validateDeploymentCreationFields` function; new `package.json`
  (`@epam/ai-dial-deployment-creation-form`), Nx project config, and unit tests, following the
  structure of existing libs such as `libs/attachment-input`.
- **Frontend (`apps/chat/src`)**: `pages/AppsEditor/GeneralForm.tsx` (rewritten to wrap the
  shared component, keep local state/submit/preview),
  `pages/ToolsetEditor/EditorForm/GeneralForm.tsx` (rewritten to wrap the shared component),
  `pages/ToolsetEditor/ToolsetEditor.tsx` (`validate()` calls the shared validator),
  `types/toolsets.ts` (`ToolsetFormData`, `ToolsetFormErrors`), `utils/toolsets.ts`
  (`formToToolsetBody`), `i18n/locales/en.json` + `constants/translation-keys.ts` (new
  label/error keys, passed into the shared component as props since libs must not import
  i18n).
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
- **Tests**: new unit tests for `libs/deployment-creation-form` (component + validator); updated
  tests in `apps/chat-api/src/applications/*.spec.ts`, `apps/chat-api/src/toolsets/*.spec.ts`;
  updated component tests for both app-level `GeneralForm.tsx` wrappers and
  `ToolsetEditor.tsx`'s `validate()`.

## Non-Goals

- Building a general-purpose theming/design-token system for the new lib beyond the
  `classNames`/CSS-custom-property override pattern already established by
  `libs/catalog`/the archived `add-input-component` change.
- Migrating other existing `Input`/`Textarea`/`DialTagInput` call sites in the app
  (e.g. `ToolsetEditor/EditorForm/SettingsForm.tsx`, `AuthSection.tsx`) to the new
  `libs/ai-dial-kit` `Input`/`Textarea`/`TagInput` wrappers — only `deployment-creation-form`'s
  usage is migrated in this change; broader app-wide migration is a follow-up.
- A full visual redesign of the field/panel chrome (background layering, page-level
  typography) beyond the border-color and corner-radius adjustments made in this change.
- Creating a separate Catalog application; "Catalog" remains a view inside `apps/chat`
  (`apps/chat/src/components/CatalogView/CatalogView.tsx`). See Open Questions in `design.md`
  for what "Chat context" styling should mean concretely, since no second consumer exists yet.
- Editing/pre-filling `intro` on the Toolset **update** flow (`updateToolset`), or rendering
  `intro` anywhere in the Catalog card UI (`CatalogItem`/`Card`) — still out of scope. (Reading
  `intro` back through `GET` listing/get endpoints, and pre-filling it in the Toolset edit
  form, is now done — see design.md's Decisions/Risks for the SDK update that enabled this.)
