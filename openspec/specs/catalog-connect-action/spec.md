## ADDED Requirements

### Requirement: `libs/catalog` renders Connect as a details-panel tab

`libs/catalog`'s `DetailsPanel` (`Details/DetailsPanel.tsx`) SHALL render a `Connect` tab in the item details tab row (alongside `About`/`Overview`/`Pricing`/`Limits`/`Tools`), driven purely by data: the tab appears whenever `item.details?.api != null`, positioned last in the tab row regardless of the item's `type` and regardless of which other tabs are present.

There is no standalone `Connect` button or popover component. `Details/Header/ConnectButton/` and any app-level `ConnectPopoverContainer` SHALL NOT exist; Connect is reached exclusively by selecting the tab.

Selecting the `Connect` tab SHALL render `ApiDetails` (`Details/ApiDetails.tsx`) with `api={item.details.api}`. `ApiDetails` SHALL render, in order, whichever of the following sections the data provides:
- A `Resource` section (`TableView`) when `api.resource?.modelId` is set.
- A single copyable endpoint code block (`MarkdownCodeBlock`, `hideDownload`) when `api.resource?.endpointUrl` is set and `api.endpoints` is empty.
- An `Endpoint` section with a multi-endpoint inline-select (`InlineSelectTrigger` + `DialDropdown`) driving one `MarkdownCodeBlock` per selection, plus that endpoint's own code snippets (language inline-select), when `api.endpoints` is non-empty.
- A legacy top-level `Code snippet` section (language inline-select) when `api.endpoints` is empty and `api.snippets` is non-empty.
- `Request example` and `Response schema` sections when `api.requestExample` / `api.responseSchema` are set.

None of these sections render a download action; every `MarkdownCodeBlock` instance passes `hideDownload`.

`ItemDetailsTexts` SHALL gain `tabConnectLabel?: string` (default `'Connect'`) for the tab label, plus the existing `ApiDetails` label props (`apiResourceSectionLabel`, `apiSnippetSectionLabel`, `apiModelIdLabel`, `apiEndpointLabel`, `apiRequestExampleLabel`, `apiResponseSchemaLabel`, `copyCodeAriaLabel`).

`libs/catalog` SHALL NOT import or reference any DIAL Core URL, environment/config value, generated API client, or app-owned MCP-support rule — `item.details.api` is the only integration point the lib consumes for this feature; the app decides what data (if any) to populate it with.

**Feature flag:** Not gated.

**RTL impact:** Sections use `text-start`/logical spacing consistent with the rest of the details panel; no directional icons.

**i18n impact:** `tabConnectLabel` default `'Connect'` is a lib-level default string; the consuming app supplies the localized value through `texts.tabConnectLabel`, reusing the shared `Connect` button/tab key rather than a feature-scoped key.

**Accessibility:** The tab follows the same `TabRow` keyboard/ARIA behavior as every other details tab (`role="tab"`/`aria-selected` provided by `TabRow`). The copy action on each code block announces its "copied" feedback via `MarkdownCodeBlock`'s existing `aria-live="polite"` region; the button's own label stays stable.

#### Scenario: Connect tab renders last when api data is present

- **WHEN** `item.details?.api` is set
- **THEN** the `Connect` tab renders as the last tab, after `About`/`Overview`/`Pricing`/`Limits`/`Tools` (whichever of those are also present for that item)

#### Scenario: Connect tab is absent when api data is not supplied

- **WHEN** `item.details?.api` is `undefined`
- **THEN** no `Connect` tab renders for that item

#### Scenario: Single endpoint renders one copyable code block

- **WHEN** `api.resource.endpointUrl` is set and `api.endpoints` is empty or absent
- **THEN** `ApiDetails` renders one `MarkdownCodeBlock` containing that URL, with no endpoint selector

#### Scenario: Multiple endpoints render a selector

- **WHEN** `api.endpoints` has more than one entry
- **THEN** `ApiDetails` renders an inline-select trigger; selecting a different endpoint swaps the displayed URL and that endpoint's own snippets

#### Scenario: Label defaults to "Connect" when no text override is supplied

- **WHEN** `texts.tabConnectLabel` is not supplied
- **THEN** the tab label renders as `'Connect'`

---

### Requirement: `apps/chat` supplies Connect API data for toolsets and MCP-capable applications

`apps/chat`'s `CatalogView` (`handleFetchDetails`) SHALL override the fetched `api` field with `buildConnectApi(dialCoreExternalUrl ?? '', item.id)` when:
- the item's `type` is `CatalogEntityType.Toolset`, OR
- the item's `type` is `CatalogEntityType.Agent` AND its `supportsMcp` field is `true`.

For every other item, `api` is left as returned by `mapEntityDetailsToCatalogDetails` (backend-provided endpoint/snippet data for Agents in general, `{ modelId }` for Models).

Unlike a UI-triggered popover, this override is unconditional: it runs regardless of whether the DIAL Core external URL is configured. When `dialCoreExternalUrl` is not configured, `buildConnectApi` is called with an empty base URL and the endpoint renders as a base-relative path (no absolute host).

`buildConnectApi` SHALL return a `CatalogItemApiDetails` with:
- `resource.endpointUrl` set to `buildToolsetMcpUrl(baseUrl, id)`.
- `snippets` containing a single `CodeLanguage.Curl` entry that POSTs a `tools/list` JSON-RPC request to that URL with an `Api-Key` placeholder header.

**Feature flag:** Not gated.

**RTL impact:** None (data-only). **i18n impact:** None (the snippet text is a code sample, not localized UI copy).

#### Scenario: Toolset gets a Connect endpoint regardless of type-specific backend data

- **WHEN** an item has `type: CatalogEntityType.Toolset`
- **THEN** `handleFetchDetails` sets `api` to `buildConnectApi(dialCoreExternalUrl ?? '', item.id)`, replacing whatever `api` the backend-mapped details produced

#### Scenario: MCP-capable application gets a Connect endpoint

- **WHEN** an item has `type: CatalogEntityType.Agent` and `supportsMcp: true`
- **THEN** `handleFetchDetails` sets `api` to `buildConnectApi(dialCoreExternalUrl ?? '', item.id)`

#### Scenario: Non-MCP application keeps its backend-provided api data

- **WHEN** an item has `type: CatalogEntityType.Agent` and `supportsMcp: false` (or `undefined`)
- **THEN** `handleFetchDetails` leaves `api` as returned by `mapEntityDetailsToCatalogDetails`

#### Scenario: Connect endpoint is still built when the external URL is not configured

- **WHEN** `config.dialCoreExternalUrl` is `null` and an item has `type: CatalogEntityType.Toolset`
- **THEN** `handleFetchDetails` still sets `api` via `buildConnectApi('', item.id)`, producing a base-relative endpoint URL rather than omitting the Connect tab

#### Scenario: Copying the endpoint URL

- **WHEN** the user clicks the copy action on the Connect tab's endpoint code block for a toolset item with id `toolsets/public/search-tool`
- **THEN** the clipboard receives `{dialCoreExternalUrl}/v1/toolset/toolsets/public/search-tool/mcp` (per the URL-helper requirement's encoding rules), or the base-relative equivalent when the external URL is not configured

---

### Requirement: MCP endpoint URL helper

`apps/chat` SHALL provide a URL-building utility (`apps/chat/src/utils/mcp-endpoint-url.ts`) that composes an MCP endpoint URL from a DIAL Core external base URL and an entity id. The utility SHALL:

- Trim exactly one trailing `/` from the base URL, if present.
- Split the entity id on `/` and encode each segment independently: decode the segment defensively first (ignoring decode failures, keeping the raw segment), then re-encode with `encodeURIComponent` — matching the segment-handling behavior of `apps/chat-api/src/common/utils/encode-dial-path.ts`. This means:
  - A literal `%2F` already present inside one segment (i.e., not a `/` path separator) is preserved rather than being treated as introducing an extra path segment.
  - A segment already containing an encoded character (e.g. `%20` for a space) is not double-encoded.
- Expose `buildToolsetMcpUrl(baseUrl, id)` returning `` `${trimmedBaseUrl}/v1/toolset/${encodedId}/mcp` `` and `buildApplicationMcpUrl(baseUrl, id)` returning `` `${trimmedBaseUrl}/v1/deployments/${encodedId}/mcp` ``, both built on the one shared segment-encoder.
- Expose `buildConnectApi(baseUrl, id)` returning a `CatalogItemApiDetails` (per the requirement above) built from `buildToolsetMcpUrl`.

**Feature flag:** Not gated. **RTL impact:** None (URL string, not rendered UI). **i18n impact:** None.

#### Scenario: Trailing slash is trimmed from the base URL

- **WHEN** `buildToolsetMcpUrl('https://dial.example.com/', 'toolsets/public/search-tool')` is called
- **THEN** the result does not contain a double slash between the base URL and `/v1/toolset/`

#### Scenario: Path segments are encoded independently

- **WHEN** `buildApplicationMcpUrl('https://dial.example.com', 'applications/public/my app')` is called
- **THEN** the space in the last segment is encoded (e.g. `%20`) without affecting the `/` separators between segments

#### Scenario: Already-encoded space is not double-encoded

- **WHEN** an id segment already contains `%20`
- **THEN** the output contains a single `%20` for that character, not `%2520`

#### Scenario: Literal %2F inside a segment is preserved

- **WHEN** an id segment contains a literal `%2F` (not intended as a path separator)
- **THEN** the output for that segment still contains `%2F` and is not further split into an extra path segment

#### Scenario: Toolset URL shape

- **WHEN** `buildToolsetMcpUrl(baseUrl, id)` is called
- **THEN** the result matches `` `${trimmedBaseUrl}/v1/toolset/${encodedId}/mcp` ``

#### Scenario: Application URL shape

- **WHEN** `buildApplicationMcpUrl(baseUrl, id)` is called
- **THEN** the result matches `` `${trimmedBaseUrl}/v1/deployments/${encodedId}/mcp` ``

#### Scenario: buildConnectApi shape

- **WHEN** `buildConnectApi(baseUrl, id)` is called
- **THEN** the result's `resource.endpointUrl` equals `buildToolsetMcpUrl(baseUrl, id)`, and `snippets` contains exactly one `CodeLanguage.Curl` entry referencing that same URL

---

### Requirement: `CatalogItem` carries a host-neutral MCP-support flag

`CatalogItem` (`libs/catalog/src/models/catalog-item.ts`) SHALL gain an optional field `supportsMcp?: boolean`, documented as "Whether this application supports the MCP protocol; only meaningful for `Application` items." `libs/catalog` SHALL NOT interpret this field beyond exposing it — the Connect-data decision based on it lives entirely in `apps/chat` (see the requirement above).

`apps/chat/src/utils/map-deployment-to-catalog-item.ts`'s `mapDeploymentToCatalogItem` SHALL set `supportsMcp: deployment.features?.mcp === true`. `mapToolsetToCatalogItem` SHALL NOT set `supportsMcp` (toolsets get Connect data gated on `type === Toolset` alone, not on this flag).

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

#### Scenario: Application deployment with features.mcp true maps to supportsMcp true

- **WHEN** `mapDeploymentToCatalogItem` is called with a `DeploymentItemDto` whose `features.mcp` is `true`
- **THEN** the resulting `CatalogItem.supportsMcp` is `true`

#### Scenario: Application deployment with features.mcp absent maps to supportsMcp false

- **WHEN** `mapDeploymentToCatalogItem` is called with a `DeploymentItemDto` whose `features` is `undefined` or whose `features.mcp` is absent
- **THEN** the resulting `CatalogItem.supportsMcp` is `false`
