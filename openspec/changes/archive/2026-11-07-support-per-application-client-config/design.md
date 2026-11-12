## Context

See `proposal.md` for the motivation.

**Observed in this repository:**

- `GetClientConfigDto` has a single field, `appId`, validated by `@IsString()` and `@IsIn(['chat-ui'])`. OpenAPI shows it as a required string query parameter with example `chat-ui` and no enum, so the generated client's `appId: string` does not depend on the allowlist.
- `AppConfigController.getClientConfig` builds the evaluation context from `query.appId`. `AppConfigService.getClientConfig` resolves every client key without reading `appId`, except for the cache key and the echoed `appId`.
- `FeatureGuard` (`apps/chat-api/src/app-config/feature-flags/feature.guard.ts`) and `TextRefinementService` (`apps/chat-api/src/text-refinement/text-refinement.service.ts`) evaluate features with the literal `chat-ui`.
- The only frontend caller in this repository is `apps/chat/src/server-api/app-config.api.ts`, which sends `chat-ui`.

**Observed in sibling repositories (read-only references):**

- Launchpad and Models Garden each build `FROM ghcr.io/epam/ai-dial-chat-bff:development`, run their own container with their own environment, and call `GET /api/v1/client-config?appId=chat-ui`.
- Launchpad uses `announcements` and `customVariables.launchpad` and validates that block per entry. Models Garden uses `dialCoreExternalUrl`.
- Config Studio's own BFF deployment reads `customVariables.configStudio`.
- Config Studio restricts an instance's `appId` to `^[a-z0-9][a-z0-9-]{0,62}$`.

## Goals / Non-Goals

**Goals:** a trusted, per-deployment set of application identifiers, an unchanged response, and a fixed contract that the runtime reader (step 08) can build on.

**Non-Goals:** the reader, the `appConfig` field itself, mapping identifiers to Studio instances, and any change in another repository.

## Decisions

### D1 — Identifier format equals Config Studio's

The pattern is `^[a-z0-9][a-z0-9-]{0,62}$`: lowercase, 1–63 characters, no leading hyphen. Every Studio instance's `appId` is then a valid client-config identifier, and every served identifier can name a Studio instance. The pattern sits on the DTO with `@Matches`, so a malformed or repeated value is a `ValidationPipe` 400 before any resolution.

**Alternative considered:** a looser pattern that allows `_` or uppercase. Rejected, because a Studio instance could never carry such an identifier.

### D2 — The served list is deployment configuration, checked in the service

`CLIENT_CONFIG_APP_IDS` is declared on `ClientUiEnv`. It uses the existing comma-list transform, then trim, de-duplication and a `@Matches` on each entry. It is limited to 16 entries and defaults to `['chat-ui']`. A blank value also means the default, so an empty Helm value cannot lock every frontend out.

The check runs in `AppConfigService.getClientConfig` before the cache lookup and throws `BadRequestException('Unknown appId')`. Today's response for an unknown identifier is also 400. The DTO cannot read the deployment value without a DI-aware custom validator, and the controller stays thin.

**Alternatives considered:**

- An identifier from ENV only, with the query parameter optional: rejected, because it changes a documented required parameter and loses the explicit identifier in logs and caches.
- Format-only validation: rejected, because any page could then request another application's configuration from a deployment.

### D3 — The response does not depend on the served identifier yet

Until a managed source exists, every value comes from this deployment's environment, so every served identifier receives the same `features` and `config`. Only `appId` and the cache entry differ. Launchpad and Models Garden can therefore switch their constant without any response change.

**Alternative considered:** filtering fields per identifier. Rejected, because it needs per-application registries in the Chat BFF, which would then own foreign contracts.

### D4 — `appConfig` contract handed to step 08 (not implemented here)

- **`chat-ui`.** Managed values feed the existing typed fields under the `chat-ui` schema (the `managed-config-contract` capability). The response has no `appConfig`.
- **Other served identifiers.** When the deployment maps the identifier to a Config Studio instance, the response gains an optional `appConfig`:

  ```json
  "appConfig": {
    "schemaVersion": "1.0.0",
    "schemaSha256": "<hex>",
    "revisionId": "20261104T120000000Z-0123456789abcdef",
    "publishedAt": "2026-11-04T12:00:00.000Z",
    "payload": { "launchpad": { "version": 1, "applications": [] } }
  }
  ```

  Without a mapping, or before the first publication, the field is absent.
- **What the BFF checks.** It accepts a snapshot only when:
  - its `appId` equals the requested identifier;
  - its `instanceId` equals the mapped instance;
  - the payload is a JSON object of at most 57,344 canonical bytes;
  - a `revisionId` it has already seen keeps the same `sha256`.

  It does not validate the payload against the foreign schema, because it does not own that schema.
- **What the application does.** The payload is untrusted input for the application, which validates and sanitizes it against its own contract. Launchpad already does this per entry. Studio validated the payload at publication; the application's check is the reader-side validation.
- **Mapping.** The mapping from identifier to instance (for example `launchpad` → `launchpad-dev`), the polling, the last-known-good policy, and the staleness rules belong to step 08.

### D5 — Server-side gates stay on `chat-ui`

`FeatureGuard` and text refinement keep the literal `chat-ui`. Their endpoints are Chat BFF endpoints, and their managed feature policy is Chat's. A Launchpad deployment that calls a scheduled-task endpoint is governed by the Chat feature policy of that deployment, as it is today.

### D6 — Swagger

The `appId` description changes to "Application identifier served by this deployment", with `pattern` and example `chat-ui`. `npm run openapi` regenerates `libs/chat-api-client/openapi.json`. The method signature is unchanged, and the frontend wrapper is untouched.

## Risks / Trade-offs

- [A deployment lists only its new identifier while older frontend builds still send `chat-ui`] → Those builds get 400 and fall back to their defaults. Migration guidance requires listing both identifiers until the frontend switch has rolled out.
- [Images built on `:development` pick the change up immediately] → The default allowlist keeps today's behavior. Only setting the variable changes anything.
- [Config Studio reads its own settings through `chat-ui`] → Studio switches its constant and its deployment's list together, as a Studio follow-up. Until then its deployment keeps the default.
- [A foreign payload reaches the browser unvalidated by the BFF (step 08)] → It is bounded in size and identity-checked. Each application must validate its own contract, and this is documented as part of onboarding an `appId`.

## Migration Plan

1. Ship this change. All deployments keep the default.
2. For each frontend (Launchpad, Models Garden, Config Studio), in its own repository:
   - set its deployment to `CLIENT_CONFIG_APP_IDS=<new>,chat-ui`;
   - release a build that sends `<new>`;
   - drop `chat-ui` from the list.
3. Step 08 adds the instance mapping and `appConfig`.

Rollback is a revert. A deployment that removed `chat-ui` must add it back first.

## Open Questions

- The final identifiers of the other frontends (proposed: `launchpad`, `models-garden`, `config-studio`). These are each repository's decision and do not change this design.
