## 1. Backend: client-safe DIAL Core external URL config

- [x] 1.1 Add `DIAL_CORE_EXTERNAL_URL` (optional string, no default) to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`, placed near the existing `DIAL_CORE_URL` declaration.
- [x] 1.2 Add a `dialCore.externalUrl` entry to `CONFIG_DEFINITIONS` in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` (`type: 'config'`, `valueType: 'string'`, `visibility: 'client'`, `defaultValue: null`, `critical: false`, `envVar: 'DIAL_CORE_EXTERNAL_URL'`).
- [x] 1.3 Confirm `EnvConfigProvider`/`StaticDefaultsProvider`/`CompositeConfigProvider` resolve the new key with no code changes needed (generic env-var lookup path); add a unit test in the existing config-registry test suite asserting the new key resolves to the env value when set and `null` when unset.
- [x] 1.4 Update `ClientConfigResponseDto` (`apps/chat-api/src/app-config/dto/client-config-response.dto.ts`) to include `dialCoreExternalUrl: string | null` in its `config` shape with `@ApiProperty`.
- [x] 1.5 Add/update `apps/chat-api` tests (`app-config` service/controller specs) covering: `dialCoreExternalUrl` present when `DIAL_CORE_EXTERNAL_URL` is set, `null` when unset, and never leaking the internal `DIAL_CORE_URL` value.
- [x] 1.6 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` for this slice.

## 2. Backend: expose MCP support on the deployments list DTO

- [x] 2.1 Add `mcp?: boolean` to `RawDeploymentFeaturesDto` in `apps/chat-api/src/deployments/dto/raw-deployment.dto.ts`.
- [x] 2.2 Add `mcp?: boolean` (with `@ApiPropertyOptional`) to `DeploymentFeaturesDto` in `apps/chat-api/src/deployments/dto/deployment-item.dto.ts`.
- [x] 2.3 Update `mapToDeploymentItem` in `apps/chat-api/src/deployments/deployments.service.ts` to include `mcp` in the mapped `features` object when `raw.features?.mcp` is present, following the same conditional-spread style already used for `folderAttachments`.
- [x] 2.4 Add/update tests in `apps/chat-api/src/deployments/tests/deployments.service.spec.ts` covering an application item with `features.mcp: true` and one with `features.mcp` absent.
- [x] 2.5 Run `npm exec nx test chat-api` and `npm exec nx lint chat-api` for this slice.

## 3. Regenerate the OpenAPI client

- [x] 3.1 Run `npm run openapi` to regenerate `libs/chat-api-client` from the updated Swagger definitions (client-config `dialCoreExternalUrl`, deployments `features.mcp`).
- [x] 3.2 Run `npm run openapi:check` to confirm the generated client is committed and in sync.
- [x] 3.3 Build/lint the generated client project if `nx` exposes a target for it (e.g. `npm exec nx lint chat-api-client`), confirming no hand edits were needed.

## 4. Frontend: AppConfigContext exposes the DIAL Core external URL

- [x] 4.1 Extend `AppConfigState.config` in `apps/chat/src/context/AppConfigContext.tsx` with `dialCoreExternalUrl: string | null`, defaulting to `null` in `INITIAL_STATE` and on error.
- [x] 4.2 Populate `dialCoreExternalUrl` from the `getClientConfig` response inside `loadConfig`.
- [x] 4.3 Add/update `AppConfigContext` tests covering the loading/ready/error scenarios for the new field (mirroring existing `asrModelId` test coverage).
- [x] 4.4 Run `npm exec nx test chat` for this slice.

## 5. Frontend: MCP endpoint URL helper

- [x] 5.1 Create `apps/chat/src/utils/mcp-endpoint-url.ts` with a shared segment-encoder (decode-then-`encodeURIComponent` per `/`-separated segment) and `buildToolsetMcpUrl(baseUrl, id)` / `buildApplicationMcpUrl(baseUrl, id)`, trimming exactly one trailing slash from `baseUrl`.
- [x] 5.2 Add unit tests covering: trailing-slash trimming, independent per-segment encoding, no double-encoding of an already-encoded space, preservation of a literal `%2F` inside a segment, and the exact `/v1/toolset/{id}/mcp` and `/v1/deployments/{id}/mcp` output shapes.
- [x] 5.3 Run `npm exec nx test chat` for this slice.

## 6. Frontend: CatalogItem gains supportsMcp

- [x] 6.1 Add `supportsMcp?: boolean` to `CatalogItem` in `libs/catalog/src/models/catalog-item.ts` with a JSDoc comment noting it is only meaningful for `Application` items.
- [x] 6.2 Update `mapDeploymentToCatalogItem` in `apps/chat/src/utils/map-deployment-to-catalog-item.ts` to set `supportsMcp: deployment.features?.mcp === true`.
- [x] 6.3 Add/update tests in the existing `map-deployment-to-catalog-item` test suite covering `features.mcp: true` → `supportsMcp: true` and absent `features.mcp` → `supportsMcp: false`.
- [x] 6.4 Run `npm exec nx test chat` for this slice.

## 7. libs/catalog: ConnectButton and prop plumbing

- [x] 7.1 Add `connectOverlay?: (item: CatalogItem, onClose: () => void) => ReactNode` and `isConnectVisible?: (item: CatalogItem) => boolean` to `CatalogProps` (`libs/catalog/src/models/catalog-props.ts`) and `DetailsPanelProps` (`libs/catalog/src/models/item-details-props.ts`), with JSDoc mirroring the `shareOverlay`/`isPublishVisible` style.
- [x] 7.2 Add `connectLabel?: string` to `ItemDetailsTexts` in `libs/catalog/src/models/item-details-props.ts` (default documented as `'Connect'`).
- [x] 7.3 Create `libs/catalog/src/components/Details/Header/ConnectButton/ConnectButton.tsx`, modeled on `ShareButton.tsx`: `NeutralButton` with `IconPlugConnected` (leading, `aria-hidden`) and `IconChevronDown` (trailing), wrapped in `DialDropdown` when `connectOverlay` is supplied, wiring `aria-haspopup="menu"` / `aria-expanded`, and rendering nothing when `isConnectVisible` is absent or returns `false`.
- [x] 7.4 Wire `ConnectButton` into `Header.tsx`, passed `connectOverlay`, `isConnectVisible`, and `texts?.connectLabel`, rendered after the existing `Publish`/credentials actions (last in the row).
- [x] 7.5 Thread the two new props from `CatalogProps` through the `Catalog` root component down to `DetailsPanel` down to `Header`, following the existing prop-threading path used for `shareOverlay`.
- [x] 7.6 Add tests under `libs/catalog`'s existing test conventions: Connect renders last among visible header actions, does not render when `isConnectVisible` is absent/false, opens/closes the dropdown on click/outside-click, calls `connectOverlay` with the item and a working `onClose`, and defaults its label to `'Connect'`.
- [x] 7.7 Run `npm exec nx test catalog` and `npm exec nx lint catalog` for this slice.

## 8. apps/chat: Connect popover content

- [x] 8.1 Add i18n keys to `apps/chat/src/i18n/locales/en.json` and corresponding enum members in `apps/chat/src/constants/translation-keys.ts` for: connect popover title (toolset) = "Connect toolset", connect popover title (application) = "Connect Application", connect popover description (toolset) = "Copy endpoint URL to easily integrate toolset into your workflows", connect popover description (application) = "Copy endpoint URL to easily integrate application into your workflows". Reuse existing shared `Copy`/`Copied` keys for the button and its feedback instead of declaring new ones.
- [x] 8.2 Create `apps/chat/src/components/ConnectPopoverContainer/ConnectPopoverContainer.tsx`: resolves the DIAL Core external URL from `useAppConfig()`, builds the MCP URL via the type-appropriate helper from task 5, renders the type-specific title/description, and a `Copy URL` button using the app's existing clipboard-copy-with-feedback convention (transient label/icon swap plus `aria-live="polite"` status region; stable button `aria-label`). Renders no URL input or read-only field.
- [x] 8.3 Add tests under `ConnectPopoverContainer/tests/`: correct title/description per entity type, `Copy URL` writes the expected MCP URL to the clipboard for a toolset id and for an application id (including a multi-segment id to exercise encoding), and the copied-feedback state appears and is announced via `aria-live`.
- [x] 8.4 Run `npm exec nx test chat` for this slice.

## 9. apps/chat: CatalogView wiring

- [x] 9.1 In `apps/chat/src/components/CatalogView/CatalogView.tsx`, add an `isConnectVisible` callback: `false` when `useAppConfig().config.dialCoreExternalUrl` is falsy; otherwise `true` for `CatalogEntityType.Toolset`, and for `CatalogEntityType.Application` gated on `item.supportsMcp === true`; `false` for every other type.
- [x] 9.2 Pass `connectOverlay={(item, onClose) => <ConnectPopoverContainer item={item} onClose={onClose} />}` and `isConnectVisible` to the `Catalog` component, alongside `detailsTexts.connectLabel` sourced from the new i18n key (reusing an existing shared `Connect` key if one already exists under `ButtonsI18nKeys`, per the project's duplicate-i18n-value convention — otherwise add one).
- [x] 9.3 Add/update `CatalogView` tests: toolset item shows Connect when the external URL is configured, MCP-capable application shows Connect, non-MCP application does not, and no item shows Connect when the external URL is unconfigured.
- [x] 9.4 Run `npm exec nx test chat` and `npm exec nx lint chat` for this slice.

## 10. Final verification

- [x] 10.1 Run `npm exec nx test catalog`, `npm exec nx test chat`, and `npm exec nx test chat-api`. (chat has one pre-existing, unrelated failure in `zip-export.spec.ts` — confirmed present on a clean stash without this change's edits; 1297/1300 chat tests + 2 skipped pass, catalog 274/274, chat-api 1227/1227.)
- [x] 10.2 Run `npm run openapi:check` once more to confirm no drift after all backend changes.
- [x] 10.3 Run relevant lint/typecheck targets for every touched project (`catalog`, `chat`, `chat-api`, and the generated client project if applicable).
- [x] 10.4 Manually verify in the running app (partial — see note): started `chat-api` + `chat` against the real dev DIAL Core/Keycloak instances with `DIAL_CORE_EXTERNAL_URL` set locally; confirmed live via `curl` that `GET /api/v1/client-config` returns `dialCoreExternalUrl` end-to-end from the real backend. Could not complete the full authenticated click-through (toolset/application details sidebar, popover, clipboard) because it requires real Keycloak login credentials not available in this session. Per-item Connect visibility, popover content/title, and clipboard-copy behavior are covered by the automated test suites added in sections 7–9 (Header/ConnectButton, CatalogView, ConnectPopoverContainer — rendered and interacted with via `@testing-library/react`, not just unit-tested in isolation).
- [x] 10.5 Verify RTL (via code review, not a live authenticated session — see 10.4 note): `ConnectButton`/`Header` use no physical-direction Tailwind classes; `IconPlugConnected`/`IconChevronDown`/`IconCopy`/`IconCheck` are all non-directional and unmirrored, matching the existing `ShareButton` pattern; `ConnectPopoverContainer`'s title/description use `text-start`.
