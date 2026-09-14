## Why

The author shown in the catalog's **Hosted by** row is always the person who clicked Publish. Nothing in the create, edit, or publish flow offers the field, so a toolset maintained by a team is permanently attributed to an individual — and the only correction is an administrator opening the publication in the admin panel and hand-editing `displayAuthor` in the JSON editor, which ordinary publishers cannot do and which leaves the catalog wrong until someone intervenes ([#8727](https://github.com/epam/ai-dial-chat/issues/8727)).

DIAL Chat 1.0 had this: its publish request form carried an editable **Author** field, pre-filled with the requester's name and placed directly under the destination folder. This change brings that field back to the Chat NG publish flow so the displayed author can be set at publish time.

## What Changes

- **Publish panel gains an Author field.** `PublishPanel` (shared by the catalog details panel and the standalone conversation publish panel) renders a labelled, optional single-line text input directly below the destination-folder picker and its callout, above the access-rules section — matching 1.0's placement.
- **`usePublishFlow` owns the author state.** The hook gains `author` / `setAuthor`, seeds it from a new `defaultAuthor` option, resets it with the rest of the flow state, and passes the current value to `onPublish`.
- **`onPublish` gains the author.** The publish callback signature changes from `(item, folderPath, rules)` to `(item, folderPath, rules, author)`, and the same extra argument is threaded through `PublishPanelProps` / `StandalonePublishPanelProps` / the catalog `DetailsPanel` and `Catalog` props. **BREAKING** for `@epam/ai-dial-publish-panel` and `@epam/ai-dial-catalog` consumers that implement `onPublish` with a positional signature.
- **The host supplies the prefill.** Library isolation forbids `libs/publish-panel` and `libs/catalog` from reading session claims, so `apps/chat` resolves the publisher's display name through the existing `useUserProfile` hook and passes it down as `defaultAuthor`.
- **Both publish endpoints accept an optional author.** `PublishCatalogEntityDto` and `PublishConversationDto` gain a validated, optional `author` field; `PublishService.publish` and `ConversationPublishService.publish` forward it to DIAL Core as `displayAuthor`.
- **Empty means unchanged behaviour.** When the field is cleared or omitted, both controllers fall back to `getUserDisplayName(claims)` exactly as they do today, so every existing caller and the generated client's older call shape keep working.
- Unpublish is untouched: a removal request's `displayAuthor` identifies the requester, not the published entity's author.
- New user-visible strings (field label, placeholder, hint) are added as i18n keys in `apps/chat`, with English defaults on the lib props.

## Capabilities

### New Capabilities

None. The change extends the existing publish capabilities rather than introducing a new one.

### Modified Capabilities

- `publish-panel-library`: `PublishPanel` renders an author field and `usePublishFlow` owns the author state, seeded from a host-supplied `defaultAuthor` and passed to `onPublish`.
- `catalog-publish-api`: `POST /api/v1/catalog/{entityType}/{entityId}/publish` accepts an optional, validated `author` used as the publication's `displayAuthor`, falling back to the session-derived display name.
- `catalog-publish-flow`: The catalog publish panel shows the author field pre-filled with the current user's display name and sends the submitted value with the publish request.
- `conversation-publish-api`: `POST /api/v1/conversations/publish` accepts the same optional `author` field with the same fallback.
- `conversation-publish-flow`: The standalone conversation publish panel shows the same pre-filled author field and sends its value.

## Impact

**Libraries**

- `libs/publish-panel/src/components/PublishPanel/PublishPanel.tsx` — new field, new props, new labels
- `libs/publish-panel/src/components/PublishPanel/StandalonePublishPanel.tsx` — prop pass-through
- `libs/publish-panel/src/utils/use-publish-flow.ts` — `defaultAuthor` option, `author`/`setAuthor` result, reset and submit wiring
- `libs/catalog/src/components/Details/DetailsPanel.tsx`, `libs/catalog/src/components/Catalog/Catalog.tsx`, `libs/catalog/src/models/{catalog-props,item-details-props}.ts` — `publishDefaultAuthor` prop and updated `onPublish` signature
- `libs/publish-panel/README.md`, `libs/catalog/README.md` — documented props and examples

**App (`apps/chat`)**

- `apps/chat/src/components/CatalogView/CatalogView.tsx` — supplies `publishDefaultAuthor` and the new labels
- `apps/chat/src/hooks/useCatalogPublishing/useCatalogPublishing.ts` — `handlePublish` forwards `author`
- `apps/chat/src/components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx` — supplies `defaultAuthor`, labels, and forwards `author`
- `apps/chat/src/server-api/conversation-publish.api.ts` — `publishConversation` takes `author`
- `apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/i18n/locales/en.json` (+ every other locale file) — new keys

**Backend (`apps/chat-api`)**

- `apps/chat-api/src/publish/dto/publish-catalog-entity.dto.ts`, `apps/chat-api/src/conversations/dto/publish-conversation.dto.ts` — new optional `author`
- `apps/chat-api/src/publish/publish.controller.ts`, `apps/chat-api/src/conversations/conversation-publish.controller.ts` — fallback to `getUserDisplayName(claims)`
- `apps/chat-api/src/publish/publish.service.ts`, `apps/chat-api/src/conversations/conversation-publish.service.ts` — JSDoc only; the `displayAuthor` wiring already exists

**Contract**

- OpenAPI regeneration (`npm run openapi`, `npm run openapi:check`) and a rebuild of `libs/chat-api-client`, since both request DTOs change.
- No DIAL Core change: `displayAuthor` is already part of Core's `createPublication` body and is what surfaces as the deployment's `owner`, i.e. the catalog's **Hosted by** row.
