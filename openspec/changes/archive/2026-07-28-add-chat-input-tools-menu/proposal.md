## Why

Deployments on DIAL Core can expose boolean configuration properties (e.g. "Deep Research") that the user should be able to toggle before sending a message. Today these properties are only consumed through starter buttons with auto-submit semantics — there is no persistent, user-controlled toggle in the input area. Users need an explicit way to enable/disable deployment tools such as Deep Research and have that choice sent with every completion request.

## What Changes

- **New "Tools" submenu in the `+` menu** — a top-level menu item (Tool icon) that opens a side submenu listing available tool toggles. Initially limited to a single configured tool: Deep Research (Telescope icon).
- **Temporary `DEEP_RESEARCH_TOOL_ID` env/config value** — surfaces the tool id (`deep_research`) through the existing `app-config` pipeline so the frontend can identify the relevant deployment-configuration schema property without hard-coding.
- **Tool selection state in the app layer** — initialized from the deployment schema's `default` value, preserved per active input session, reset when the selected deployment changes.
- **Tool choices sent as `configuration_value`** — reuses the existing `custom_content.configuration_value` → `custom_fields.configuration` path so DIAL Core receives `{ "deep_research": true }` alongside other configuration values.
- **Tool choices persisted per user message** — optimistic frontend state and backend conversation history both retain `configuration_value` so regenerate and edit reuse the configuration of the affected message rather than an older fallback.
- **Host-agnostic tools contract in `libs/conversation-input`** — the lib receives resolved tool models and selection callbacks as props; it renders the UI but has no knowledge of deployment configuration schemas, app config, or env vars.

## Capabilities

### New Capabilities
- `chat-input-tools-menu`: Defines the tools submenu in the conversation input `+` menu — data contract, UI behavior (desktop dropdown submenu, mobile bottom sheet navigation), state lifecycle, and interaction with the completion request pipeline.

### Modified Capabilities
- `deployment-configuration`: The existing spec covers fetching and rendering starter options from the deployment configuration schema. This change adds extraction of boolean tool properties from the same schema, gated by a configured tool id. No changes to the backend endpoint or caching behavior — only the frontend consumption of `DeploymentConfigurationSchema.properties` is extended.

## Impact

- **Frontend libs** — `libs/conversation-input`: new `toolsMenuItems` prop on `AddAttachmentButton` / `InputProps`; new `ToolsSubmenu` / `ToolsBottomSheet` components inside the lib.
- **Frontend app** — `apps/chat`: new hook (`useToolsMenu`) in `apps/chat/src/hooks/conversation/` that reads `DeploymentsContext.selectedDeploymentConfiguration`, matches the configured tool id, derives the tool model array, and manages toggle state. Wires into `ConversationView` → `ConversationInput` → `AddAttachmentButton`.
- **Backend** — `apps/chat-api`: new `DEEP_RESEARCH_TOOL_ID` env var in `EnvironmentVariables`; new config definition in `CONFIG_DEFINITIONS` (visibility: `client`); preserve `configuration_value` when completion modes create a user message in conversation history. No new HTTP endpoint.
- **Shared types** — `libs/chat-shared`: new `ToolMenuItem` interface for the lib prop contract.
- **i18n** — new keys: `tools.menuTitle`, `tools.deepResearch` (fallback label if schema title is empty).
- **Existing behavior preserved** — starter buttons, form values, and existing `configuration_value` pass-through remain unchanged. The new tool choices are merged into `configuration_value` alongside existing values and stored with each user message.

### Closest existing files (investigation evidence)

- `libs/conversation-input/src/components/AddAttachmentButton/AddAttachmentButton.tsx:31` — `ExtraMenuItem` interface and menu rendering pattern (model for the tools submenu).
- `libs/conversation-input/src/models/Input.ts:286` — `ChatSettingsConfig` pattern for passing host-resolved feature config into the lib.
- `apps/chat/src/context/DeploymentsContext.tsx:353` — `selectedDeploymentConfiguration` loading via `getDeploymentConfiguration`.
- `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` — `CONFIG_DEFINITIONS` array where new client-visible config is registered.
- `apps/chat-api/src/conversations/conversation.service.ts:1413` — `configuration_value` → `custom_fields.configuration` mapping.
- `apps/chat/src/server-api/conversations.api.ts:15` — `createConversation` sends `custom_content.configuration_value`.
- `apps/chat/src/hooks/conversation/useConversationHandlers.ts:321` — `submitStarter` passes `configurationValue` to stream.

### Library isolation impact

`libs/conversation-input` remains host-agnostic. It receives:
- `toolsMenuItems: ToolMenuItem[]` — resolved array of `{ id, label, icon, isSelected }` objects.
- `onToolToggle: (toolId: string) => void` — callback to toggle selection state.

The lib has no knowledge of deployment schemas, env vars, config endpoints, or the `DEEP_RESEARCH_TOOL_ID` constant. All resolution happens in the app-level hook (`useToolsMenu`).

### Scope creep note

This change adds a new interface to `libs/chat-shared` (`ToolMenuItem`) and a new prop surface to `libs/conversation-input`. It does **not** touch global providers, routing, or authentication. The `DeploymentsContext` is consumed (read) by the new hook but not modified.

### i18n impact

Two new keys in `apps/chat/src/i18n/locales/en.json`:
- `tools.menuTitle` — "Tools" (top-level menu item label)
- `tools.deepResearchFallback` — "Deep research" (fallback when schema `title` is absent)

### Rollback / backward compatibility

Non-breaking. When `DEEP_RESEARCH_TOOL_ID` is unset (the default), the Tools menu item does not render — behavior is identical to today. Rollback: remove the env var. No database migration, no API contract changes, no breaking changes to existing DTOs.

### Alternatives considered

1. **Hard-code `deep_research` in frontend code** — simpler but inflexible; prevents operators from configuring a different tool id without a code change. Rejected: env-config approach is low-effort and follows the established `CONFIG_DEFINITIONS` pattern.
2. **Extend `ExtraMenuItem` for tools** — reuse the existing `extraMenuItems` prop on `AddAttachmentButton`. Rejected: tools need toggle state (selected/unselected) and a submenu pattern, which `ExtraMenuItem` (fire-and-forget `onClick`) does not support.
3. **New React Context for tools state** — would mirror `DeploymentsContext`. Rejected: the state is local to the input session and doesn't need global sharing; a hook + props is sufficient and avoids provider proliferation.
4. **Gate behind `ENABLED_FEATURES` role-based flag** — adds another env var and role matrix. Rejected for now: the presence/absence of `DEEP_RESEARCH_TOOL_ID` already gates visibility without requiring role logic; a feature flag can be layered later if role-scoped rollout is needed.
