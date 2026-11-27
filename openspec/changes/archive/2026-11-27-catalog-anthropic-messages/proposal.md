## Why

Catalog model details omit Anthropic Messages even when DIAL Core advertises it, and Messages-only deployments consequently lose the Connect tab. Issue [#9949](https://github.com/epam/ai-dial-chat/issues/9949) also needs sufficient BFF metadata for a companion Models Garden change.

Deployment details explicitly project Core data and lose `interface_configs`; the separate model-catalog projection does the same. The Connect integration accepts only two OpenAI capability flags. This is a confirmed implementation gap, not confirmation of the reported model's production configuration.

## What Changes

- Normalize declared interfaces from Core `interface_configs`, using equivalent API declarations when available and conservative legacy OpenAI fallback when declaration metadata is unavailable.
- Add an optional `anthropicMessages` capability to deployment-detail features, including when Core sends no legacy features object. Each OpenAI capability remains independent: retain explicit legacy booleans and use only its own declared interface when its legacy flag is absent.
- Add optional `supportedInterfaces` to model-catalog entries, shared by list and cached detail responses. Keep raw interface defaults, headers, invocation settings and upstream addresses out of the projection.
- Extend the existing chat-hooks Connect builder with /anthropic/v1/messages and a safely quoted cURL example containing the selected deployment ID, `max_tokens`, messages, Content-Type, a DIAL Api-Key placeholder and anthropic-version.
- Thread capability and translated option labels through `useCatalogItemDetails`. A Messages-only endpoint list keeps Connect visible.
- Reuse catalog's arbitrary endpoint-list renderer unchanged; retain copy announcements, keyboard interaction, RTL and responsive presentation.
- Update backend Swagger sources, regenerate the API client, and add regression coverage and documentation.

## Alternatives considered

Keeping two APIs leaves the bug unresolved. Forwarding raw `interface_configs` exposes unnecessary defaults and headers; inferring support from an ID/provider is incorrect. Prefer a bounded normalized interface list and explicit capability mapping over either alternative.

## Non-goals

- Anthropic protocol dispatch for Chat conversations, streaming, tokenization or background generation.
- Models Garden frontend implementation or guessing its repository/companion issue URL.
- New endpoints, new feature flags, new global providers, dependency upgrades, MCP presentation changes or a general library relocation.

## Acceptance criteria

- Core-declared Messages support reaches deployment details and Connect without model-ID/provider heuristics.
- Mixed APIs and Messages-only detail payloads produce the correct independently gated entries; missing/malformed/unknown declarations preserve legacy behavior without inventing support.
- The Messages URL uses the host-supplied external Core base and the example is valid JSON and shell syntax, with the selected deployment ID and required fields/headers.
- Both model-catalog routes expose the same normalized supported-interface list and still exclude raw interface settings and hidden models.
- Swagger and generated SDK accurately represent the additive fields; generated files are never manually edited.
- Regression coverage proves metadata projection, capability mapping, endpoint selection/copying, legacy behavior and mobile/desktop/RTL parity. Relevant READMEs and API/catalog documentation are current.

## Capabilities

### New Capabilities

None; this extends existing capabilities.

### Modified Capabilities

- `deployment-details-api`: add declared-interface-derived Messages capability and defensive per-API detail mapping.
- `model-catalog`: expose normalized supported-interface metadata in list and cached detail responses while maintaining display-only projection.
- `catalog-connect-action`: support an independently gated Anthropic Messages endpoint/example and host-supplied API option labels.

## Impact

- Backend: `apps/chat-api/src/deployments/details/deployments-details.service.ts:350` and `apps/chat-api/src/models/catalog/model-catalog.service.ts:45` are the closest projection patterns; use the existing defensive deployment mapper and Swagger DTOs rather than forwarding Core objects.
- Integration: follow `libs/chat-hooks/src/catalog/deployment-endpoint-url.ts:48` and `libs/chat-hooks/src/catalog/useCatalogItemDetails.ts:177`. Extend the existing DIAL-aware, non-rendering integration helper; `apps/chat` still owns configuration/client setup and passes `dialCoreExternalUrl` and translated `DeploymentConnectLabels`. Only resolved `CatalogItemApiDetails` values reach `libs/catalog`.
- SDK: `libs/chat-api-client` changes only through repository OpenAPI generation. `apps/chat/src/server-api/deployments.ts` continues using the configured `deploymentsApi` singleton and normal generated methods. Models Garden consumes the generated `ModelsApi` independently; no unused `ModelsApi` singleton is added to Chat.
- Localization: add three catalog.details.api option keys and a `DeploymentConnectLabels` contract with English defaults; libs do not import i18n. Existing generic headings/copy labels remain unchanged.
- State: `useCatalogItemDetails` and `ApiDetails` retain their existing ownership; no new context, network request, persistence or telemetry event is needed.
- Documentation: `apps/chat-api/README.md`, `libs/chat-api-client/README.md`, `libs/chat-hooks/README.md`, `libs/catalog/README.md` and the model-catalog/API summary in `docs/architecture.md`.

## Compatibility and rollback

All wire fields and helper parameters are optional additions; endpoint paths, operation IDs, auth, caches and existing public helpers remain compatible. Unknown interface names are ignored by the current normalized known-interface contract, not interpreted as Messages. Rolling back the additions restores today's discovery behavior without changing Core configuration or conversation transport; clients must continue accepting absent metadata.

## Evidence and remaining limitations

The exploration confirmed Core's canonical `anthropicMessages` key, arbitrary endpoint-list rendering and DIAL Api-Key authentication at Core revision cb6a3e3a7b786239f713944af0a51c1712a49d42. The live anthropic.claude-opus-4-6-v1 payload and companion Models Garden repository remain unverified; neither blocks a declaration-driven implementation or establishes production availability.
