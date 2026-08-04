## Why

The catalog currently supports Quick Apps and Toolsets as creation types. Custom Apps (`custom_app` schema) need first-class creation support so users can build applications that specify their own chat completion URL, attachment handling, and feature endpoints — capabilities not covered by Quick Apps.

## What Changes

- Add `custom_app` schema type as a new option in the catalog Create button
- Gate the new option behind a feature flag (`OverlayFeature.CustomApps`)
- Reuse the ToolsetEditor page flow (header + view components) for the custom app editor
- Replace the ToolsetEditor's `SettingsForm` with a `CustomAppSettingsForm` containing four fields: Chat completion URL, Features data (JSON textarea), Attachment types (tag input), Max attachments number

## Capabilities

### New Capabilities

- `custom-app-editor`: Create/edit flow for the `custom_app` schema, reusing ToolsetEditor layout with a custom settings form

### Modified Capabilities

- `catalog-create-options`: Adds a new "Create Custom App" entry to `CatalogView` create options

## Impact

- `apps/chat/src/components/CatalogView/CatalogView.tsx` — new feature flag check + create option
- `apps/chat/src/pages/ToolsetEditor/` — new `CustomAppEditor` page + `CustomAppSettingsForm` component
- `libs/chat-shared/src/types/overlay/overlay-protocol.ts` — new `OverlayFeature.CustomApps` enum value
- `apps/chat/src/i18n/locales/en.json` + `translation-keys.ts` — new i18n keys
