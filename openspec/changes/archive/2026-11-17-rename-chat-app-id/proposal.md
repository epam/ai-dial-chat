## Why

Chat identifies itself as `chat-ui` in `GET /api/v1/client-config`, in Config Studio, and in its managed schema artifacts. The other DIAL applications that adopted per-application configuration name themselves after their repositories: Launchpad uses `ai-dial-launchpad` for both its client-config `appId` and its Config Studio instance. Operators creating Config Studio instances want one naming rule, so Chat's identifier should be `ai-dial-chat`.

The rename is cheap only now. The managed schema artifacts and the `appId`-keyed managed reader (#9787, #9883) are on `development` but in no Chat release (`1.3.5` is cut from `release-1.3`). After a release, renaming the artifacts would be a breaking schema migration.

## What Changes

- **Problem.** `chat-ui` is hard-coded in `MANAGED_CONFIG_APP_ID` (`apps/chat-api/src/app-config/managed-config/managed-config.constants.ts`), in `DEFAULT_CLIENT_CONFIG_APP_IDS` (`apps/chat-api/src/config/env/client-ui.env.ts`), in `FeatureGuard` and `TextRefinementService`, in the frontend wrapper `apps/chat/src/server-api/app-config.api.ts`, and in the artifact files `apps/chat-api/managed-config-schema/chat-ui-<version>.json`.
- **Solution.**
  - `ai-dial-chat` becomes Chat's single application identifier: the client-config default, the identifier the Chat frontend sends, the server-side feature-evaluation identifier, and the managed-config `appId`.
  - `chat-ui` stays a deprecated alias. Wherever an application identifier is read (the `appId` query parameter, `CLIENT_CONFIG_APP_IDS`, and the application side of `MANAGED_CONFIG_INSTANCES`), `chat-ui` is treated as `ai-dial-chat` before any other check. The response's `appId` is `ai-dial-chat`.
  - Launchpad's fallback read, Models Garden, Config Studio's UI, and older Chat frontends keep working unchanged.
  - The artifacts are renamed to `ai-dial-chat-1.0.0.json` and `ai-dial-chat-1.1.0.json`, with `appId` `ai-dial-chat` and `$id` `urn:dial:ai-dial-chat:managed-config:<version>`. Their pinned hashes change; their schema content does not.
- **BREAKING** for a Config Studio instance whose `appId` is `chat-ui`: the reader rejects its snapshots with `identity_mismatch`. No release ever read such an instance, and the dev deployment runs with `MANAGED_CONFIG_MODE=off`. The instance is recreated with `appId` `ai-dial-chat`, and the renamed artifact is uploaded to it.
- **Non-goals.**
  - Removing the alias. That is a later breaking change, after every known caller sends `ai-dial-chat`.
  - Changing Launchpad, Models Garden, or Config Studio. They keep working through the alias and can move separately.
  - Renaming Chat packages, images, routes, or the `chat-ui` term where it names something other than the application identifier.
- **Alternatives.**
  - Keep `chat-ui` (the baseline). This is rejected because the naming rule would stay inconsistent forever once the artifacts ship.
  - Rename only the managed identifier and keep client-config at `chat-ui`. This is rejected because one application would carry two identifiers, and `MANAGED_CONFIG_INSTANCES` would need a second mapping between them.
  - Rename without an alias. This is rejected because it would break Launchpad's fallback, Models Garden, Config Studio, and cached Chat frontends during a rolling deploy.
- **Rollback.** Revert the change. Any instance created with `appId` `ai-dial-chat` would then be rejected, so set `MANAGED_CONFIG_MODE=off` first. Client-config callers are unaffected either way, because both identifiers are served before and after the change.
- **Closest model.** Launchpad's `ai-dial-launchpad` identifier, and the existing served-identifier handling in `AppConfigService.getClientConfig` (`apps/chat-api/src/app-config/app-config.service.ts`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `client-config-endpoint`: the default and canonical identifier is `ai-dial-chat`; adds the `chat-ui` alias rule.
- `managed-config-schema-artifact`: the artifact file names, `appId`, and `$id` use `ai-dial-chat`.
- `managed-config-runtime-reader`, `managed-config-activation`, `managed-config-contract`: Chat's managed identifier is `ai-dial-chat`.
- `config-registry-and-env-provider`, `feature-flags-service`, `app-config-context`: server-side evaluation and the frontend request use `ai-dial-chat`.
- `default-deployment-config`, `file-manager-tab-config`, `celebration-delivery-policy`, `chat-version-display`: example requests and responses use `ai-dial-chat`.

## Impact

- **Backend.**
  - New identifiers module: `apps/chat-api/src/config/env/app-ids.ts`.
  - Updated: `client-ui.env.ts`, `managed-config.env.ts`, `managed-config.constants.ts`, `app-config.controller.ts`, `feature.guard.ts`, `text-refinement.service.ts`, the artifact generator `apps/chat-api/src/managed-config-schema.ts`, and `snapshot-acceptance.ts`.
- **Artifacts.** The renamed files, `index.json`, and new pins.
- **Frontend.** `apps/chat/src/server-api/app-config.api.ts`.
- **OpenAPI.** Examples only. The generated client in `libs/chat-api-client` is regenerated; its operations and types are unchanged.
- **Docs.** `docs/managed-config-schema.md`, `apps/chat-api/README.md`, `apps/chat-api/.env.template`.
- **Acceptance criteria.**
  - `appId=ai-dial-chat` and `appId=chat-ui` both return 200 with `"appId":"ai-dial-chat"` and the same body.
  - `CLIENT_CONFIG_APP_IDS=launchpad,chat-ui` serves `launchpad` and `ai-dial-chat`.
  - Mapping both `chat-ui=` and `ai-dial-chat=` fails startup as a duplicate.
  - A `chat-ui` snapshot is rejected with `identity_mismatch`.
  - The artifacts carry `ai-dial-chat` and match their new pins.
  - `npm run verify:full` passes, along with the OpenAPI drift check and `validate:specs`.
