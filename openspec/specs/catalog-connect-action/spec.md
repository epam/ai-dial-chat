## ADDED Requirements

### Requirement: `libs/catalog` exposes a host-agnostic Connect header action

`libs/catalog` SHALL render a `Connect` action button in the Catalog item details sidebar header (`Details/Header/Header.tsx`), positioned after every other header action button (`Use in chat`, `Edit`, `Share`/recipient-side `Delete`, `Publish`, credentials). A new `ConnectButton` component SHALL be added under `Details/Header/ConnectButton/` (sibling to `Details/Header/ShareButton/`), following the same file/folder and component-props-naming conventions already used there.

`ConnectButton` SHALL render as a `NeutralButton` with a leading plug icon (`IconPlugConnected` from `@tabler/icons-react`, `aria-hidden`, matching the icon-size convention used by the other header action buttons) and a trailing `IconChevronDown`, matching `ShareButton`'s icon pairing. Neither icon is direction-dependent; neither SHALL be mirrored for RTL.

`CatalogProps`, `DetailsPanelProps`, and `HeaderProps` SHALL gain:
- `connectOverlay?: (item: CatalogItem, onClose: () => void) => ReactNode` — renders the Connect popover content anchored to the button; when absent, `Connect` is never shown (there is no non-overlay fallback action).
- `isConnectVisible?: (item: CatalogItem) => boolean` — controls whether `Connect` renders for a given item; when absent, `Connect` is never shown.

`ItemDetailsTexts` SHALL gain `connectLabel?: string` (default `'Connect'`), used as the trigger button's label for every entity type.

`libs/catalog` SHALL NOT import or reference any DIAL Core URL, environment/config value, generated API client, or app-owned MCP-support rule — `connectOverlay` and `isConnectVisible` are the only two integration points the lib exposes for this feature.

**Feature flag:** Not gated.

**RTL impact:** Button uses logical Tailwind classes (`gap-*`, `ps-*`/`pe-*` where applicable) consistent with the existing header action row; no directional icon mirroring needed.

**i18n impact:** `connectLabel` default `'Connect'` is a lib-level default string (per the existing `libs/catalog` text-override pattern); the consuming app supplies the localized value through `detailsTexts.connectLabel`.

**Accessibility:** `ConnectButton` SHALL set `aria-haspopup="menu"` and `aria-expanded={isOpen}` when `connectOverlay` is provided, matching `ShareButton`'s wiring. The popover SHALL be reachable and dismissible via keyboard (outside click via `DialDropdown`'s `outsideClosable`, plus standard focus handling already provided by `DialDropdown`).

#### Scenario: Connect renders after all existing header actions when visible

- **WHEN** `isConnectVisible(item)` returns `true` and `connectOverlay` is supplied
- **THEN** the `Connect` button renders as the last element in the header action row, after `Use in chat`/`Edit`/`Share`/`Delete`/`Publish`/credentials (whichever of those are also visible for that item)

#### Scenario: Connect is hidden when isConnectVisible returns false

- **WHEN** `isConnectVisible(item)` returns `false`
- **THEN** no `Connect` button renders for that item, regardless of whether `connectOverlay` is supplied

#### Scenario: Connect is hidden when isConnectVisible is not supplied

- **WHEN** `isConnectVisible` is `undefined`
- **THEN** no `Connect` button renders for any item

#### Scenario: Clicking Connect opens the anchored popover

- **WHEN** the user clicks the `Connect` button
- **THEN** a `DialDropdown` opens anchored to the button, `aria-expanded` becomes `true`, and it renders the `ReactNode` returned by `connectOverlay(item, onClose)`

#### Scenario: Outside click closes the popover

- **WHEN** the Connect popover is open and the user clicks outside it
- **THEN** the popover closes and `aria-expanded` returns to `false`

#### Scenario: connectOverlay's onClose callback closes the popover

- **WHEN** the popover content calls the `onClose` callback passed to `connectOverlay`
- **THEN** the popover closes

#### Scenario: Label defaults to "Connect" when no text override is supplied

- **WHEN** `detailsTexts.connectLabel` is not supplied
- **THEN** the button label renders as `'Connect'`

---

### Requirement: `apps/chat` resolves Connect visibility and popover content for toolsets and MCP applications

`apps/chat`'s `CatalogView` SHALL supply `isConnectVisible` and `connectOverlay` to the `Catalog` component from `libs/catalog`.

`isConnectVisible` SHALL return `true` only when a client-safe DIAL Core external URL is configured (see the `app-config-context` and `client-config-endpoint` capabilities) AND:
- the item's `type` is `CatalogEntityType.Toolset`, OR
- the item's `type` is `CatalogEntityType.Application` AND its `supportsMcp` field is `true`.

`isConnectVisible` SHALL return `false` for `CatalogEntityType.Model`, `CatalogEntityType.Guardrail`, `CatalogEntityType.Skill`, `CatalogEntityType.Mcp`, `CatalogEntityType.Agent`, and non-MCP applications, and for every item when the DIAL Core external URL is not configured.

`connectOverlay` SHALL render a new `ConnectPopoverContainer` component (`apps/chat/src/components/ConnectPopoverContainer/ConnectPopoverContainer.tsx`), which:
- Shows the title `Connect toolset` when `item.type === CatalogEntityType.Toolset`, or `Connect Application` when `item.type === CatalogEntityType.Application`.
- Shows the description `Copy endpoint URL to easily integrate toolset into your workflows` for toolsets, or `Copy endpoint URL to easily integrate application into your workflows` for applications.
- Renders one `Copy URL` button. Clicking it copies the MCP endpoint URL (built per the URL-helper requirement below) to the clipboard via the browser clipboard API and shows the same transient "copied" feedback convention already used by the Catalog's API-tab copy button (temporary label swap or icon swap plus an `aria-live="polite"` status region; the button's own `aria-label` stays stable).
- Renders no URL input, read-only text field, or any other visible rendering of the raw URL string.

**Feature flag:** Not gated.

**RTL impact:** Popover text uses `text-start`; no directional icons beyond the shared plug/chevron already covered above.

**i18n impact:** New keys added to `apps/chat/src/i18n/locales/en.json` and `apps/chat/src/constants/translation-keys.ts`: connect popover title (toolset), connect popover title (application), connect popover description (toolset), connect popover description (application). The `Copy URL` button label and the "copied" feedback label SHALL reuse the existing shared `Copy`/`Copied` keys already used elsewhere in the Catalog details panel (per the project's duplicate-i18n-value convention) rather than declaring new ones.

#### Scenario: Toolset with configured external URL shows Connect

- **WHEN** an item has `type: CatalogEntityType.Toolset` and the DIAL Core external URL is configured
- **THEN** `isConnectVisible(item)` returns `true`

#### Scenario: MCP-capable application with configured external URL shows Connect

- **WHEN** an item has `type: CatalogEntityType.Application` and `supportsMcp: true`, and the DIAL Core external URL is configured
- **THEN** `isConnectVisible(item)` returns `true`

#### Scenario: Non-MCP application never shows Connect

- **WHEN** an item has `type: CatalogEntityType.Application` and `supportsMcp: false` (or `undefined`)
- **THEN** `isConnectVisible(item)` returns `false`, regardless of the DIAL Core external URL configuration

#### Scenario: Model, Guardrail, Skill, Agent, and Mcp items never show Connect

- **WHEN** an item's `type` is `CatalogEntityType.Model`, `CatalogEntityType.Guardrail`, `CatalogEntityType.Skill`, `CatalogEntityType.Agent`, or `CatalogEntityType.Mcp`
- **THEN** `isConnectVisible(item)` returns `false`

#### Scenario: Nothing shows Connect when the external URL is not configured

- **WHEN** the DIAL Core external URL is not configured (`config.dialCoreExternalUrl` is `null`)
- **THEN** `isConnectVisible(item)` returns `false` for every item, including toolsets and MCP applications

#### Scenario: Copy URL copies the correct endpoint and shows feedback

- **WHEN** the user clicks `Copy URL` in the popover for a toolset item with id `toolsets/public/search-tool`
- **THEN** the clipboard receives `{dialCoreExternalUrl}/v1/toolset/toolsets/public/search-tool/mcp` (per the URL-helper requirement's encoding rules)
- **AND** the button shows transient copied feedback announced via an `aria-live="polite"` region

---

### Requirement: MCP endpoint URL helper

`apps/chat` SHALL provide a URL-building utility (e.g. `apps/chat/src/utils/mcp-endpoint-url.ts`) that composes an MCP endpoint URL from a DIAL Core external base URL and an entity id. The utility SHALL:

- Trim exactly one trailing `/` from the base URL, if present.
- Split the entity id on `/` and encode each segment independently: decode the segment defensively first (ignoring decode failures, keeping the raw segment), then re-encode with `encodeURIComponent` — matching the segment-handling behavior of `apps/chat-api/src/common/utils/encode-dial-path.ts`. This means:
  - A literal `%2F` already present inside one segment (i.e., not a `/` path separator) is preserved rather than being treated as introducing an extra path segment.
  - A segment already containing an encoded character (e.g. `%20` for a space) is not double-encoded.
- Expose `buildToolsetMcpUrl(baseUrl, id)` returning `` `${trimmedBaseUrl}/v1/toolset/${encodedId}/mcp` `` and `buildApplicationMcpUrl(baseUrl, id)` returning `` `${trimmedBaseUrl}/v1/deployments/${encodedId}/mcp` ``, both built on the one shared segment-encoder.

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

---

### Requirement: `CatalogItem` carries a host-neutral MCP-support flag

`CatalogItem` (`libs/catalog/src/models/catalog-item.ts`) SHALL gain an optional field `supportsMcp?: boolean`, documented as "Whether this application supports the MCP protocol; only meaningful for `Application` items." `libs/catalog` SHALL NOT interpret this field beyond exposing it — visibility logic based on it lives entirely in `apps/chat` (see the `isConnectVisible` requirement above).

`apps/chat/src/utils/map-deployment-to-catalog-item.ts`'s `mapDeploymentToCatalogItem` SHALL set `supportsMcp: deployment.features?.mcp === true`. `mapToolsetToCatalogItem` SHALL NOT set `supportsMcp` (toolsets are gated on `type === Toolset` alone, not on this flag).

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

#### Scenario: Application deployment with features.mcp true maps to supportsMcp true

- **WHEN** `mapDeploymentToCatalogItem` is called with a `DeploymentItemDto` whose `features.mcp` is `true`
- **THEN** the resulting `CatalogItem.supportsMcp` is `true`

#### Scenario: Application deployment with features.mcp absent maps to supportsMcp false

- **WHEN** `mapDeploymentToCatalogItem` is called with a `DeploymentItemDto` whose `features` is `undefined` or whose `features.mcp` is absent
- **THEN** the resulting `CatalogItem.supportsMcp` is `false`
