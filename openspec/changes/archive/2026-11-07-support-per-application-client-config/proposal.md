## Why

Chat, Launchpad, Models Garden and Config Studio each package the published Chat BFF image in their own deployment. Each of them reads `GET /api/v1/client-config`, which accepts only `appId=chat-ui`. As a result, every frontend claims to be Chat, and the BFF cannot tell which application a configuration request belongs to. Managed configuration (the `export-managed-app-config-schema` change and the later runtime reader) needs that distinction. A Config Studio instance belongs to exactly one `appId`, so a Launchpad deployment must be able to ask for Launchpad's configuration and not Chat's.

## Problem

- `GetClientConfigDto` (`apps/chat-api/src/app-config/dto/get-client-config.dto.ts`) uses `@IsIn(['chat-ui'])`, so any other identifier is 400. Launchpad (`ai-dial-launchpad`, `docs/deployment.md`) and Models Garden (`ai-dial-models-garden`, `src/api/client-config-api.ts`) therefore send `chat-ui`.
- The managed `chat-ui` schema describes Chat's keys. A Launchpad deployment pointed at a `chat-ui` instance would show operators Chat-only settings, and still could not manage Launchpad's own block. That block (`customVariables.launchpad`) is opaque to Chat.
- No deployment setting states which applications a BFF deployment serves, so a browser-supplied identifier cannot be checked against anything trusted.

## What Changes

- **appId format.** `appId` becomes a string matching `^[a-z0-9][a-z0-9-]{0,62}$`, the identifier pattern Config Studio already enforces for an instance's `appId`. An identifier outside the pattern is 400.
- **Deployment allowlist.** A new environment variable, `CLIENT_CONFIG_APP_IDS`, lists the application identifiers a BFF deployment serves. It is comma-separated, and each entry must match the pattern or startup fails. The default is `chat-ui`, so no deployment changes behavior until it sets the variable. A well-formed identifier that is not listed is 400, as an unknown `appId` is today.
- **Each frontend sends its own constant.** Chat keeps `chat-ui`. Launchpad, Models Garden and Config Studio change their own constants in their own repositories (follow-ups, not part of this change), and each of their deployments sets `CLIENT_CONFIG_APP_IDS` to match.
- **Response unchanged for every served appId.** The existing Chat-shaped fields stay ENV-driven and identical, so the response does not depend on which listed `appId` was requested. `appId` is echoed, as today. The cache key already contains `appId`. No field is removed or added in this change.
- **Contract for the runtime reader (step 08), defined but not implemented here.**
  - For `chat-ui`, managed values continue to feed the typed fields under the `chat-ui` schema.
  - For any other served `appId`, the reader returns the published payload unchanged in a new optional `appConfig` field. The BFF checks identity, the schema hash recorded in the snapshot, and the size, but not the foreign schema. The application validates its own contract; Launchpad already validates its block per entry.
  - The mapping from `appId` to a Config Studio instance is deployment configuration owned by step 08.
- **Server-side feature evaluation stays on the Chat contract.** `FeatureGuard` and text refinement keep evaluating with `chat-ui`. Feature gates protect Chat BFF endpoints, so they follow Chat's policy whichever frontend the deployment serves.
- **Swagger and generated client.** The `appId` parameter gains its pattern and an updated description. The generated client signature (`appId: string`) does not change.

## Non-goals

- No managed reader, no `appConfig` field in the DTO yet, and no instance mapping (step 08).
- No per-application registry or typed fields for foreign applications inside the Chat BFF. Their contracts stay in their own repositories.
- No edit to Launchpad, Models Garden, Config Studio or the BFF image release. Their switch to their own `appId` is listed as follow-up work.
- No change to authentication, CSRF, caching TTL, or the response fields.

## Alternatives considered

| Option | Trust | Compatibility | Decision |
| --- | --- | --- | --- |
| Keep `chat-ui` for every frontend (baseline) | No application identity at all | None needed | Rejected: managed configuration cannot be per-application |
| Query `appId` checked against the format and a deployment allowlist | A browser can choose only among identifiers the deployment serves | Default `chat-ui`; transitional lists such as `launchpad,chat-ui` | **Selected (2026-11-06)** |
| Query `appId` checked only against the format | Any page can request another application's configuration | Simplest | Rejected: no trusted boundary |
| Identifier only from deployment ENV, query ignored or optional | Strong, one application per deployment | Breaks the documented required parameter | Rejected: the explicit request parameter stays useful for logs and caches |
| Per-application typed fields in the Chat BFF | Strong | Chat would own Launchpad and Models Garden contracts | Rejected: contradicts application-owned contracts |

## Acceptance criteria

- With `CLIENT_CONFIG_APP_IDS` unset:
  - `appId=chat-ui` returns the same 200 body as before;
  - `appId=unknown-app` and `appId=launchpad` are 400;
  - a missing `appId` is 400.
- With `CLIENT_CONFIG_APP_IDS=launchpad,chat-ui`, both identifiers return 200, with identical `features` and `config` and their own `appId` echoed, and `models-garden` is 400.
- `appId=Chat_UI`, `appId=-x`, a 64-character identifier, and repeated `appId` parameters are 400 with a validation message.
- `CLIENT_CONFIG_APP_IDS=chat-ui,Bad_Id` fails startup validation, naming the variable but not echoing other environment values. An empty value falls back to `chat-ui`.
- Cache entries for different `appId` values stay separate. `FeatureGuard` and text refinement still evaluate with `chat-ui`.
- `libs/chat-api-client/openapi.json` shows the pattern on `appId`. `npm run openapi:check` and the chat-api-client build pass. The frontend wrapper still sends `chat-ui`.
- `npm run validate:specs`, `npm run validate:docs` and `openspec validate support-per-application-client-config --strict` pass, and one `npm run verify:full` passes.

## Rollback / backward compatibility

Nothing is breaking. The default allowlist keeps today's single accepted value, and the response is unchanged. To roll back, revert the change. A deployment that set `CLIENT_CONFIG_APP_IDS` without `chat-ui` must add `chat-ui` back before older frontends, which still send `chat-ui`, can read configuration again. Migration guidance recommends listing both identifiers during a frontend switch.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `client-config-endpoint`: `appId` is validated by format and against the deployment's served list (`CLIENT_CONFIG_APP_IDS`) instead of a fixed `chat-ui` allowlist. The future `appConfig` contract for other applications is recorded in `design.md` and becomes a requirement with the runtime reader (step 08).

`chat-api-environment-config` is not modified: the new variable follows its existing structure rules (declared on `ClientUiEnv`, added to the composition snapshot test).

## Impact

- **Code.** `apps/chat-api/src/app-config/dto/get-client-config.dto.ts`, `apps/chat-api/src/app-config/app-config.controller.ts` or `app-config.service.ts` (allowlist check), `apps/chat-api/src/config/env/client-ui.env.ts` (new variable), and tests.
- **API.** The `appId` query parameter in OpenAPI gains a pattern, and `libs/chat-api-client/openapi.json` is regenerated. Method signatures are unchanged, and the frontend wrapper `apps/chat/src/server-api/app-config.api.ts` is untouched.
- **Docs.** `apps/chat-api/README.md` and `apps/chat-api/.env.template` (new variable), and `docs/managed-config-schema.md` (the relationship between `appId` and Config Studio instances). The `docs/centralized-app-config-design.md` §4 and §10 update is deferred to that document's separate final version, because it is not tracked in this repository.
- **Dependent repositories (follow-ups, separately authorized).** Launchpad sends `launchpad`, Models Garden sends `models-garden`, and Config Studio sends `config-studio`; Studio's `docs/bff-compatibility.md` states `appId must be chat-ui`. Each of their deployments sets `CLIENT_CONFIG_APP_IDS`. They need a BFF image that contains this change.
- **No impact** on `libs/*`, the frontend UI, i18n, RTL, feature gating, or telemetry.
