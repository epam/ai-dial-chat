## Why

`export-catalog-details-tabs` made the details tab components public so the DIAL Quick App editor (ai-dial-quickapps-frontend) can render a `CatalogItem`'s details in its own popup. It left two parts private on purpose (its Non-goals): the Connect tab (`ApiDetails`) and the credentials sub-views. The editor still copies them:

- it hides Connect, because `ApiDetails` (`libs/catalog/src/components/Details/ApiDetails.tsx`) is not exported, although `@epam/ai-dial-chat-hooks/catalog` already builds the `details.api` data (`buildToolsetMcpUrl`, `buildConnectApi`);
- it draws its own toolset Log in / Log out button and API-key form, because the header that renders them (`libs/catalog/src/components/Details/Header/Header.tsx`), the API-key popover (`Header/CredentialsApiKeyOverlay`), the credentials banner (`Credentials/CredentialsBanner`) and the credentials management panel (`Credentials/CredentialsManagementPanel`) are private, and so is the banner rule `getCredentialsBannerState` (`libs/catalog/src/utils/toolset-credentials.ts`).

A host that embeds the details must therefore copy the header actions and credentials UI, and they drift from the catalog.

## What Changes

- **`@epam/ai-dial-catalog` exports, from the package root:**
  - `ApiTab`, a public alias of the internal `ApiDetails`, and `ApiTabProps`;
  - `DetailsHeader`, a public alias of the internal `Header`, and `DetailsHeaderProps` (the module-private `HeaderProps`, now exported);
  - `CredentialsBanner` with `CredentialsBannerProps`;
  - `CredentialsApiKeyOverlay` with `CredentialsApiKeyOverlayProps`;
  - `CredentialsManagementPanel` with `CredentialsManagementPanelProps`.

  Internal names stay. The props interfaces become exported; nothing else changes in the components.
- **`@epam/ai-dial-catalog/mapping` exports `CredentialsBannerState` and `getCredentialsBannerState`**, both headless (an enum and a pure function), and the root re-exports them through `export * from './entry-points/mapping'`.
- **`libs/catalog/README.md`** documents the new exports with compiling examples.

## Non-goals

- Any change to `DetailsPanel`, its confirmation sub-views or the publish flow.
- Making `DetailsHeader`'s entity type label translatable (it renders `item.type` through `EntityTypeLabel`, as `EntityHeader` does today). Follow-up if a localised host needs it.
- Exporting the confirmation sub-view state machine (logout / delete API key confirmations stay `DetailsPanel`'s; a host wires its own through `onRequestLogout` / `onRequestDeleteApiKey`).

## Alternatives considered

- **Export `DetailsPanel` only and let hosts embed it.** Already public, but it is a side drawer and owns Delete with the catalog's semantics; the Quick App editor keeps its own popup and its own "remove from app". Rejected as the only path.
- **Hosts copy the components** (baseline). Rejected: the same drift the tabs export removed.

## Acceptance criteria

- A host can `import { ApiTab, DetailsHeader, CredentialsBanner, CredentialsApiKeyOverlay, CredentialsManagementPanel, getCredentialsBannerState, CredentialsBannerState } from '@epam/ai-dial-catalog'` and `getCredentialsBannerState`, `CredentialsBannerState` from `@epam/ai-dial-catalog/mapping`.
- `DetailsPanel`'s output and every existing catalog test are unchanged.
- `npm run validate:docs`, `npm run validate:specs`, lint, test and the catalog build pass.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog-item-details-fetch`: adds a requirement for the public Connect tab, details header and credentials exports.

## Impact

- **Code:** `libs/catalog/src/index.ts`, `libs/catalog/src/entry-points/mapping.ts`, the props interfaces in `ApiDetails.tsx` (already exported), `Header/Header.tsx`, `Header/CredentialsApiKeyOverlay/CredentialsApiKeyOverlay.tsx`, `Credentials/CredentialsBanner/CredentialsBanner.tsx`, `Credentials/CredentialsManagementPanel/CredentialsManagementPanel.tsx`; `libs/catalog/src/tests/index-exports.spec.ts`; `libs/catalog/README.md`.
- **Library isolation:** unchanged; no new imports.
- **APIs / BFF / i18n / RTL / feature flags:** none.
- **Compatibility:** additive, minor-version bump. Rollback: revert.
