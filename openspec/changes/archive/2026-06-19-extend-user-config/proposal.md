## Why

The current `UserConfig` structure is a flat object with a single `pinnedConversationIds` array, stored at `.user-config.json`. As the product grows to support installable toolsets and deployments per user, the flat shape cannot accommodate new sections without collision, and the config file location (`root of bucket`) offers no clear namespace separation from user conversation files. This change restructures user configuration into a nested, versioned schema and moves the file to a dedicated client-data directory, adding toolset and deployment installation tracking alongside the existing pin capability.

In addition, the frontend currently has no initialization layer that loads user configuration at startup. Each feature that depends on user-config data (pinned conversations, installed toolsets, installed deployments) would have to fetch it independently, risking duplicate requests and race conditions with default-value rendering. This change adds a single frontend initialization point that loads user config once per authenticated session and hydrates the relevant features before they render.

## What Changes

- **BREAKING** Rename `pinnedConversationIds` → `conversations.pinnedIds` in the stored JSON schema (migration reads both shapes; `CURRENT_CONFIG_VERSION` bumps to `2`).
- **BREAKING** Move the config file from `.user-config.json` to `.client_data/.user-config.json` in the DIAL Core bucket (migration reads the old path on first access when the new path is missing).
- Add `toolsets.installed: string[]` — array of installed toolset IDs.
- Add `deployments.installed: string[]` — array of installed deployment IDs.
- Add `PATCH /api/v1/user-config/toolsets` — install / uninstall a toolset by ID (idempotent).
- Add `PATCH /api/v1/user-config/deployments` — install / uninstall a deployment by ID (idempotent).
- Update existing `PATCH /api/v1/user-config/pins` to read and write `conversations.pinnedIds`.
- Update `GET /api/v1/user-config` to return the new v2 shape.
- Update `UserConfigService.getPinnedIds()` and `migratePin()` to use `conversations.pinnedIds`.
- Update all DTOs, Swagger annotations, service tests, and controller integration tests.
- Regenerate `@epam/chat-api-client` to reflect new response/request shapes.
- Update frontend `apps/chat/src/server-api/user-config.api.ts` wrappers for the new client types.
- **NEW** Add `UserConfigContext` (`apps/chat/src/context/UserConfigContext.tsx`) — a new React Context provider that loads user config once per authenticated session, exposes `pinnedConversationIds`, `installedToolsetIds`, `installedDeploymentIds`, and mutation methods for keeping state synchronized with the backend.
- **NEW** Place `UserConfigProvider` inside `RequireAuth` in `apps/chat/src/main.tsx`, wrapping `AppConfigProvider` and `ConversationsProvider`, so those providers do not render until user config is loaded.
- **NEW** Render `<Spinner />` while user config is loading (matching the existing `RequireAuth` pattern), preventing dependent features from rendering with incorrect default values.
- **NEW** Route `ConversationsContext.pinConversation` through `UserConfigContext.setPinnedConversation` so both the conversation list `isPinned` flag and `pinnedConversationIds` state remain synchronized.
- **NEW** Expose `setInstalledToolset` and `setInstalledDeployment` mutation methods on `UserConfigContext` for future toolset / deployment UI to call.

**Non-goals:** No frontend UI for toolset / deployment installation is in scope (only the initialization and hydration layer). No rate limiting changes beyond the existing global default. No server-side caching of user config is introduced.

**Alternatives considered:** (a) Keeping the flat shape and adding top-level `installedToolsetIds` / `installedDeploymentIds` fields — rejected because it would re-create the same flat-field sprawl each time a new section is added; the nested shape makes adding future sections a non-breaking extension. (b) Versioning the endpoint to `/api/v2/user-config` instead of migrating in-place — rejected because the data migration is purely additive and backward-compatible at read time; a second controller version adds overhead with no benefit. (c) Loading user config inside `ConversationsContext` and `DeploymentsContext` independently — rejected because it would issue duplicate `GET /api/v1/user-config` requests and make it impossible to gate the application loading state on a single completion event. (d) Using a global loading overlay separate from the existing `<Spinner />` pattern — rejected because the existing `RequireAuth` spinner already establishes the user expectation for authenticated initialization loading; reusing `<Spinner />` in `UserConfigProvider` is consistent with that pattern.

**Rollback:** The migration function is additive and backward-compatible at read time. Rolling back the deployed binary writes v1-shaped data; the new code will re-migrate any v1 files on next read. No irreversible data transformation occurs. The frontend `UserConfigProvider` can be removed without affecting any library code (it only exists in `apps/chat`).

## Capabilities

### New Capabilities

- `user-config-toolset-management`: Install and uninstall toolsets per user via `PATCH /api/v1/user-config/toolsets`, persisted in `toolsets.installed`.
- `user-config-deployment-management`: Install and uninstall deployments per user via `PATCH /api/v1/user-config/deployments`, persisted in `deployments.installed`.
- `user-config-frontend-init`: Frontend initialization layer that loads `GET /api/v1/user-config` once per authenticated session, hydrates `pinnedConversationIds`, `installedToolsetIds`, and `installedDeploymentIds` into a React Context, and gates dependent features behind a loading state so they never render with stale defaults.

### Modified Capabilities

- `user-config-api`: Schema restructured from flat `pinnedConversationIds` to nested `conversations.pinnedIds`; file location changes to `.client_data/.user-config.json`; `GET /api/v1/user-config` response shape changes; migration logic updated; `PATCH /api/v1/user-config/pins` reads from the new nested field. Frontend server-api types regenerated from the new OpenAPI spec. Pin operations now route through `UserConfigContext.setPinnedConversation` in `ConversationsContext`.

## Impact

- `apps/chat-api/src/user-config/dto/user-config.dto.ts` — new nested DTO classes and updated `migrateConfig`
- `apps/chat-api/src/user-config/dto/update-pins.dto.ts` — no change to DTO shape, but service internals change
- `apps/chat-api/src/user-config/dto/update-installed.dto.ts` — new DTO for toolset/deployment install/uninstall
- `apps/chat-api/src/user-config/user-config.service.ts` — updated reads/writes, new install/uninstall methods
- `apps/chat-api/src/user-config/user-config.controller.ts` — two new PATCH endpoints
- `apps/chat-api/src/user-config/tests/` — all existing tests updated; new tests for toolset/deployment operations
- `libs/chat-api-client/openapi.json` — regenerated
- `apps/chat/src/server-api/user-config.api.ts` — updated for new client types
- `openspec/specs/user-config-api/spec.md` — delta for schema, file path, and endpoint changes
- `apps/chat/src/context/UserConfigContext.tsx` — new file; `UserConfigProvider` + `useUserConfig()` hook
- `apps/chat/src/types/user-config-status.ts` — new file; `UserConfigStatus` enum
- `apps/chat/src/context/ConversationsContext.tsx` — pin operations route through `UserConfigContext.setPinnedConversation`
- `apps/chat/src/main.tsx` — `UserConfigProvider` inserted inside `RequireAuth`, wrapping `AppConfigProvider` and `ConversationsProvider`
- `apps/chat/src/constants/translation-keys.ts` — new `UserConfigI18nKeys` enum with `LoadError` key
- `apps/chat/src/i18n/locales/en.json` — new `userConfig.loadError` string
- `apps/chat/src/context/tests/UserConfigContext.spec.tsx` — new unit test file
