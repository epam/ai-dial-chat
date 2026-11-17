## Why

A file the assistant generates in a project conversation does not open. Clicking it shows the canvas load error "Failed to load file", and Retry fails the same way (issue #9853, `1.4.0-dev.5`).

The canvas shows that error only after a request was sent and failed with a status other than `403`. When a URL resolves to nothing, it shows the Unsupported state instead (`useOpenAttachmentCanvas` in `libs/attachment-canvas`). So the app builds a download URL, and the BFF rejects it.

**Root cause.** DIAL Core addresses a file inside a project as `{project id}/files/{path}`, that is `projects/{bucket}/{projectPath}/files/{filePath}`. The SDK's subscription docs describe it that way, and Core percent-encodes every segment of the URL, as it does for `files/{bucket}/{path}`. An agent's output in a project conversation therefore arrives as an attachment such as `projects/a1b2c3/Q4%20launch/files/artifacts/report%20v2.md`.

`resolveProjectFileDownloadUrl` (`apps/chat/src/utils/dial-file.ts`) was written for the locators the app builds itself for the Context and Outputs cards (`toProjectContextFileUrl`, `toProjectArtifactUrl`), whose segments are not encoded. It never decodes, so it encodes a second time:

```
projects/a1b2c3/Q4%20launch/files/artifacts/report.md
→ /api/v1/projects/projects%2Fa1b2c3%2FQ4%2520launch/artifacts/report.md
→ the BFF decodes :id to projects/a1b2c3/Q4%20launch
→ parseProjectId rejects '%' → 400 → "Failed to load file"
```

`resolveDialFileBucketAndPath` decodes a `files/` id for exactly this reason. No test covers an encoded project locator.

The same attachment fails in three more places, for a second reason: they accept only `files/` ids.

- **Tile download.** `downloadAttachment` in `libs/chat-hooks/src/attachment/useAttachmentAction/useAttachmentAction.ts` does nothing.
- **Image thumbnail.** `resolveCatalogIconUrl` treats the id as a theme icon name, so the thumbnail is broken.
- **Audio playback.** `resolvePlayUrl` gets no URL, so audio does not play.

**Nested outputs.** Agents also save outputs in sub-folders (`artifacts/run-1/data.csv`). The snapshot already keeps such entries (`artifactEntries`, in the `project-detail-api` capability). However, the app's resolver and `GET /api/v1/projects/:id/artifacts/:fileName` both accept only a single segment, so a nested output cannot be previewed or downloaded from a chat.

## What Changes

**1. App: resolve DIAL Core's project file ids**

- `resolveProjectFileDownloadUrl` decodes the project id and the file path segment by segment before encoding them for the route.
  - Decoding is safe for the app's own unencoded locators, because a DIAL name cannot contain `%` (`isSafeDialPathSegment`).
  - A malformed escape resolves to nothing.
- The project id ends at the first `/files/` segment. `files` is a name DIAL Core reserves (`RESERVED_NAMES`), so no project path segment can be `files`. This replaces the current rule, which splits at the last matching folder segment.
- An output path may have more than one segment. It maps to the artifact route with the whole relative path in `:fileName`. A context file stays single-segment.
- **Thumbnail, tile download and audio.** They resolve a project file id through the same function, so preview, download and playback work for one attachment everywhere it appears.

**2. BFF: download a nested output**

- `GET /api/v1/projects/:id/artifacts/:fileName` accepts a path relative to `artifacts/`, URL-encoded into one segment as `:id` already is.
  - For example, `run-1%2Fdata.csv` maps to `artifacts/run-1/data.csv`.
  - Each segment is checked with `isSafeDialPathSegment`, the rule for stored names. It rejects separators other than `/`, `%`, control and bidi characters, and `.`, `..` and other reserved names.
  - `IsDialEntityName` is dropped here. It is the rule for names a user types, and it also forbids characters an agent may legitimately write, such as `:` and `,`.
- The route name, the param name and the `operationId` stay the same, so `downloadProjectArtifactRaw({ id, fileName })` keeps its signature. Only the param description and the OpenAPI document change, and the client is regenerated.
- The `Content-Disposition` file name is the last path segment.

**3. Tests, specs and docs**

- Add unit tests for the resolver with encoded and nested ids.
- Add DTO and supertest cases for nested paths and traversal.
- Add a project-chat test that opens a generated file.
- Update the `apps/chat-api/README.md` route table and the four capability specs below.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-detail-api`: the artifact download takes a relative path under `artifacts/` with per-segment validation, and the per-project routes table describes the new `:fileName` rule.
- `project-view-ui`: the output-locator mapping decodes Core-encoded ids, splits at the first `/files/` segment and maps nested output paths.
- `project-context-file-preview`: the context-locator mapping decodes Core-encoded ids; context files stay single-segment.
- `project-conversations-ui`: a file attachment in a project conversation's message opens, downloads, shows its thumbnail and plays through the project file routes.

## Non-goals

- Files an agent writes outside `context/` and `artifacts/`, such as `projects/…/files/tmp/x.csv`. The BFF exposes no route for other folders. Such an attachment still opens the Unsupported state, with no download. Exposing every project path is a separate decision about what a project reader may fetch (design, Open questions).
- Listing nested outputs in the Outputs section. It still lists direct children only (`project-view-ui`).
- Nested context files. `context/` stays flat, as create and edit enforce.
- ETag-validated caching for project files. They have no metadata URL and stay uncached, matching `Cache-Control: private, no-store`.
- Changing what DIAL Core writes into a message.

## Alternatives considered

- **A wildcard route, `GET /api/v1/projects/:id/artifacts/*path`.** It gives readable URLs, but Swagger and the generator describe wildcard params poorly. Every other per-project param is already one encoded segment. Rejected (design D2).
- **A query param, `GET /api/v1/projects/:id/artifact?path=…`.** It means a new operation, a new client method and two routes doing one job. Rejected.
- **Rewriting attachment URLs in the BFF** to `files/`-style ids when it stores or streams a project conversation. That would hide Core's real resource id from the client, alter stored conversations and cost a pass over every message. Rejected.
- **Decoding only (the minimal fix).** It fixes the reported case, but nested outputs and the tile download, thumbnail and playback stay broken. The user chose the full fix.

## Acceptance criteria

- In a project conversation, a generated file whose project or file name contains a space or a non-ASCII character opens in the canvas and shows its content.
- An output in a sub-folder (`artifacts/run-1/data.csv`) opens, and its canvas Download saves a file named `data.csv`.
- The attachment tile's download, image thumbnail and audio playback work for a project file id.
- `GET /api/v1/projects/:id/artifacts/run-1%2Fdata.csv` streams `artifacts/run-1/data.csv`.
- `..%2Fcontext%2Ftickets.csv`, `run-1%2F..%2Fx`, an empty segment and a `%` in a decoded segment answer `400` with no Core call.
- The Context and Outputs cards on the project pages behave exactly as before.
- `npm run openapi:check`, `npm run validate:docs` and `npm run validate:specs` pass, and `npm run verify:full` is green.

## Impact

- **App** (`apps/chat`):
  - `utils/dial-file.ts`: `resolveProjectFileDownloadUrl` and `resolveDialUrl`;
  - `utils/icon-path.ts` (`resolveCatalogIconUrl`) and `utils/attachment-display-resolvers.ts` (`resolvePlayUrl`);
  - the tests next to each.
- **Hooks** (`libs/chat-hooks`): a pure `isDialProjectFileId` beside `isDialFileId` in `src/files/dial-file.ts`. `downloadAttachment` and `isDownloadableAttachment` accept it, and the host still builds the URL. Library isolation holds: a `projects/…/files/…` id is a DIAL Core resource shape, like `files/…`, and no `/api` path enters the lib.
- **Backend** (`apps/chat-api/src/projects/`): `dto/project-id-param.dto.ts` (`ProjectArtifactParamDto`), `download/projects-download.service.ts` (disposition name) and `projects.controller.ts` (Swagger text), with their tests.
- **Generated client:** `libs/chat-api-client` is regenerated for the changed param description. The method signatures do not change.
- **Docs:** `apps/chat-api/README.md` (the artifact route row) and the `libs/chat-hooks` README for `isDialProjectFileId`.
- **Compatibility and rollback:** the route accepts a superset of what it accepted before, except names that `IsDialEntityName` allowed and `isSafeDialPathSegment` forbids. There are none: the stored-path rule is the looser of the two. Reverting restores single-segment outputs and the double-encoding bug. No data migrates. **RTL / i18n:** no UI strings or layout change.
