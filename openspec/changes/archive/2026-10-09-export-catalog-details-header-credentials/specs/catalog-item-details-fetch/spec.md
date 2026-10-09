## ADDED Requirements

### Requirement: Connect tab, details header and credentials views are public exports of `@epam/ai-dial-catalog`

`libs/catalog/src/index.ts` SHALL export these, so a host can render a `CatalogItem`'s Connect tab, header actions and toolset credentials UI in its own surface, without `DetailsPanel`:

- `ApiTab`, a public alias of the internal `ApiDetails` (`libs/catalog/src/components/Details/ApiDetails.tsx`), and `ApiTabProps`;
- `DetailsHeader`, a public alias of the internal `Header` (`libs/catalog/src/components/Details/Header/Header.tsx`), and `DetailsHeaderProps`;
- `CredentialsBanner` (`libs/catalog/src/components/Details/Credentials/CredentialsBanner/CredentialsBanner.tsx`) and `CredentialsBannerProps`;
- `CredentialsApiKeyOverlay` (`libs/catalog/src/components/Details/Header/CredentialsApiKeyOverlay/CredentialsApiKeyOverlay.tsx`) and `CredentialsApiKeyOverlayProps`;
- `CredentialsManagementPanel` (`libs/catalog/src/components/Details/Credentials/CredentialsManagementPanel/CredentialsManagementPanel.tsx`) and `CredentialsManagementPanelProps`.

`libs/catalog/src/entry-points/mapping.ts` SHALL export `CredentialsBannerState` and `getCredentialsBannerState`, and the package root SHALL re-export them.

The components SHALL keep their current behaviour and props; `DetailsPanel`'s rendered output SHALL be unchanged. `libs/catalog/README.md` SHALL document the exports with compiling examples, and `npm run validate:docs` SHALL pass.

#### Scenario: A host renders the Connect tab

- **WHEN** an application imports `ApiTab` from `@epam/ai-dial-catalog` and passes it a `CatalogItem`'s `details.api`
- **THEN** it renders the endpoint and code snippets with no `DetailsPanel` involved

#### Scenario: A host renders the credentials banner

- **WHEN** an application calls `getCredentialsBannerState(item.credentials)` from `@epam/ai-dial-catalog/mapping` and passes a defined result to `CredentialsBanner`
- **THEN** the banner shows the same copy `DetailsPanel` shows for that item

#### Scenario: The details panel is unchanged

- **WHEN** `DetailsPanel` renders a toolset with credentials and a connectable API
- **THEN** its header, banner and Connect tab are identical to before the change
