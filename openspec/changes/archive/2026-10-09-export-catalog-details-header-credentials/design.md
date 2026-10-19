## Context

See `proposal.md`. The precedent is `export-catalog-details-tabs` (public aliases of internal components, props interfaces exported, headless helpers through `/mapping`).

## Decisions

- **D1 — public names.** `ApiDetails` → `ApiTab` (matches `CatalogDetailsTab.Api` and the `*Tab` names). `Header` → `DetailsHeader` (`Header` is too generic for a package root). The credentials components keep their names; they are already specific.
- **D2 — headless parts go through `/mapping`.** `CredentialsBannerState` (enum in `types/toolset-auth.ts`) and `getCredentialsBannerState` (pure, in `utils/toolset-credentials.ts`) are added to `entry-points/mapping.ts` next to `getCredentialsUiState`, so a host can decide whether to show the banner without loading UI.
- **D3 — props interfaces become `export interface`**, with the existing JSDoc; `HeaderProps` is exported as `DetailsHeaderProps` from the root.

## Risks / Trade-offs

- [Wider public surface to keep stable] → the components already back `DetailsPanel`; their props are documented. Breaking changes follow the usual semver rules.
