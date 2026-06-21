## 1. mapDeploymentToCatalogItem — accept favoriteIds parameter

- [x] 1.1 Update `mapDeploymentToCatalogItem(deployment, favoriteIds: ReadonlySet<string> = new Set())` signature and replace `deployment.isInstalled ?? false` with `favoriteIds.has(deployment.id)` for both `isUserFavorite` and `isStarred`
- [x] 1.2 Update all call sites in `apps/chat` that pass only one argument (they will rely on the default empty set until `CatalogView` is updated in task 3)
- [x] 1.3 Run `npm exec nx typecheck chat` and confirm no type errors

## 1b. UpdateInstalledDto — relax id validation

- [x] 1b.1 Change `@Matches(/^[\w\-./@]+$/)` to `@Matches(/^\S+$/)` on `UpdateInstalledDto.id` in `apps/chat-api/src/user-config/dto/update-installed.dto.ts` so deployment IDs containing `:` (e.g. `anthropic.claude-opus-4:0`) are accepted

## 2. useFavoriteApplications hook

- [x] 2.1 Create `apps/chat/src/hooks/useFavoriteApplications/useFavoriteApplications.ts` — loads `getUserConfig()` on mount with a cancelled flag, exposes `{ favoriteIds: ReadonlySet<string>, isLoading: boolean, toggleFavorite(id, isFavorite): void }`
- [x] 2.2 Implement optimistic update in `toggleFavorite`: snapshot previous set, apply change immediately, call `updateInstalledDeployment(id, isFavorite)`, restore snapshot on rejection
- [x] 2.3 Run `npm exec nx lint chat` to verify no linting errors

## 3. CatalogView — wire favorites

- [x] 3.1 Import and call `useFavoriteApplications` inside `CatalogView`
- [x] 3.2 Thread `favoriteIds` through the `useMemo` that builds `catalogItems` (pass to `mapDeploymentToCatalogItem`)
- [x] 3.3 Update `onToggleFavorite` callback to call `toggleFavorite(id, isFavorite)` guarded by `!isLoading`
- [x] 3.4 Run `npm exec nx typecheck chat` and `npm exec nx lint chat` — both must pass

## 4. Verification

- [ ] 4.1 Start the app (`npm run start:all`) and open the catalog page — confirm favorites from the user config are shown starred on load
- [ ] 4.2 Toggle a star — confirm the item moves between sections immediately and the change persists after page refresh
- [ ] 4.3 Simulate an API failure (network tab, block the PATCH) — confirm the star reverts after the error
