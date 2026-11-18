# Tasks

## 1. Backend: shared target derivation and target-exists 409

- [ ] 1.1 Extract `resolvePublishTarget` from `PublishService.publish` into `publish-target.util.ts` and call it from `publish`; verify the existing publish specs pass unchanged and a new unit test covers application, toolset, prompt, skill and project targets.
- [ ] 1.2 Add the `PublishConflictCode` enum (`target-exists`) and a documented `409` response DTO; verify `npm run openapi` produces the schema and `npm run openapi:check` passes.
- [ ] 1.3 Export one metadata existence helper from `dial-resource-transfer.ts`, add `Projects` (`listProjectMetadata`) to it and make `existsQuietly` wrap it; verify its existing tests pass and new unit tests cover `200`, `404` and an error status for each of the five types.
- [ ] 1.4 Convert a failed `createPublication` (`400`/`409`) into `ConflictException` with `code: 'target-exists'` when the quiet read finds the target or Core's message matches "already exists"; verify unit tests cover found, hidden-but-message-matches, unrelated `400` unchanged, and `502` unchanged, and that no token or body is logged.
- [ ] 1.5 Update the publish controller's `@ApiResponse` for `409` and the `catalog-publish-api` references in `apps/chat-api` docs if the endpoint list is documented; verify `npm exec nx test chat-api` and `npm exec nx lint chat-api` pass.

## 2. Backend: target-check endpoint

- [ ] 2.1 Add `GET /catalog/:entityType/:entityId/publish-target` with a validated query DTO (`folderPath`, optional `version`) and a response DTO `{ exists }`, delegating to a service method that uses `resolvePublishTarget` and the existence read; verify controller and service specs cover `true`, `false`, version-changed target, validation `400`, and Core failure mapping.
- [ ] 2.2 Regenerate the client with `npm run openapi`, then build and lint `chat-api-client`; verify `npm run openapi:check` passes.

## 3. Publish panel library

- [ ] 3.1 Add `onCheckTargetExists`, `isTargetTakenError`, `isTargetTaken` and `isTargetChecking` to `usePublishFlow` with stale-answer discard, session-folder and own-history skips, and failure-does-not-block; verify hook tests cover every scenario in the `publish-panel-library` delta spec.
- [ ] 3.2 Extend `derivePublishState` and `PublishPanel` with the target-taken callout kind, precedence order, disabled submit and the `targetTakenLabel`/`targetTakenVersionedLabel` pair chosen by the resource's version; verify tests cover precedence, the loading state and the label choice, and that the callout is announced through the existing live-region.
- [ ] 3.3 Update `libs/publish-panel/README.md` for the new option, result fields and label, and check RTL for the new callout; verify `npm run validate:docs` passes.

## 4. Host wiring and text

- [ ] 4.1 In `libs/chat-hooks` add `checkPublishTarget` to `createPublishApiClient`, `PublishTargetTakenError` with its code reader (reusing `getApiErrorDetails`) and the `usePublishTargetGuard` hook (`onCheckTargetExists`, `isTargetTakenError`, `wrapPublish`), export them and update the lib README; verify unit tests cover `409 target-exists` becoming `PublishTargetTakenError`, other errors passing through, and a rejected check.
- [ ] 4.2 Thinly wire the catalog panel (`useDetailsPublish`, `DetailsPanel` and the props threaded from `CatalogView`) and the project panel (`PublishProjectPanelContainer`) to `usePublishTargetGuard` and the translated labels, with no request or error logic of their own; verify component tests cover the callout and disabled Publish for an application (with version text) and for a prompt, skill and project (without).
- [ ] 4.3 Update `usePublishErrorNotification` to show the translated target-taken text instead of Core's raw message, and add the translation keys (with and without version, for the callout and for the notification) to `translation-keys.ts` and `en.json`; verify the notification test and `npm run validate:specs` pass.

## 5. Integration

- [ ] 5.1 Run `npm exec nx run-many -t lint,test -p chat-api,chat,chat-hooks,publish-panel,catalog` and `npm run validate:docs`, `npm run validate:specs`; verify all pass.
- [ ] 5.2 Manual verification with the user: reproduce the duplicate publish with two users and read Core's status and text from the existing `chat-api` warn log; confirm the callout, the `409` text and that a free folder is unaffected; record the observed Core reply in the design if it differs from the assumption.
