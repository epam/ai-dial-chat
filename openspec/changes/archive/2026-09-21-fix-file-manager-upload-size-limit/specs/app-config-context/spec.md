## ADDED Requirements

### Requirement: AppConfigContext exposes maxAttachmentFileSizeBytes

`AppConfigContext` (`apps/chat/src/context/AppConfigContext.tsx`) SHALL surface the `maxAttachmentFileSizeBytes: number` field from the `GET /api/v1/client-config` response to client consumers.

Behaviour:

- The field SHALL live on `AppConfigState.config`, readable as `useAppConfig().config.maxAttachmentFileSizeBytes`.
- A module-level `DEFAULT_MAX_ATTACHMENT_FILE_SIZE_BYTES = 536_870_912` constant SHALL be used as the initial value (before the API call completes) and SHALL be preserved on a first-load failure, matching `AppConfigState`'s existing error-preservation semantics for other config fields.
- On success, the value SHALL be set from `response.config?.maxAttachmentFileSizeBytes ?? DEFAULT_MAX_ATTACHMENT_FILE_SIZE_BYTES`.
- Existing consumers of the frontend constant `MAX_SELECTABLE_FILE_SIZE_BYTES` (`apps/chat/src/constants/files.ts`) SHALL be migrated to read `useAppConfig().config.maxAttachmentFileSizeBytes` instead; the constant remains only as `DEFAULT_MAX_ATTACHMENT_FILE_SIZE_BYTES`'s value (or is removed in favor of the new constant — implementation's choice, but only one definition of "512 MB" SHALL remain as the source of truth for the frontend default).

**Feature flag:** none. **RTL impact:** none. **i18n impact:** none.

#### Scenario: maxAttachmentFileSizeBytes is exposed when config is ready

- **WHEN** `AppConfigProvider` has fetched a config with `maxAttachmentFileSizeBytes: 104857600`
- **THEN** `useAppConfig().config.maxAttachmentFileSizeBytes` returns `104857600`

#### Scenario: maxAttachmentFileSizeBytes defaults to 512 MB during loading and on error

- **WHEN** the config request is in flight, or has just rejected on first load
- **THEN** `useAppConfig().config.maxAttachmentFileSizeBytes` returns `536870912`

#### Scenario: A failed re-fetch preserves the last successfully loaded value

- **WHEN** a config re-fetch fails after an earlier successful load returned `maxAttachmentFileSizeBytes: 104857600`
- **THEN** `useAppConfig().config.maxAttachmentFileSizeBytes` still returns `104857600`, not the module default
