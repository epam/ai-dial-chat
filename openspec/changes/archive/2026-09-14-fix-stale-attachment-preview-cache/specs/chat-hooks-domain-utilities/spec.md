## MODIFIED Requirements

### Requirement: Attachment-canvas content resolution takes DIAL-URL resolution as an injected parameter

`@epam/ai-dial-chat-hooks` SHALL export `apps/chat/src/utils/attachment-canvas.ts`'s content-resolution functions (blob/text fetch with caching, PDF/Image/HTML/JSON/Visualizer content builders, `getUrlFileName`, `isExternalSourcePreviewable`, `clearAttachmentCache`), taking an injected `resolvers: AttachmentCanvasUrlResolvers` parameter (`resolveDialFileDownloadUrl`, `resolveDialUrl`, `resolveDialFileMetadataUrl`) in place of the host-owned pieces of `./dial-file` those functions read today. `isDialFileId` is already a pure export of the moved `dial-file.ts` module, so it is imported directly rather than injected. `apps/chat` SHALL supply `resolveDialFileDownloadUrl`/`resolveDialUrl`/`resolveDialFileMetadataUrl` from its own `dial-file.ts` at its call site.

#### Scenario: Caching behavior is unaffected by the injected parameter

- **WHEN** the same attachment is resolved twice with the same injected resolvers, and freshness validation (see `chat-hooks-attachment-cache-freshness`) confirms the resource's `etag` is unchanged between the two resolutions
- **THEN** the second resolution is served from the existing LRU cache without re-fetching content, matching pre-move behavior for the unchanged case

#### Scenario: A changed resource is no longer served from the LRU cache

- **WHEN** the same attachment URL is resolved twice with the same injected resolvers, but the resource's `etag` differs between the two resolutions (the underlying content changed)
- **THEN** the second resolution discards the stale cache entry and fetches fresh content, rather than unconditionally replaying the first resolution's cached body as the pre-move behavior did
