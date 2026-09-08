## ADDED Requirements

### Requirement: Sub-hook ownership map
`CatalogView.tsx` SHALL be composed from six focused hooks, each owning exactly one concern's state, memoized derivations, and backend calls, with no concern's state or handler duplicated across two hooks. Four live under `apps/chat/src/hooks/`; two (`useCatalogToolsetCredentials`, `useCatalogEditNavigation`) were subsequently moved to `libs/chat-hooks/src/catalog/` behind an injected-adapter contract (labels, notification callback, and — for `useCatalogEditNavigation` — an editor-route URL-builder adapter) to keep them free of app-owned i18n keys, routing, and server-api imports, per the library isolation rule:

- `useCatalogItems` (`apps/chat/src/hooks/`) SHALL own: `quickAppSchemaId`, `quickAppDeploymentIds`, the label memos (`promptOverviewLabels`, `skillOverviewLabels`, `deploymentLimitsLabels`), `catalogDetailsApi`, `combinedSkills`, the `useCatalogItemDetails` call (`onFetchDetails`, `onLoadContentFile`, `onLoadSkillDetailsFile`), `catalogItems`, `visibleCatalogItems`, `reconciledFilterTopics`, `availableTabIds`, and `favorites`.
- `useCatalogToolsetCredentials` (`libs/chat-hooks/src/catalog/`) SHALL own: `getLevelStatus`, `showLoginSuccess`, `showLogoutSuccess`, `handleLogin`, `handleLogout` (including its `useToolsetLogin` call).
- `useCatalogPublishing` (`apps/chat/src/hooks/`) SHALL own: `getPublishHistory`, `handlePublish`, `handleUnpublish`, `handlePublishSuccess`, `handlePublishError`, `handleFetchExistingRules`, `isPublishVisible`.
- `useCatalogSharing` (`apps/chat/src/hooks/`) SHALL own: `isShareVisible`, `isUnshareVisible`, `isRevokeShareVisible`, `handleUnshare`, `handleRevokeShare`, `handleFetchRecipientsCount`.
- `useCatalogItemActions` (`apps/chat/src/hooks/`) SHALL own: `fetchPromptDto`, `handleUseInChat`, `handleCardSelect`, `handleDownload`, `isDownloadVisible`, `isPrimaryActionVisible`, `onToggleFavorite`, `renderContentFilePreview`.
- `useCatalogEditNavigation` (`libs/chat-hooks/src/catalog/`) SHALL own: `handleEdit`, `handleDelete`, `createOptions` (URL construction itself lives in the app's injected `CatalogEditNavigationUrls` adapter, not in this hook).

#### Scenario: Every extracted field maps to exactly one owning hook
- **WHEN** any state value, memoized derivation, or handler currently declared inside `CatalogView.tsx`'s function body is inspected after decomposition
- **THEN** it SHALL originate from exactly one of the six hooks listed above, or remain in `CatalogView.tsx` itself only if it is a direct call to an existing data-source hook (`useDeployments`, `usePrompts`, `useSkills`, `useFavoriteApplications`, `useCatalogSortFilterPreference`, `useCatalogActiveTabPreference`, `useSkillArchiveImport`, `usePublishFolders`, `usePublishErrorNotification`, `useUiFeature`, `useUser`, `useAppConfig`, `useNotification`, `useOperationNotification`, `useLanguage`) or a route-param effect (the `itemId` query-param clearing `useEffect`), and never duplicated across two of the six hooks

### Requirement: Composer public contract equivalence
`CatalogView.tsx` SHALL continue to accept the same `Props` interface (`isSelectorMode`, `onClose`, `onSelect`, `visibleTypes`, `isFullWidth`) and render the same JSX tree — same `Catalog` props, same conditional early return when the catalog feature is disabled, same skill-archive file input and status region — as before decomposition.

#### Scenario: Consumers require no changes
- **WHEN** any existing caller renders `<CatalogView {...props} />` after the decomposition
- **THEN** the component SHALL accept the same `Props` shape and produce the same rendered output for the same inputs as before decomposition, with no prop renames, removals, or type changes

#### Scenario: Feature-disabled early return is preserved
- **WHEN** `isCatalogEnabled` is `false` and `isSelectorMode` is `false`
- **THEN** `CatalogView` SHALL render `null`, exactly as before decomposition

### Requirement: Error handling and notification copy are preserved verbatim
Each extracted hook SHALL preserve the exact error-handling behavior of the handler it replaces, including intentional asymmetries already present in `CatalogView.tsx` — a swallowed error is not something to be treated as an oversight and "fixed" during extraction.

#### Scenario: Toolset login cancellation stays silent
- **WHEN** `useCatalogToolsetCredentials`'s `handleLogin` receives a `ToolsetLoginOutcomeType.Cancelled` outcome
- **THEN** it SHALL return without calling any notification function, exactly as `CatalogView.tsx`'s inline `handleLogin` did before decomposition

#### Scenario: Unshare refetch failure does not surface as an error
- **WHEN** `useCatalogSharing`'s `handleUnshare` successfully calls `discardSharedCatalogItem` but the subsequent `refetchToolsets`/`refetchSkills`/`refetchPrompts`/`refetchDeployments` call throws
- **THEN** it SHALL swallow that refetch error and still show the unshare success notification, exactly as `CatalogView.tsx`'s inline `handleUnshare` did before decomposition

#### Scenario: Publish/unpublish notification and rethrow ordering is preserved
- **WHEN** `useCatalogPublishing`'s `handleUnpublish` call to `unpublishCatalogEntity` throws
- **THEN** it SHALL call `showPublishError` and then rethrow the error, exactly as `CatalogView.tsx`'s inline `handleUnpublish` did before decomposition

### Requirement: Memoization dependencies are preserved
Each extracted `useCallback`/`useMemo` SHALL keep the same dependency array (adjusted only for the hook's own local parameter names) as the code it replaces, so that re-render and re-computation behavior is unchanged.

#### Scenario: catalogItems recomputes on the same input changes only
- **WHEN** any of `deployments`, `favoriteIds`, `t`, `language`, `toolsets`, `quickAppSchemaId`, `isAdmin`, `isToolsetsEnabled`, `isCustomAppsEnabled`, `isPromptsEnabled`, `prompts`, `sharedPrompts`, `publicPrompts`, `promptOverviewLabels`, `isSkillsEnabled`, `skills`, `sharedSkills`, or `publicSkills` changes
- **THEN** `useCatalogItems`'s `catalogItems` memo SHALL recompute, and SHALL NOT recompute for a change to any other value, matching the dependency array of the original inline `catalogItems` memo
