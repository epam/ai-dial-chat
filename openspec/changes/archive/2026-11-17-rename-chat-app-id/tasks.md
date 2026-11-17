Slicing: contract-first. The identifier module and the environment normalization come first, then the request path, then the artifacts, the frontend, and the docs. Each slice has its own focused tests.

## 1. Identifier and environment normalization

- [x] 1.1 Add `apps/chat-api/src/config/env/app-ids.ts` with `CHAT_APP_ID`, `LEGACY_CHAT_APP_ID`, and `canonicalAppId`. Make `DEFAULT_CLIENT_CONFIG_APP_IDS` (`client-ui.env.ts`) `[CHAT_APP_ID]`, and map `CLIENT_CONFIG_APP_IDS` entries through `canonicalAppId` before de-duplication. Verify with environment tests for `launchpad,chat-ui` and `chat-ui,ai-dial-chat`.
- [x] 1.2 Map the application side of each `MANAGED_CONFIG_INSTANCES` pair through `canonicalAppId` in `apps/chat-api/src/config/env/managed-config.env.ts`. Verify that `chat-ui=a,ai-dial-chat=b` fails with the duplicate-mapping message, and that `chat-ui=x` maps `ai-dial-chat`.

## 2. Request path and server-side evaluation

- [x] 2.1 Normalize `query.appId` in `apps/chat-api/src/app-config/app-config.controller.ts`. Verify with controller tests that `appId=chat-ui` and `appId=ai-dial-chat` both return `"appId":"ai-dial-chat"` and the same body.
- [x] 2.2 Set `MANAGED_CONFIG_APP_ID` to `CHAT_APP_ID` (`managed-config.constants.ts`). Use `CHAT_APP_ID` in `apps/chat-api/src/app-config/feature-flags/feature.guard.ts` and `apps/chat-api/src/text-refinement/text-refinement.service.ts`. Verify with the feature-guard and text-refinement tests.
- [x] 2.3 Add a reader test showing that a snapshot with `appId` `chat-ui` is rejected with `identity_mismatch` (`apps/chat-api/src/app-config/tests/managed-runtime/snapshot-acceptance.spec.ts`).

## 3. Schema artifacts

- [x] 3.1 Rename `apps/chat-api/managed-config-schema/chat-ui-1.0.0.json` and `chat-ui-1.1.0.json` to `ai-dial-chat-*.json`, replacing `appId`, `$id`, and the root description only. Build the generator's file pattern from `MANAGED_CONFIG_APP_ID` (`apps/chat-api/src/managed-config-schema.ts`). Update the imports in `snapshot-acceptance.ts`.
- [x] 3.2 Re-pin both versions in `PINNED_MANAGED_CONFIG_SCHEMA_SHA256`, run `npm run managed-config-schema`, and verify that `index.json` and the artifact tests agree. Confirm that the `properties` of each version are byte-identical to the former files.

## 4. Frontend, OpenAPI, and tests

- [x] 4.1 Send `ai-dial-chat` from `apps/chat/src/server-api/app-config.api.ts`. Verify with `apps/chat/src/server-api/tests/app-config.api.spec.ts` and the `AppConfigContext` tests.
- [x] 4.2 Change the DTO examples (`get-client-config.dto.ts`, `client-config-response.dto.ts`) to `ai-dial-chat`, run `npm run openapi`, and verify `npm run openapi:check`.
- [x] 4.3 Replace the identifier in the remaining chat-api and chat tests and fixtures; keep `chat-ui` only in the alias tests. Verify with `npm exec nx test chat-api` and `npm exec nx test chat`.

## 5. Documentation and gate

- [x] 5.1 Update `docs/managed-config-schema.md`, `apps/chat-api/README.md`, and `apps/chat-api/.env.template`: `ai-dial-chat` is canonical, `chat-ui` is a deprecated alias, and the migration note for a Studio instance created with `appId` `chat-ui`. Verify with `npm run validate:docs`.
- [x] 5.2 Run `npm run verify:full`, `npm run validate:specs`, and `npm run validate:agent-docs`; record any pre-existing failure separately.
- [x] 5.3 Follow-ups, outside this change: Launchpad's `FALLBACK_CLIENT_CONFIG_APP_ID`, Models Garden's `CLIENT_CONFIG_APP_ID`, and Config Studio's `BFF_APP_ID` move to `ai-dial-chat`; removing the alias is a later breaking change.
