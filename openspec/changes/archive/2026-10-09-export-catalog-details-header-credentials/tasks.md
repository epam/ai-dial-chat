Read `AGENTS.md` §Library isolation, `.claude/rules/libs.md` and `.claude/rules/docs.md` first.

## 1. Exports

- [x] 1.1 Export the props interfaces: `HeaderProps` (`Header/Header.tsx`), `CredentialsBannerProps`, `CredentialsApiKeyOverlayProps`, `CredentialsManagementPanelProps`.
- [x] 1.2 `libs/catalog/src/entry-points/mapping.ts`: add `CredentialsBannerState` and `getCredentialsBannerState`.
- [x] 1.3 `libs/catalog/src/index.ts`: `ApiDetails as ApiTab`, `ApiDetailsProps as ApiTabProps`, `Header as DetailsHeader`, `HeaderProps as DetailsHeaderProps`, the three credentials components and their props.
- [x] 1.4 `libs/catalog/src/tests/index-exports.spec.ts`: each new component is a function from the root; `getCredentialsBannerState` and `CredentialsBannerState` come from `/mapping` and the root.

## 2. Docs and verification

- [x] 2.1 `libs/catalog/README.md`: an "Embedding the header, Connect tab and credentials" section with compiling examples.
- [x] 2.2 `npm run test:file -- libs/catalog/src/tests/index-exports.spec.ts`, the catalog Details specs, `npm run validate:docs`, `npm run validate:specs`, `npm exec nx run @epam/ai-dial-catalog:build`, lint on the touched files, `openspec validate export-catalog-details-header-credentials --strict`.
