## Context

Chat's application identifier appears in the four places listed in proposal.md. Normalization has to happen where identifiers enter the backend, so that every later comparison sees one value:

- the `appId` query parameter, in `AppConfigController`;
- `CLIENT_CONFIG_APP_IDS`, in the `ClientUiEnv` transform;
- the application side of `MANAGED_CONFIG_INSTANCES`, in the `ManagedConfigEnv` transform.

## Goals / Non-Goals

**Goals:** one canonical identifier inside the backend; unchanged behavior for every caller that sends `chat-ui`; renamed artifacts whose schema content is identical.

**Non-goals:** see proposal.md. In addition, no per-request deprecation log: Launchpad sends `chat-ui` on every fallback read, and a warning per request would only add noise.

## Decisions

1. **One identifiers module, owned by configuration.** `apps/chat-api/src/config/env/app-ids.ts` exports:
   - `CHAT_APP_ID = 'ai-dial-chat'`;
   - `LEGACY_CHAT_APP_ID = 'chat-ui'`;
   - `canonicalAppId(id)`, which returns `CHAT_APP_ID` for the legacy value and the input otherwise.

   It lives under `config/env` because the environment transforms need it, and `config` must not import `app-config`. `MANAGED_CONFIG_APP_ID` becomes an alias of `CHAT_APP_ID`, so existing imports keep their meaning. Alternative rejected: a second constant in `managed-config.constants.ts`, which would let the two identifiers drift apart.
2. **Normalize at the edges, then compare canonical values only.**
   - `CLIENT_CONFIG_APP_IDS` is parsed, mapped through `canonicalAppId`, and de-duplicated, so `chat-ui,ai-dial-chat` serves one identifier.
   - `MANAGED_CONFIG_INSTANCES` pairs have their application side mapped the same way, so `validateManagedRuntimeEnvironment` reports `chat-ui=a,ai-dial-chat=b` as "maps an application identifier twice".
   - The controller maps `query.appId` before it builds the `AppConfigEvalContext`.

   The cache key, the managed view, and the response `appId` therefore all use `ai-dial-chat`, and both spellings share one cache entry.
3. **Snapshots are not aliased.** A Config Studio instance's `appId` is checked exactly. A snapshot with `appId` `chat-ui` read for `ai-dial-chat` fails the existing identity check (`identity_mismatch`). Accepting it would mean accepting artifacts with the old `$id` and the old hashes, a second contract line for an identifier no release used.
4. **Artifacts are renamed, not re-versioned.**
   - The files become `ai-dial-chat-1.0.0.json` and `ai-dial-chat-1.1.0.json`. Their `appId`, `$id`, and root `description` change; their properties do not. `PINNED_MANAGED_CONFIG_SCHEMA_SHA256` gets the new canonical hashes.
   - The pin rule ("a pinned version is never rewritten") protects released contracts; these versions were never released. The change re-pins them once and states why.
   - The generator's file pattern is built from `MANAGED_CONFIG_APP_ID`, so a stray `chat-ui-*.json` is not read back.
   - Alternative rejected: keeping the `chat-ui-*` files beside the new ones, which would leave two artifacts per version and an index for only one of them.
5. **The frontend sends `ai-dial-chat`.** `apps/chat/src/server-api/app-config.api.ts` uses the canonical value. Frontend and backend ship in one image, and an older cached frontend still sends `chat-ui`, which the alias serves.

## Risks / Trade-offs

- [A deployment uploaded `chat-ui-1.x.json` to a Studio instance] → Only dev did, with the reader off. The instance is recreated with `appId` `ai-dial-chat`, and the release notes say so.
- [Operators keep writing `chat-ui` in Helm values] → The alias accepts it everywhere it was valid, and the docs name `ai-dial-chat` as canonical. Removing the alias later needs its own change and a release note.
- [Spec examples drift] → Every main-spec requirement that names the identifier is updated in this change; `chat-ui` remains only where it describes the alias.

## Migration Plan

1. Merge. Chat's `development` image serves both identifiers; nothing else changes for callers.
2. In Config Studio, create the instance (for dev: `ai-dial-chat`) with `appId` `ai-dial-chat` and upload `ai-dial-chat-1.1.0.json`.
3. Map it with `MANAGED_CONFIG_INSTANCES=ai-dial-chat=<instance>` (the legacy `chat-ui=<instance>` also works).
4. Launchpad, Models Garden, and Config Studio switch their `chat-ui` constants to `ai-dial-chat` whenever convenient.
