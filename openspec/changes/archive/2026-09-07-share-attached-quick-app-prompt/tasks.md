## Tasks

- [x] Generalize `ShareService.getRelatedResourceUrls` to dispatch by resource kind (conversations / applications / else).
- [x] Extract the existing conversation walk into `getConversationRelatedResourceUrls` (behavior unchanged).
- [x] Add `getApplicationRelatedResourceUrls`: parse `applications/{bucket}/{path}`, call `getCustomApplication`, collect `dial-prompt` skill urls, filter cross-bucket.
- [x] Add `collectApplicationPromptResourceUrls` defensive pure helper (opaque `application_properties`, `isPromptResourceUrl` filter, dedup).
- [x] Export `collectApplicationPromptResourceUrls` for direct unit testing.
- [x] Update `share.service.spec.ts`: mock `getCustomApplication`; add integration tests for app prompt sharing (single, dedup, cross-bucket drop, public-bucket keep, no skills, no application_properties, lookup reject / upstream error / no data).
- [x] Update the existing "non-conversation item" test to a skill itemId asserting neither `getConversation` nor `getCustomApplication` is called.
- [x] Add direct unit tests for `collectApplicationPromptResourceUrls` edge cases.
- [x] Update `openspec/specs/conversation-share/spec.md`: carve out the application exception and add the "Sharing an application includes its attached prompt resources" requirement with scenarios.
- [x] Run `npm run test:file -- apps/chat-api/src/share/tests/share.service.spec.ts` (pass).
- [x] Run `nx lint chat-api` (clean) and `nx build chat-api` (clean).
