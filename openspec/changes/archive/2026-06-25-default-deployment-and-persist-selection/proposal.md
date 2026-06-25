## Why

New users and users without a persisted selection land on whichever deployment happens to sort first, with no operator control over that default. Additionally, the selected deployment is currently saved in `localStorage` (`dial:selectedDeploymentId` in `DeploymentsContext.tsx`), which is not synced across devices or browsers and belongs outside the app's existing cross-device user-config store. Both gaps need to be closed before multi-device usage of the deployment selector is reliable.

## What Changes

- **New** backend environment variable `DEFAULT_DEPLOYMENT` validated in `EnvironmentVariables` and exposed as `config.defaultDeploymentId` through `GET /api/v1/client-config?appId=chat-ui`.
- **New** `deployments.selectedId: string | null` field in the user-config schema (bumping `CURRENT_CONFIG_VERSION` to 3) with backward-compatible migration.
- **New** endpoint `PATCH /api/v1/user-config/deployments/selected` to persist the user-selected deployment id.
- **Changed** `DeploymentsContext` initial-selection logic: removes `localStorage` as the source of truth; new precedence is in-memory → user-config `deployments.selectedId` → `config.defaultDeploymentId` → first sorted deployment → `null`.
- **Changed** `setSelectedItemId` in `DeploymentsContext` now calls the new user-config endpoint instead of `localStorage`.
- `restoreSelectedItemId` behavior preserved (updates visible selection without persisting a new preference).

## Capabilities

### New Capabilities

- `default-deployment-config`: Operator-controlled default deployment exposed via the existing client-config endpoint; covers env validation (`EnvironmentVariables`), a new `deployments.defaultDeploymentId` config-registry entry, the `ClientConfigResponseDto` shape update, and the generated-client impact.

### Modified Capabilities

- `user-config-deployment-management`: Extends the user-config schema (`UserConfigDto`, `migrateConfig`, `CURRENT_CONFIG_VERSION`) with `deployments.selectedId`; adds `PATCH /api/v1/user-config/deployments/selected` endpoint with `UpdateSelectedDeploymentDto`; updates `UserConfigService` and the generated API client.
- `deployments-context`: Replaces `localStorage`-based persistence with user-config persistence; introduces the new initial-selection precedence; connects `setSelectedItemId` to the new API call; defines when `restoreSelectedItemId` must not trigger a persist call.

## Impact

- **Backend** — `apps/chat-api/src/config/environment.config.ts`, `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`, `apps/chat-api/src/app-config/dto/client-config-response.dto.ts`, `apps/chat-api/src/user-config/dto/user-config.dto.ts`, `apps/chat-api/src/user-config/user-config.service.ts`, `apps/chat-api/src/user-config/user-config.controller.ts`.
- **Generated client** — `libs/chat-api-client` must be regenerated after the Swagger changes; new operationIds: `getClientConfig` (existing, updated DTO), `updateSelectedDeployment` (new).
- **Frontend** — `apps/chat/src/server-api/user-config.api.ts`, `apps/chat/src/server-api/app-config.api.ts`, `apps/chat/src/context/DeploymentsContext.tsx`, `apps/chat/src/context/UserConfigContext.tsx`, `apps/chat/src/context/AppConfigContext.tsx`.
- **Storage migration** — existing `localStorage` `dial:selectedDeploymentId` key can be removed; no migration of its value is required (user-config `selectedId` defaults to `null` and the fallback chain handles the first-run case gracefully).
- **i18n** — no new user-visible strings unless an error notification is introduced for the new PATCH endpoint failure path.
- **RTL / UI** — no new UI surface.
- **Tests** — backend: `npm exec nx test chat-api`; frontend: `npm exec nx test chat` (or the affected Nx target for `apps/chat`).
