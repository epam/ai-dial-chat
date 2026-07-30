## Context

The catalog has two creation flows: Quick Apps (using the Apps Editor with a schema-driven form) and Toolsets (using the Toolset Editor with a two-step General + Settings form). Custom Apps require a similar two-step editor with a Settings form that exposes chat completion URL, features data, attachment types, and max attachments. Unlike Quick Apps, Custom Apps have no application-type schema ID.

## Goals / Non-Goals

**Goals:**
- Add custom app create option to the catalog, gated by a new `OverlayFeature`
- Reuse `ToolsetEditorHeader` and `CustomAppEditorView` shells
- Introduce `CustomAppSettingsForm` as the Settings step
- Full create **and edit** round-trip: load settings from backend, save settings on update

**Non-Goals:**
- Backend schema changes
- JSON validation for Features data on blur (deferred)

## Decisions

**Reuse ToolsetEditor layout, not QuickApp editor**
The Toolset Editor already has a two-step General + Settings pattern with a matching header and view. Introduce a `CustomAppEditor` page that reuses `ToolsetEditorHeader` and a new `CustomAppEditorView` (mirrors `ToolsetEditorView` but renders `CustomAppSettingsForm` in the Settings step). This avoids coupling the existing Toolset types to custom-app concerns.

**Feature flags: `OverlayFeature.CustomApps` + `OverlayFeature.HideCustomAppCreation`**
`CustomApps = 'custom-apps'` gates the create option and the Edit button in `CatalogView`. `HideCustomAppCreation = 'hide-custom-app-creation'` is a modifier flag for operators that want to allow editing existing apps while suppressing the creation entry point.

**Schema-less apps — no `type` on create**
Custom apps have no application-type schema ID. `CreateApplicationBodyDto.type` is optional; `CustomAppEditor` omits it on create. `application_type_schema_id` and `application_properties` are only sent to DIAL Core when non-empty.

**Edit button: `isCustomAppsEditable` param on `mapDeploymentToCatalogItem`**
A 6th param `isCustomAppsEditable` is added. `isEditable` uses OR logic: schema-ID match (Quick Apps) OR (`isCustomAppsEditable && !applicationTypeSchemaId && type === 'application'`) for schema-less custom apps. `CatalogView` passes `isCustomAppsEnabled` as this param.

**Edit routing — no-schema check**
`handleEdit` in `CatalogView` navigates to `CustomAppEditor` when `isCustomAppsEnabled && !deployment.applicationTypeSchemaId`, not by schema ID match.

**Load settings: `getCustomApplication` in `DeploymentsService`**
The DIAL Core model-listing endpoint (`getApplication`) does not expose `endpoint`. For `applications/{bucket}/{path}` IDs, `buildApplicationDetails` calls `getCustomApplication(bucket, path)` separately to get the full stored config. `endpoint` prefers the custom-app result; `features` from the custom-app result is merged into `applicationProperties` so the textarea is pre-populated. DIAL Core expands stored features with all defaults — this is unavoidable.

**Save settings: `UpdateApplicationBodyDto` extended**
`UpdateApplicationBodyDto` gains optional `version`, `endpoint`, `features`, `inputAttachmentTypes`, `maxInputAttachments` fields. `type` and `applicationProperties` remain excluded. `CustomAppEditor` parses the features textarea JSON before sending.

**Form fields**
- Chat completion URL: `<Input>` with URL validation (must be a valid absolute URL)
- Features data: `<Textarea>` with description and JSON placeholder
- Attachment types: `<TagInput>` (same pattern as Toolset's attachment types)
- Max attachments: `<Input type="number">` (same pattern as Toolset's max attachments)

## Risks / Trade-offs

- Duplicating the editor view adds a parallel file to maintain → mitigated by keeping it thin (only the settings form differs)
- Features textarea shows DIAL Core-expanded values (all defaults filled in), not just user-entered keys → unavoidable without a DIAL Core API change
- JSON validation for "Features data" is left to the user (no parse-time check in v1)

## Open Questions

- Should "Features data" validate JSON on blur? (deferred — not in v1 scope)
