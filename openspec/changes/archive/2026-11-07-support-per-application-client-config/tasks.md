<!--
Slicing strategy: vertical. One path (environment variable → validation → endpoint →
OpenAPI → docs), each step verifiable on its own. The default keeps today's behavior,
so every step is inert until a deployment sets CLIENT_CONFIG_APP_IDS. Backend-only:
no frontend, i18n, RTL or UI tasks.
-->

## 1. Characterization

- [x] 1.1 In `apps/chat-api/src/app-config/tests/app-config.controller.spec.ts`, pin today's behavior before any change: `appId=chat-ui` returns 200, `appId=unknown-app` returns 400, a missing `appId` returns 400, and a repeated `appId` returns 400.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.controller.spec.ts`

## 2. Served identifiers

- [x] 2.1 Declare `CLIENT_CONFIG_APP_IDS` on `ClientUiEnv` in `apps/chat-api/src/config/env/client-ui.env.ts`, reusing the comma-list transform. Entries are trimmed and de-duplicated, each must match `^[a-z0-9][a-z0-9-]{0,62}$`, the list holds at most 16 entries, and an absent or blank value defaults to `['chat-ui']`. Put the shared pattern constant `APP_ID_PATTERN` in `apps/chat-api/src/config/env/env-patterns.ts`, and add the name to the snapshot in `apps/chat-api/src/config/tests/environment-composition.spec.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/config/validation.spec.ts apps/chat-api/src/config/tests/environment-composition.spec.ts`
- [x] 2.2 Replace `@IsIn(['chat-ui'])` in `apps/chat-api/src/app-config/dto/get-client-config.dto.ts` with `@Matches(APP_ID_PATTERN)`, and update the Swagger description, pattern and example. In `AppConfigService.getClientConfig` (`apps/chat-api/src/app-config/app-config.service.ts`), reject an identifier that is not in `CLIENT_CONFIG_APP_IDS` with `BadRequestException` before the cache lookup. Leave `FeatureGuard` and `TextRefinementService` on `chat-ui`.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.controller.spec.ts apps/chat-api/src/app-config/tests/app-config.service.spec.ts apps/chat-api/src/app-config/tests/feature-flags/feature.guard.spec.ts`
- [x] 2.3 Add supertest cases to `apps/chat-api/src/app-config/tests/app-config.controller.spec.ts`:
  - a malformed identifier (`Chat_UI`, `-x`, 64 characters) is 400;
  - with the default list, `launchpad` is 400;
  - with `launchpad,chat-ui`, both identifiers return 200 with equal `features` and `config` and their own `appId`, while `models-garden` is 400;
  - the cache entries are separate per identifier;
  - the response keeps `Cache-Control: private, no-store`.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.controller.spec.ts`
- [x] 2.4 Run `npm run verify:changed`.

## 3. OpenAPI and generated client

- [x] 3.1 Run `npm run openapi` and `npm run openapi:check`, then build and lint `chat-api-client` (`npm exec nx build chat-api-client -- --skip-nx-cache`, `npm exec nx lint chat-api-client`). Confirm that `getClientConfig` still takes `{ appId: string }`, and that `apps/chat/src/server-api/app-config.api.ts` and its tests are unchanged.
  - Verification: `npm run test:file -- apps/chat/src/server-api/tests/app-config.api.spec.ts` and the client build above.

## 4. Documentation

- [x] 4.1 Document `CLIENT_CONFIG_APP_IDS` (format, default, transitional lists, the 400 on an unlisted identifier) in `apps/chat-api/README.md` and `apps/chat-api/.env.template`. Update `docs/managed-config-schema.md` (each served identifier maps to its own Config Studio instance; only `chat-ui` has Chat-owned typed fields).
  The `docs/centralized-app-config-design.md` §4 and §10 update (identifier served per deployment, the `appConfig` contract handed to the runtime reader) is deferred: that document is not tracked in this repository, and its final version will be written separately.
  - Verification: `npm run validate:docs`

## 5. Close

- [x] 5.1 Run `npm run validate:specs`, `npm run format:check`, `openspec validate support-per-application-client-config --strict`, and one `npm run verify:full`.
- [ ] 5.2 Follow-ups in other repositories, each separately authorized and out of scope here:
  - Launchpad sends `launchpad`;
  - Models Garden sends `models-garden`;
  - Config Studio sends `config-studio` and updates `docs/bff-compatibility.md`.

  Each of their deployments sets `CLIENT_CONFIG_APP_IDS=<id>,chat-ui` during the switch, using a BFF image that contains this change.
