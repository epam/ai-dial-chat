## Why

A published copy lives at `{type}/public/{folder}/{name}` (applications and toolsets: `{name}__{version}`). The path has no author segment, so two authors' resources with the same name (and version) address the same target. DIAL Core never overwrites a published resource and rejects the second publication with "Target resource already exists: {targetUrl}". Today the user cannot tell the target is taken: the publish panel shows the generic "Publishing failed. Please try again." callout and the raw Core message in the notification ([GitHub issue #9746](https://github.com/epam/ai-dial-chat/issues/9746)).

## What Changes

- **Publish endpoint answers `409` with `code: target-exists`** when the derived target already holds a resource. The backend recognises Core's rejection (status 400 or 409 with an "already exists" message) and confirms it by reading the target's metadata with the caller's own token, the same approach `transferDialResource`, the project rename and the files batch move already use. The message text is a second signal, so a copy hidden from the caller by access rules is still reported.
- **New target-check endpoint** (`GET /api/v1/catalog/{entityType}/{entityId}/publish-target`, answer `{ exists: boolean }`) that derives the target with the same function the publish uses and reads its metadata with the caller's token.
- **Publish panel pre-check.** When a destination folder is selected (or the item's version changes while one is selected), the panel asks the host whether the target is taken. While the request runs Publish is disabled; a taken target shows a warning callout under the destination row and keeps Publish disabled; a failed check does not block (the `409` on submit still covers it). A folder created in the current session is not checked.
- **Clear error text on submit.** A `409 target-exists` replaces the generic submit-error callout and the notification text with "rename it (or change its version) or choose another folder". Resources without a version (prompts, skills, projects) get a text without the version part.
- **Shared publish-target derivation.** The target path calculation moves out of `PublishService.publish` into one function used by publish and by the target check, so the two always address the same path.

Out of scope: making published paths unique (suffixes, IDs); conversations (they have their own publish service and panel container); the org-unit copy endpoint (it already answers `409`); any probing of DIAL Core as part of development or verification.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `catalog-publish-api`: the publish endpoint's `409 target-exists` answer with its error body, and the target-check endpoint.
- `catalog-publish-flow`: the pre-check in the catalog and project publish panels (callout, disabled Publish, loading and failure behaviour, re-check on version change) and the clear error text on submit.
- `publish-panel-library`: `usePublishFlow` option and result for the target check, and the new callout kind in `derivePublishState`/`PublishPanel`.

## Impact

- `apps/chat-api/src/publish/`: `publish.service.ts`, `publish.controller.ts`, `publish-target.util.ts`, new DTOs and error-code enum; `npm run openapi` regenerates `libs/chat-api-client`.
- `libs/publish-panel`: `use-publish-flow.ts`, `publish-state.ts`, `PublishPanel.tsx`, models and README (public API, labels).
- `libs/chat-hooks/src/catalog`: error-code mapping and the target-check call.
- `libs/catalog` (`useDetailsPublish`, `DetailsPanel`) and `apps/chat` (`CatalogView`, `PublishProjectPanelContainer`, `usePublishErrorNotification`, `server-api/publish.api.ts`, `en.json`, `translation-keys.ts`).
- Docs: `libs/publish-panel/README.md`, `apps/chat-api` docs if the endpoint list is documented, `npm run validate:docs` and `npm run validate:specs`.
