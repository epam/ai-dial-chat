## 1. Disable the frontend history fetch (implemented)

- [x] 1.1 Remove the `getCatalogPublishHistory`/`mapPublishHistoryEntryDto` call from `CatalogView.tsx`'s `getPublishHistory` callback; make it always resolve `[]`.
- [x] 1.2 Remove the now-unused `getCatalogPublishHistory` and `mapPublishHistoryEntryDto` imports from `CatalogView.tsx`.
- [x] 1.3 Update `CatalogView.spec.tsx`: drop the `getCatalogPublishHistory` mock and its history-mapping/error-propagation tests, and replace them with one asserting `getPublishHistory` always resolves `[]`.
- [x] 1.4 Verify: `npm exec nx test chat -- CatalogView` and `npm exec nx lint chat` both pass.

## 2. Follow-up once the backend is fixed (#7897)

- [ ] 2.1 Confirm `GET /api/v1/catalog/{entityType}/{entityId}/publish-history` no longer returns 503 in the target environment.
- [ ] 2.2 Restore the `getCatalogPublishHistory` call in `CatalogView.tsx`'s `getPublishHistory` (call the API, map with `mapPublishHistoryEntryDto`) using this change's git history as the reference implementation.
- [ ] 2.3 Restore `CatalogView.spec.tsx`'s history-mapping and fetch-failure tests.
- [ ] 2.4 Run `openspec archive` (or the equivalent lifecycle step) for this change alongside `disable-conversation-publish-history-fetch` once both fetches are restored.
