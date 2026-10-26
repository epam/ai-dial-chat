## ADDED Requirements

### Requirement: Saved OAuth client secret hint in edit mode

When the editor is opened to edit an already-saved toolset (`isEditMode`) with OAuth "Custom login" (`with-config`) selected, and the loaded toolset carries `authSettings.clientSecretHint`, the Client secret input SHALL stay empty and SHALL show the hint masked as six asterisks followed by the hint (e.g. `******d4c6`) as its placeholder, with the caption `Leave empty to keep the saved secret.` as the input's accessible description. The masked value SHALL be shown only while the user has typed no new secret; as soon as the field has a value, the regular placeholder and no "keep" caption apply. The hint SHALL NOT be shown in create mode, on the "Standard login" mode, or for API-key toolsets.

Saving or logging in with the field left empty SHALL send no `clientSecret` (unchanged from the existing `isEditMode` rule of "OAuth credential fields"), so DIAL Core keeps the stored secret. The hint SHALL never be sent as, or in place of, the client secret.

The host maps the hint from `DialToolsetDto.authSettings.clientSecretHint` into `ToolsetAuthFormData.clientSecretHint` in `authSettingsDtoToForm` (`apps/chat/src/utils/toolsets.ts`); `formToToolsetBody` builds `clientSecret` only from `ToolsetAuthFormData.clientSecret`. The caption is localised through the new i18n key `toolsetEditor.auth.clientSecretKeepCaption` (`ToolsetEditorI18nKeys.ClientSecretKeepCaption`), passed by `ToolsetApplicationEditor` as `labels.settings.auth.clientSecretKeepCaption`; the masked placeholder carries no translatable text. RTL impact: none — the masked value is direction-neutral and no directional icon is added. Not gated behind `ENABLED_FEATURES`.

#### Scenario: Editing a toolset with a saved secret shows the masked hint

- **GIVEN** a saved OAuth "Custom login" toolset whose `GET /api/v1/toolsets/{toolsetName}` response has `authSettings.clientSecretHint: "d4c6"`
- **WHEN** the user opens it in the toolset editor
- **THEN** the Client secret input is empty, its placeholder is `******d4c6`, and it is described by `Leave empty to keep the saved secret.`

#### Scenario: Leaving the field empty keeps the stored secret

- **GIVEN** the editor shows the masked hint
- **WHEN** the user saves without typing a client secret
- **THEN** the `PATCH /api/v1/toolsets/{toolsetName}` body has no `authSettings.clientSecret` and no `clientSecretHint`

#### Scenario: Typing a new secret replaces the hint display

- **GIVEN** the editor shows the masked hint
- **WHEN** the user types a new client secret
- **THEN** the hint placeholder and the "keep" caption are no longer shown, and saving sends the typed value as `clientSecret`

#### Scenario: No hint available

- **GIVEN** the loaded toolset has no `authSettings.clientSecretHint`
- **WHEN** the user opens it in the editor
- **THEN** the Client secret input renders with the regular `Enter client secret` placeholder and no "keep" caption, exactly as before
