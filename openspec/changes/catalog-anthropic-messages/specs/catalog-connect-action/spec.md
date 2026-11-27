## MODIFIED Requirements

### Requirement: `apps/chat` supplies Connect API data for toolsets and MCP-capable applications

`onFetchDetails` of `useCatalogItemDetails` (`libs/chat-hooks/src/catalog/useCatalogItemDetails.ts`) SHALL resolve the item's MCP resource kind with `resolveMcpResourceKind(item.type, item.supportsMcp)` and, when it is not `null`, override the fetched `api` field with `buildConnectApi(dialCoreExternalUrl ?? '', item.id, kind)`. The kind is:
- `McpResourceKind.Toolset` when the item's `type` is `CatalogEntityType.Toolset`,
- `McpResourceKind.Application` when the item's `type` is `CatalogEntityType.Agent` AND its `supportsMcp` field is `true`,
- `null` otherwise.

`apps/chat` supplies the inputs: `useCatalogItems` (`apps/chat/src/hooks/useCatalogItems/useCatalogItems.ts`) passes `dialCoreExternalUrl` and memoized host-translated `deploymentConnectLabels` into `useCatalogItemDetails`, and `CatalogView` only forwards the resulting `onFetchDetails` to `Catalog`; it has no `handleFetchDetails` of its own.

The kind selects the URL shape: toolsets get `/v1/toolset/{id}/mcp`, MCP-capable applications get `/v1/deployments/{id}/mcp`. The two are not interchangeable — building an application's endpoint from the toolset shape yields a URL DIAL Core does not serve.

For every other item whose resolved entity type is `MODEL` or `AGENT`, `onFetchDetails` SHALL additionally call `buildDeploymentConnectApi(dialCoreExternalUrl ?? '', item.id, { hasChatCompletion, hasResponsesApi, hasAnthropicMessages }, deploymentConnectLabels)` (see the requirement below) using that item's mapped `capabilities.hasChatCompletion`/`capabilities.hasResponsesApi`/`capabilities.hasAnthropicMessages`, and use the result in place of `mapEntityDetailsToCatalogDetails`'s `api` whenever it is non-`undefined` (i.e. whenever at least one of the three flags is `true`). This makes Models and non-MCP Applications that support Chat Completions, Responses and/or Anthropic Messages satisfy the Connect tab's gate via `endpoints`, even though they carry no `resource.endpointUrl`.

A toolset never falls back to the mapped `api`: `resolveMcpResourceKind` always returns `McpResourceKind.Toolset` for it, so the `buildConnectApi` override always applies. Only a `MODEL`/`AGENT` item with no MCP kind where none of the three generation-API flags is `true` keeps `api` as returned by `mapEntityDetailsToCatalogDetails` (backend-provided endpoint/snippet data for Agents in general, `{ modelId }` for Models with no generation-API flag set).

Unlike a UI-triggered popover, this override is unconditional: it runs regardless of whether the DIAL Core external URL is configured. When `dialCoreExternalUrl` is not configured, `buildConnectApi` is called with an empty base URL and the endpoint renders as a base-relative path (no absolute host).

`buildConnectApi` SHALL return a `CatalogItemApiDetails` with:
- `resource.endpointUrl` set to the URL built by the kind's builder (`buildToolsetMcpUrl` for `Toolset`, `buildApplicationMcpUrl` for `Application`).
- `snippets` containing a single `CodeLanguage.Curl` entry that POSTs a `tools/list` JSON-RPC request to that URL with an `Api-Key` placeholder header.

**Feature flag:** Not gated.

**RTL impact:** Data-only mapping; retain the generic renderer's logical layout. **i18n impact:** Host-translated generation-API option labels are passed through; code sample syntax is not localized.

#### Scenario: Toolset gets a Connect endpoint regardless of type-specific backend data

- **WHEN** an item has `type: CatalogEntityType.Toolset`
- **THEN** `onFetchDetails` sets `api` to `buildConnectApi(dialCoreExternalUrl ?? '', item.id, McpResourceKind.Toolset)`, replacing whatever `api` the backend-mapped details produced, and the endpoint URL uses the `/v1/toolset/` shape

#### Scenario: MCP-capable application gets a deployments Connect endpoint

- **WHEN** an item has `type: CatalogEntityType.Agent` and `supportsMcp: true`
- **THEN** `onFetchDetails` sets `api` to `buildConnectApi(dialCoreExternalUrl ?? '', item.id, McpResourceKind.Application)`, and the endpoint URL uses the `/v1/deployments/` shape rather than the toolset one

#### Scenario: Non-MCP application with no generation-API support keeps its backend-provided api data

- **WHEN** an item has `type: CatalogEntityType.Agent`, `supportsMcp: false` (or `undefined`), and its mapped `capabilities.hasChatCompletion`/`hasResponsesApi`/`hasAnthropicMessages` are all falsy
- **THEN** `onFetchDetails` leaves `api` as returned by `mapEntityDetailsToCatalogDetails`

#### Scenario: Non-MCP model or application with Chat Completions support gets a generation-API Connect endpoint

- **WHEN** an item has `type: CatalogEntityType.Model` (or `type: CatalogEntityType.Agent` with `supportsMcp: false`), and its mapped `capabilities.hasChatCompletion` is `true`
- **THEN** `onFetchDetails` sets `api` to `buildDeploymentConnectApi(dialCoreExternalUrl ?? '', item.id, { hasChatCompletion: true, hasResponsesApi })`, whose `endpoints` includes a `Chat Completions` entry built from `buildChatCompletionsUrl`

#### Scenario: Model or application with Responses API support gets a generation-API Connect endpoint

- **WHEN** an item's mapped `capabilities.hasResponsesApi` is `true`
- **THEN** the resulting `api.endpoints` includes a `Responses` entry built from `buildResponsesUrl`, in addition to any `Chat Completions` entry

#### Scenario: Connect endpoint is still built when the external URL is not configured

- **WHEN** `config.dialCoreExternalUrl` is `null` and an item has `type: CatalogEntityType.Toolset`
- **THEN** `onFetchDetails` still sets `api` via `buildConnectApi('', item.id, McpResourceKind.Toolset)`, producing a base-relative endpoint URL rather than omitting the Connect tab

#### Scenario: Copying the endpoint URL

- **WHEN** the user clicks the copy action on the Connect tab's endpoint code block for a toolset item with id `toolsets/public/search-tool`
- **THEN** the clipboard receives `{dialCoreExternalUrl}/v1/toolset/toolsets/public/search-tool/mcp` (per the URL-helper requirement's encoding rules), or the base-relative equivalent when the external URL is not configured

#### Scenario: Messages-only model details retain Connect data

- **WHEN** a model detail payload has `features.anthropicMessages`: true and no positive OpenAI capability
- **THEN** its fetched API data contains a Messages endpoint and snippet rather than a resource identifier alone

#### Scenario: Missing capability object remains legacy-compatible

- **WHEN** a legacy detail payload has no API capabilities or no features object
- **THEN** the details fetch succeeds and uses the existing backend API fallback without inventing a Messages entry

### Requirement: Generation-API (Chat Completions / Responses) endpoint URL helper

`libs/chat-hooks/src/catalog/deployment-endpoint-url.ts` SHALL provide a URL-building utility, separate from the MCP endpoint helper above, for the OpenAI-compatible and Anthropic Messages generation endpoints DIAL Core exposes uniformly for models and applications. It is kept as its own module because the two share only the trailing-slash and segment-encoding primitives, not the URL shapes or the support flags that gate them. The utility SHALL:

- Expose `buildChatCompletionsUrl(baseUrl, id)` returning `` `${trimmedBaseUrl}/openai/deployments/${encodedId}/chat/completions` ``, where `encodedId` is built by the same decode-then-encode-per-segment rule as the MCP helper (each `/`-separated segment is defensively decoded, then re-encoded with `encodeURIComponent`, preserving `/` as a structural separator and avoiding double-encoding an already-percent-encoded segment).
- Expose `buildResponsesUrl(baseUrl)` returning `` `${trimmedBaseUrl}/openai/v1/responses` `` — this endpoint is not deployment-scoped in its path; the target deployment id is instead carried in the `model` field of the JSON request body.
- Expose `buildAnthropicMessagesUrl(baseUrl)` returning the supplied base plus `/anthropic/v1/messages`, with the existing trailing-slash normalization and no deployment ID or OpenAI api-version query parameter.
- Expose `buildDeploymentConnectApi(baseUrl, id, { hasChatCompletion, hasResponsesApi, hasAnthropicMessages }, labels?)` returning a `CatalogItemApiDetails` whose `resource.modelId` is the display form of `id` — decoded per `/`-separated segment (`decodeDeploymentPathForDisplay`), so `applications/public/qa%202.0` reads `applications/public/qa 2.0` — and whose `endpoints` array contains, in order:
  - a `Chat Completions` entry (`buildChatCompletionsUrl` result, with a single `CodeLanguage.Curl` snippet POSTing a `messages` body to that URL with an `?api-version=<api-version>` query placeholder) when `hasChatCompletion` is `true`;
  - a `Responses` entry (`buildResponsesUrl` result, with a single `CodeLanguage.Curl` snippet POSTing a JSON body containing `"model": id` and an `input` field) when `hasResponsesApi` is `true`;
  - an `Anthropic Messages` entry (`buildAnthropicMessagesUrl` result, with a single cURL snippet containing `model: id`, positive `max_tokens` and user `messages`, plus `Content-Type: application/json`, a placeholder DIAL `Api-Key` and `anthropic-version: 2023-06-01`) when `hasAnthropicMessages` is `true`.
- Return `undefined` from `buildDeploymentConnectApi` when all three flags are falsy, so the caller falls back to the backend-provided `api` data instead of an empty `endpoints` array.

**Feature flag:** Not gated. **RTL impact:** None (URL string, not rendered UI). **i18n impact:** The optional `DeploymentConnectLabels` argument supplies host-translated API names with English defaults; code sample syntax is not localized. Existing calls without Messages support or labels retain their two-API behavior.

#### Scenario: Chat Completions endpoint shape

- **WHEN** `buildChatCompletionsUrl(baseUrl, id)` is called
- **THEN** the result matches `` `${trimmedBaseUrl}/openai/deployments/${encodedId}/chat/completions` ``

#### Scenario: Responses endpoint is not deployment-scoped in the URL

- **WHEN** `buildResponsesUrl(baseUrl)` is called
- **THEN** the result matches `` `${trimmedBaseUrl}/openai/v1/responses` ``, with no deployment id in the path

#### Scenario: Both endpoints included when both flags are true

- **WHEN** `buildDeploymentConnectApi(baseUrl, id, { hasChatCompletion: true, hasResponsesApi: true })` is called
- **THEN** the result's `endpoints` contains exactly two entries, `Chat Completions` then `Responses`, and `resource.modelId` equals `id` decoded per segment (identical to `id` when it holds no percent-encoded characters)

#### Scenario: No endpoints built when neither flag is true

- **WHEN** `buildDeploymentConnectApi(baseUrl, id, { hasChatCompletion: false, hasResponsesApi: false })` is called
- **THEN** the result is `undefined`

#### Scenario: A deployment id with reserved characters is encoded once, not twice

- **WHEN** `buildChatCompletionsUrl(baseUrl, 'applications/public/qa 2.0 with presales 19.08__0.0.3')` is called
- **THEN** the space in each segment is encoded as a single `%20`, not `%2520`, and the `/` separators between segments are preserved

#### Scenario: Three supported APIs produce three independently gated entries

- **WHEN** all three support flags are true
- **THEN** endpoints contains Chat Completions, Responses and Anthropic Messages in that order

#### Scenario: Messages-only support produces one usable entry

- **WHEN** `hasAnthropicMessages` is true and both OpenAI flags are absent or false
- **THEN** the result has exactly one Anthropic Messages endpoint and its request snippet

#### Scenario: Messages do not enable OpenAI entries

- **WHEN** only `hasAnthropicMessages` is true
- **THEN** neither a Chat Completions entry nor a Responses entry appears

#### Scenario: External Core base and request deployment ID are used separately

- **WHEN** the builder receives base https://dial.example.com/ and selected ID custom-deployment
- **THEN** the Messages endpoint is https://dial.example.com/anthropic/v1/messages and its JSON body model is custom-deployment

#### Scenario: Base-relative behavior is preserved

- **WHEN** Messages support is true and the host supplies no external Core base
- **THEN** the endpoint is /anthropic/v1/messages and Connect remains present as with existing base-relative entries

#### Scenario: The Messages snippet safely round-trips the selected ID

- **WHEN** an ID or URL contains quotes, apostrophes, backslashes, spaces or percent-encoded characters
- **THEN** the copied snippet is syntactically valid shell and JSON, and its decoded request model equals the original selected ID without interpreting it as shell code

## ADDED Requirements

### Requirement: Messages connections preserve generic presentation and host ownership

Catalog SHALL render the resolved API data it receives, not interpret a model ID/provider, read host configuration, construct Core URLs, access credentials or call an API client. The host/integration boundary SHALL provide resolved endpoint values and snippets. Extending the explicitly requested existing non-rendering DIAL helper in chat-hooks SHALL NOT introduce app context, environment, session, routing or SDK-setup dependencies, nor authorize such knowledge in catalog.

For mixed API model details, selecting Anthropic Messages SHALL replace both the displayed endpoint and example with its own values. For Messages-only details, Connect SHALL remain visible and show the single endpoint's plain title instead of an unnecessary selector. Code blocks SHALL remain copy-only and SHALL announce successful copying through the existing mounted polite live region with a stable accessible copy-button label. The request example SHALL contain the selected deployment ID, required fields and a caller-owned DIAL key placeholder; no catalog/server/provider key or upstream header SHALL be included.

The detail-fetch state remains owned by `useCatalogItemDetails` in `libs/chat-hooks/src/catalog/useCatalogItemDetails.ts`; endpoint selection remains in `ApiDetails` in `libs/catalog/src/components/Details/ApiDetails.tsx`. No new context, persisted selection, network request, telemetry event or feature flag SHALL be added. Existing loading/error handling and the no-supported-endpoint hidden-tab state SHALL be preserved.

The same actions and content SHALL remain reachable through keyboard and touch on mobile, tablet and desktop detail surfaces, with WCAG 2.1 AAA as the target. RTL SHALL retain logical spacing and existing control behavior; URLs/code syntax SHALL NOT be corrupted by direction handling. Existing responsive menu/drawer boundaries SHALL remain unchanged.

#### Scenario: Selecting Messages swaps its endpoint and snippet together

- **WHEN** a user chooses Anthropic Messages from a mixed-API Connect selector
- **THEN** the displayed URL and copied request example are both the Messages values for the selected deployment

#### Scenario: Messages-only model keeps the tab and plain title

- **WHEN** a model's only resolved endpoint is Anthropic Messages
- **THEN** Connect is visible, the endpoint title is plain Anthropic Messages text and no endpoint-choice selector is rendered

#### Scenario: Copying uses the existing accessible feedback

- **WHEN** the user copies the Messages URL or snippet using its labeled copy control
- **THEN** the full value reaches the clipboard and success is announced through the existing polite live region, without adding a download action

#### Scenario: Responsive and RTL details retain equivalent actions

- **WHEN** Messages-only and mixed API details are rendered in mobile/tablet/desktop and RTL contexts
- **THEN** endpoint selection and copying remain reachable, labels are readable, and the URL/request content is unchanged

#### Scenario: No advertised supported generation API leaves no fabricated tab

- **WHEN** details have no supported generation API and only a model identifier as API data
- **THEN** Connect remains hidden under the existing generic endpoint-data gate

### Requirement: Generation API option labels are supplied by the host

The integration SHALL accept optional `DeploymentConnectLabels` with chatCompletions, responses and `anthropicMessages` fields, defaulting to Chat Completions, Responses and Anthropic Messages. Hosts SHALL be able to override every displayed API option through these labels. The labels SHALL be threaded through the details hook to the builder, exported as part of its public contract and not resolved through i18n inside a lib.

`apps/chat` SHALL populate the three fields through t() and enum keys `catalog.details.api.chatCompletions`, `catalog.details.api.responses` and `catalog.details.api.anthropicMessages` in `apps/chat/src/constants/i18n-keys/catalog.ts`, re-exported by `apps/chat/src/constants/translation-keys.ts`. The labels object SHALL be memoized so stable host inputs preserve the existing `onFetchDetails` callback stability.

#### Scenario: The host overrides every generation option

- **WHEN** the host supplies translated labels for all three generation APIs
- **THEN** the mixed selector and single-endpoint title use those labels rather than hardcoded English names

#### Scenario: Existing hosts keep English defaults

- **WHEN** a host calls the existing helper/hook without a labels object
- **THEN** existing OpenAI entry labels remain unchanged and Messages uses its English default when supported
