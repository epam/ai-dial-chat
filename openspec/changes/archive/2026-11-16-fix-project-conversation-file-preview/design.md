## Context

A project conversation's model call carries `x-project-id` (`project-conversations-api`). An agent answering it saves its outputs inside the project and returns them as message attachments. Their `url` is a DIAL Core resource id of the form `projects/{bucket}/{projectPath}/files/{filePath}`, percent-encoded segment by segment. The SDK's subscription docs describe a file inside a project as `{resource url}/files/{path}`. The BFF stores and streams messages unchanged, so the client receives that id as is.

The app already maps two project locators to BFF routes, for the project pages' own cards:

| Locator the app builds | Route |
| --- | --- |
| `{projectId}/files/context/{name}` (`toProjectContextFileUrl`) | `GET /api/v1/projects/:id/files/:fileName` |
| `{projectId}/files/artifacts/{name}` (`toProjectArtifactUrl`) | `GET /api/v1/projects/:id/artifacts/:fileName` |

`resolveProjectFileDownloadUrl` (`apps/chat/src/utils/dial-file.ts`) does this mapping:

- it splits the locator at the **last** `/files/context/` or `/files/artifacts/`;
- it requires a single-segment name;
- it applies `encodeURIComponent` to the raw strings.

Its inputs have always been unencoded, so it works for the cards. A Core id is already encoded, so it gets encoded twice. The BFF then decodes `:id` once, finds `%` in a segment, and `parseProjectId` answers `400`. That is issue #9853.

The other attachment surfaces never reach that function, because they gate on `isDialFileId` (`files/…`):

- `downloadAttachment` and `isDownloadableAttachment` in `libs/chat-hooks/src/attachment/useAttachmentAction/useAttachmentAction.ts`;
- `resolveCatalogIconUrl` in `apps/chat/src/utils/icon-path.ts`, which builds image thumbnails;
- `resolvePlayUrl` in `apps/chat/src/utils/attachment-display-resolvers.ts`.

On the BFF, `ProjectArtifactParamDto.fileName` is validated with `IsDialEntityName`. That rule is for names a user types, it rejects `/`, and the snapshot classifies nested `artifacts/…` paths that no route can then serve.

## Goals / Non-Goals

**Goals:**

- A Core-encoded project file id under `context/` or `artifacts/` opens, downloads, shows its thumbnail and plays wherever an attachment renders.
- An output in a sub-folder of `artifacts/` can be fetched by any reader of the project.
- The project pages' own cards keep their current URLs and behaviour.
- No new route, operation or client method.

**Non-Goals:**

- A route for other project folders.
- Listing nested outputs.
- Nested context files.
- Caching project files.
- Changing stored messages.

## Decisions

### D1. Decode the locator before encoding it; split at the first `/files/`

`resolveProjectFileDownloadUrl(url)` SHALL work as follows:

1. Require the `projects/` prefix.
2. Find the **first** `/files/` after `projects/{bucket}/`. The project id is everything before it, and the in-project path is everything after it.
   - `files` is in DIAL Core's reserved names (`RESERVED_NAMES` in `apps/chat-api/src/common/validators/dial-entity-name.validator.ts`), so no real project path has a `files` segment. The first occurrence is therefore always the right split, even when an output path itself contains `files/artifacts/`.
   - The current last-match rule exists only for the test `projects/b/files/context/team/files/artifacts/report.pdf`, whose project path is impossible. That test changes.
3. Split the project id and the in-project path on `/`, and decode every segment with `decodeURIComponent`.
   - A segment that throws (a malformed escape) makes the whole locator resolve to `undefined`, so no request is sent and the canvas shows Unsupported.
   - A segment that is empty after decoding also resolves to `undefined`.
4. Route the in-project path by its first segment:
   - `context` followed by exactly one segment maps to `…/files/{name}`;
   - `artifacts` followed by one or more segments maps to `…/artifacts/{segments joined by '/'}`;
   - anything else resolves to `undefined`.
5. Build the URL as `${ApiEndpoints.PROJECTS}/${encodeURIComponent(projectId)}/{route}/${encodeURIComponent(relativePath)}`.

**Why decoding is safe for the app's own locators.** `%` is forbidden in a DIAL name, both by `isValidDialEntityName` and by `isSafeDialPathSegment`. An unencoded locator therefore contains no `%`, and `decodeURIComponent` leaves it unchanged. One function serves both sources, and the existing card scenarios keep their exact URLs.

**Alternative considered.** Keep two functions, one for Core ids and one for app locators. Rejected: both run on `attachment.url`, so the caller cannot tell the two sources apart.

### D2. The artifact route takes an encoded relative path in the existing `:fileName`

`GET /api/v1/projects/:id/artifacts/:fileName` keeps its path, param name and `operationId`. `:fileName` is now a path relative to `artifacts/`, URL-encoded into one segment, the same way `:id` carries `projects/{bucket}/{path}`. Express decodes it once, so `run-1%2Fdata.csv` arrives as `run-1/data.csv`.

- **Validation.** `ProjectArtifactParamDto.fileName` SHALL be `@IsString()` plus a new `@IsSafeDialRelativePath()` decorator. The decorator splits on `/` and requires every segment to pass `isSafeDialPathSegment`. That rejects:
  - an empty segment, which also covers a leading or trailing `/` and `//`;
  - `.`, `..` and other reserved names;
  - `\`, `%`, control and bidi characters;
  - segments above 1,024 UTF-8 bytes.

  The whole path is capped at 4,096 UTF-8 bytes.
- **Why `isSafeDialPathSegment` and not `IsDialEntityName`.** Outputs are written by agents, not typed by users. The stored-path rule is the one the BFF already applies to stored names, such as conversation files that carry a `:`. It is strictly looser than the entity-name rule on characters and length, and stricter on nothing. So every name the route accepted before is still accepted.
- **Core call.** `downloadProjectFile(bucket, encodeDialResourcePath(path), encodeDialResourcePath('artifacts/' + relativePath))`. `encodeDialResourcePath` already encodes per segment and keeps `/`.
- **Disposition.** The `Content-Disposition` name is the last segment, so a nested output saves as `data.csv`, not `run-1/data.csv`.
- **Generated client.** It is regenerated for the new param description. `downloadProjectArtifactRaw({ id, fileName })` is unchanged, and the client encodes `fileName` with `encodeURIComponent`, which yields the expected single segment.

**Alternatives considered.**

- A wildcard route, `:id/artifacts/*path`. Nest 11 with Express 5 supports it, but `@nestjs/swagger` emits a param the generator turns into a raw-path method, and the route would sit apart from every other per-project param. Rejected.
- A new `?path=` query route. Rejected: it adds a second operation for the same resource.

### D3. One project-file id predicate in `libs/chat-hooks`; URL building stays in the app

`libs/chat-hooks/src/files/dial-file.ts` gains a pure `isDialProjectFileId(url)`. It is true for `projects/{bucket}/{…}/files/{…}` with a non-empty path after `/files/`, ignoring a `#…` fragment, and false for a folder id (trailing `/`).

- `isDownloadableAttachment` and `downloadAttachment` accept a project file id as they accept a `files/` id, and pass it to the host's injected `resolveDownloadUrl`. When that returns `undefined`, nothing is downloaded and `false` is returned, as today.
- The host still decides the URL. The library knows a DIAL Core id shape and never an `/api` route. That stays within the `chat-hooks` exception in `AGENTS.md`.

In the app:

- `useAttachmentAction`'s `resolveDownloadUrl` becomes a small app function. It delegates to `resolveDialFileDownloadUrl` for a `files/` id and to `resolveProjectFileDownloadUrl` for a project id.
- `resolveCatalogIconUrl` and `resolvePlayUrl` use that same function for project ids, so the thumbnail, the tile download, the canvas and playback all request one URL.

**Alternative considered.** Teach `isDialFileId` to accept `projects/…`. Rejected: `isDialFileId` feeds `resolveDialFileBucketAndPath` and the `/api/v1/files/*` routes, which cannot serve a project file.

### D4. Project files stay uncached

`resolveAttachmentFileId` returns `undefined` for a project id. `fetchCurrentEtag` therefore skips the metadata call, and the content fetch bypasses the LRU cache, as the project context-file preview already specifies. No change is needed.

## Risks / Trade-offs

- **[Risk] Core's exact id shape differs from `{project id}/files/{path}`,** for example with an extra version segment. → Mitigation: the first implementation task captures a real attachment `url` from a project chat on a dev stand, and the resolver tests are built on it before any code changes. When the shape differs, D1 is amended before the code is written.
- **[Risk] A proxy in front of the BFF normalizes `%2F` in the path.** → Mitigation: `:id` already depends on `%2F` surviving, so this adds no new requirement on the deployment.
- **[Trade-off] Outputs outside `context/` and `artifacts/` stay unreachable from a chat.** A reader can still get them through the project archive download. See Open questions.
- **[Trade-off] Decoding makes `Q4%20deck.pptx` and `Q4 deck.pptx` the same locator.** Both name the same Core resource, so this is correct. It is called out only because the function now accepts both forms.

## Migration Plan

- Deploy the BFF and the app together. The new app sends nested `:fileName` values that the old BFF rejects with `400`. An old app against the new BFF keeps working, because it never sends a nested path.
- Rollback is a revert. No stored data changes.

## Open Questions

- Should a project reader be able to fetch any file of the project from a chat, outside `context/` and `artifacts/`? It would need a third route, or a generalized one, and a product decision on whether `conversations/` stays private to the chat views. That is out of scope here, and the decision is recorded for a follow-up issue.
