## Context

Initial values for each deployment create form are set in three places:

| Kind                           | Source of create-mode metadata                                                                                    | Name today            | Version today |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------- | ------------- |
| Custom app                     | `DEFAULT_CUSTOM_APP_GENERAL_FORM` in `apps/chat/src/constants/custom-apps.ts`                                     | `''`                  | `'1.0.0'`     |
| Quick app / Schema app         | `SCHEMA_APP_EMPTY_METADATA` in `apps/chat/src/pages/ApplicationEditor/definitions/schemaDefinitionHelpers.ts`     | `''`                  | `''`          |
| Toolset                        | `getDefaultToolsetForm(existingNames)` in `libs/toolset-editor/src/utils/toolsets.ts`                             | "New toolset" (+ N)   | `'1.0.0'`     |
| Skill / Prompt                 | the lib editors' own empty values                                                                                 | `''`                  | no field      |

`ApplicationFormEditor` passes `definition.defaultMetadata` to `useMetadataForm` only in create mode. Edit mode builds its values through `deploymentToMetadata`. Changing `defaultMetadata` therefore affects create mode only.

`ToolsetApplicationEditor` calls `listToolsets()` before it renders the create form. It needs the existing names (resolved to the primary locale) so that `getStorageSafeUniqueToolsetName` can add a collision suffix. A name conflict at save time is handled independently of this: the BFF returns 409 ("Toolset name already taken") and `handlePersist` shows the upstream message through `showErrorNotification`.

Both BFF create paths already fall back to `1.0.0` when the request omits a version. The rule is `body.version ?? '1.0.0'` in `apps/chat-api/src/applications/applications.service.ts`, and `DEFAULT_TOOLSET_VERSION` in `apps/chat-api/src/toolsets/utils/toolset-mapper.util.ts` for toolsets.

## Goals / Non-Goals

**Goals:**
- Every create form that shows a Version field opens with `1.0.0`.
- Every create form opens with an empty Name.
- The frontend default version is defined once.

**Non-Goals:**
- BFF defaults.
- The edit-mode fallback for a deployment that has no `displayVersion`.
- Validation rules.
- Skill and Prompt forms.

## Decisions

### D1 — One shared `DEFAULT_DEPLOYMENT_VERSION` in `@epam/ai-dial-builder-form`

Add `export const DEFAULT_DEPLOYMENT_VERSION = '1.0.0'` next to `SEMVER_VERSION_PATTERN` in `libs/builder-form/src/utils/validate-deployment-creation-fields.ts`, and export it from the barrel. Every editor that renders `MetadataForm` (apps/chat and `toolset-editor`) already depends on builder-form, and builder-form owns the `version` field of `DeploymentCreationFormValues`.

- *Alternative:* an app-level constant in `apps/chat/src/constants/`. Rejected because `libs/toolset-editor` cannot import from the app, so the toolset lib would keep its own copy.
- *Isolation check:* the constant is a display default and carries no knowledge of REST, the BFF or DIAL Core. Hosts still decide whether to use it through `defaultMetadata`, and the lib does not apply it on its own.

### D2 — `DEFAULT_TOOLSET_VERSION` stays as an alias

In `libs/toolset-editor/src/constants/toolsets.ts`, `DEFAULT_TOOLSET_VERSION` becomes `= DEFAULT_DEPLOYMENT_VERSION`. `apps/chat/src/utils/toolsets.ts` keeps using it as the payload and edit fallback, so that file needs no change. The BFF keeps its own copy, because the backend does not depend on frontend libs.

### D3 — Toolset create opens with an empty Name; the unique-name machinery is removed

`getDefaultToolsetForm()` returns `name: ''` and loses its `existingNames` parameter. `DEFAULT_TOOLSET_NAME` and `getStorageSafeUniqueToolsetName` are removed from the lib and its barrel, because nothing else uses them. `ToolsetApplicationEditor` create mode then calls `setInitialForm(getDefaultToolsetForm())` synchronously and stops calling `listToolsets()`.

- *Alternative:* keep the helpers exported but unused (deprecated). Rejected: the lib is internal to this monorepo at version `0.0.1`, and the dead exports would keep their README and spec entries alive.
- *Effect:* toolset create mode needs one request fewer and shows no loading gap. `listToolsets` stays imported only if something else in the file uses it. Today nothing does, so the import is removed.
- Name-required validation already exists (`isToolsetFormValid` → `validateDeploymentCreationFields`). Under the existing "Validation and dirty-field error surfacing" requirement, Create stays disabled while the Name is empty, and the required error appears only once the field is touched. The form therefore does not open in an error state.

### D4 — Schema kinds and Custom app read the shared constant

`SCHEMA_APP_EMPTY_METADATA` is renamed to `SCHEMA_APP_DEFAULT_METADATA`, because it is no longer empty, and gets `version: DEFAULT_DEPLOYMENT_VERSION`. `DEFAULT_CUSTOM_APP_GENERAL_FORM.version` uses the same constant. For Quick apps (the `MetadataFirst` strategy), the first create request now sends `version: '1.0.0'` explicitly. That stores the same value as before, because the BFF would have defaulted it anyway.

## Risks / Trade-offs

- **[Risk]** Users used to the auto-filled toolset name now see an empty field. → **Mitigation:** the empty field matches every other create form, and the field placeholder and required error guide the user.
- **[Risk]** Without the client-side collision suffix, a user can type an existing toolset name. → **Mitigation:** the BFF returns 409, and `handlePersist` already shows that message and keeps the user in the editor. This is the same path a user hits today when renaming to an existing name.
- **[Risk]** A host outside this repo that calls `getDefaultToolsetForm(names)` or imports the removed exports breaks. → **Mitigation:** the repo has no other consumers (checked with grep). The change is marked BREAKING in the proposal and the README is updated.

## Migration Plan

This is a single frontend change with no data migration. Reverting the commit restores the previous defaults.

## Open Questions

- Should the edit-mode `displayVersion` fallback also be unified (Toolset `1.0.0` vs apps `''`)? It is out of scope here; I suggest a follow-up issue.
