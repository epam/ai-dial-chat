## 1. Backend — publish request carries the flag

- [x] 1.1 Add optional `publishCredentials?: boolean` to `apps/chat-api/src/publish/dto/publish-catalog-entity.dto.ts` with `@ApiPropertyOptional`, `@IsOptional()`, `@IsBoolean()`
- [x] 1.2 Add the parameter to `PublishService.publish` and set `publishCredentials: true` on the single `ADD` resource only when truthy (omit the property otherwise)
- [x] 1.3 Pass the body field through `PublishController.publish`, and extend its `@ApiOperation` description to say what the flag does and that it does not change authorization
- [x] 1.4 Unit tests in `apps/chat-api/src/publish/tests/` — true sets the property, false omits it, absent omits it, non-boolean is rejected by the `ValidationPipe`, unpublish rejects the field via `forbidNonWhitelisted`
- [x] 1.5 Verify: `npm run test:file -- apps/chat-api/src/publish/tests/publish.service.spec.ts` (and the controller/DTO specs touched), then `npm exec nx lint chat-api`

## 2. Backend — publish history reports the flag

- [x] 2.1 Add `publishCredentials?: boolean` to `PublicationResourceLike` in `apps/chat-api/src/publish/publication.util.ts`
- [x] 2.2 Add a `getPublicationSourceCredentials(publication, sourceUrl): boolean` helper beside `getPublicationSourceAction`, reading the flag off the same matched resource and defaulting to `false`
- [x] 2.3 Add required `publishCredentials: boolean` to `PublishHistoryEntryDto` with `@ApiProperty`, and populate it in `PublishService.getPublishHistory`
- [x] 2.4 Unit tests — flag `true`, flag `false`, property absent → `false`, and a regression assertion that narrowing/ordering/`DELETE`-cancellation behaviour is unchanged
- [x] 2.5 Verify: `npm run test:file -- apps/chat-api/src/publish/tests/publication.util.spec.ts` plus the history service spec, then `npm exec nx lint chat-api`

## 3. Regenerate the OpenAPI spec and client

- [x] 3.1 Run `npm run openapi` and commit the regenerated `libs/chat-api-client` output — no hand edits
- [x] 3.2 Run `npm run openapi:check` and confirm it passes
- [x] 3.3 Verify: `npm exec nx build chat-api-client && npm exec nx lint chat-api-client`

## 4. `libs/publish-panel` — the control and its state

- [x] 4.1 Add `publishCredentials`/`setPublishCredentials` state to `usePublishFlow`, initialised `false`, cleared in `reset()`, and passed as the fifth argument to `onPublish`
- [x] 4.2 Extend `UsePublishFlowOptions['onPublish']` and `UsePublishFlowResult` types + JSDoc, keeping four-parameter host callbacks assignable
- [x] 4.3 Add `publishCredentials`, `onPublishCredentialsChange`, and `labels.credentialsLabel`/`labels.credentialsHint` to `PublishPanelProps`, rendering the ui-kit 2.0 `Checkbox` (`labelProps` + `caption`) inside the destination block only when `onPublishCredentialsChange` is supplied, disabled while `isSubmitting`
- [x] 4.4 Add `publishCredentials?: boolean` to `PublishHistoryEntry` and render the `sharedCredentialsLabel` marker (text, any icon `aria-hidden`) in `PublishHistoryList`
- [x] 4.5 Tests — `use-publish-flow.spec.ts`: defaults to `false`, `reset()` clears it, history never pre-selects it, `handleSubmit` passes it; `PublishPanel.spec.tsx`: renders only with the handler, toggles, disabled while submitting, caption is the accessible description; `PublishHistoryList.spec.tsx`: marked and unmarked rows
- [x] 4.6 Update `libs/publish-panel/README.md` — new props, labels, and the `PublishHistoryEntry` field, with examples that compile against the current API
- [x] 4.7 Verify: `npm run test:file -- libs/publish-panel/src/utils/use-publish-flow.spec.ts` and the two component specs, then `npm exec nx lint publish-panel`

## 5. `libs/catalog` — offer the control for eligible toolsets

- [x] 5.1 Derive eligibility in `DetailsPanel` from `item.type`, `item.credentials.authenticationType`, and `userStatus`/`globalStatus`; pass `onPublishCredentialsChange` to `PublishPanel` only when eligible
- [x] 5.2 Extend `onPublish` in `libs/catalog/src/models/item-details-props.ts` and `catalog-props.ts` to the fifth argument, and thread `credentialsLabel`/`credentialsHint`/`sharedCredentialsLabel` through the existing `publishLabels` prop
- [x] 5.3 Tests in `libs/catalog/src/components/Details/tests/` — control shown for OAuth+signed-in and ApiKey+signed-in; hidden for `None`, for signed-out, for a missing `credentials`, and for non-toolset types; shown for a non-administrator; cleared on reopen after a publish; value reaches `onPublish`
- [x] 5.4 Update `libs/catalog/README.md` for the `onPublish` signature and the new labels
- [x] 5.5 Verify: `npm run test:file -- <the DetailsPanel specs touched>`, then `npm exec nx lint catalog`

## 6. `libs/chat-hooks` — map the history field

- [x] 6.1 Map `publishCredentials` in `mapPublishHistoryEntryDto` (`libs/chat-hooks/src/catalog/publish.ts`)
- [x] 6.2 Test in `libs/chat-hooks/src/catalog/tests/publish.spec.ts` — `true`, `false`, and absent
- [x] 6.3 Verify: `npm run test:file -- libs/chat-hooks/src/catalog/tests/publish.spec.ts`, then `npm exec nx lint chat-hooks`

## 7. `apps/chat` — wire the flow end to end

- [x] 7.1 Forward the flag from `useCatalogPublishing.handlePublish` into `publishCatalogEntity`, omitting the body field entirely when `false`
- [x] 7.2 Leave the synthesised public-copy history entry in `getPublishHistory` without the flag (absent reads as `false`)
- [x] 7.3 Add `catalog.publish.credentialsLabel`, `catalog.publish.credentialsHint`, and `catalog.publish.historySharedCredentials` to `apps/chat/src/i18n/locales/en.json` and `CatalogI18nKeys`, and pass all three through `publishLabels` in `CatalogView`
- [x] 7.4 Tests — `useCatalogPublishing` sends the field when `true` and omits it when `false`/absent; `CatalogView` supplies the three labels
- [x] 7.5 Verify: `npm run test:file -- apps/chat/src/hooks/useCatalogPublishing/tests/useCatalogPublishing.spec.ts` (and the CatalogView spec touched), then `npm exec nx lint chat`

## 8. Manual verification against a live DIAL Core

- [ ] 8.1 Publish an authenticated toolset with the option ticked; after administrator approval, confirm from a second account with no personal credential that the catalogue card shows no `"Authorize to use this toolset."` and that invoking the toolset succeeds (AC5–AC7)
- [ ] 8.2 Publish the same toolset with the option clear; confirm the second account is asked to authorise (AC8)
- [ ] 8.3 Confirm the credential value is nowhere in the second account's UI or in any `/api/v1/catalog/**` response (AC9)
- [ ] 8.4 Confirm the publisher's own access to their personal copy is unchanged after unpublishing (AC10), and that an administrator can log out the organization credential without deleting the publication (AC11)
- [ ] 8.5 Confirm `GET /api/v1/catalog/toolset/{id}/publish-history` reports `publishCredentials` correctly for both publications (AC12)

## 9. Documentation and full verification

- [x] 9.1 Run `npm run validate:docs` after the two README updates and fix anything it reports
- [x] 9.2 Confirm `docs/architecture.md` needs no change (no new lib, app, backend domain, context, route, or `ApiEndpoints` member) and record that in the PR description
- [ ] 9.3 Run `npm run verify:full` once, and `npm run build:quiet` since the generated client changed
- [ ] 9.4 Run the five-axis quality review (`.claude/skills/code-review-and-quality/SKILL.md`) before merge
