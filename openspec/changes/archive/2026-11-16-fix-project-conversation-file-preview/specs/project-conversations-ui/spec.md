## ADDED Requirements

### Requirement: Project file attachments in a project conversation open, download, preview and play

A message in a project conversation MAY carry an attachment whose `url` is a DIAL Core project file id, `projects/{bucket}/{projectPath}/files/{filePath}`, percent-encoded segment by segment. An agent answering a call with `x-project-id` returns its outputs this way. The BFF stores and streams that id unchanged (see the `project-conversations-api` capability).

Every attachment surface of the conversation SHALL resolve such an id through `resolveProjectFileDownloadUrl` (`apps/chat/src/utils/dial-file.ts`; mapping rules in the `project-view-ui` capability), so one attachment requests one URL everywhere:

- **Canvas preview.** `resolveDialUrl` already falls back to `resolveProjectFileDownloadUrl` for a non-`files/` `url`. The canvas content resolvers, the canvas Download action and `resolveAbsoluteDialUrl` therefore need no further change. A Core-encoded id SHALL NOT be encoded twice.
- **Tile download.** `libs/chat-hooks` SHALL export a pure `isDialProjectFileId(url)` from `src/files/dial-file.ts`, next to `isDialFileId`.
  - It is `true` for `projects/{bucket}/{…}/files/{…}` with a non-empty path after `/files/`, ignoring a `#…` fragment, and `false` for a folder id (trailing `/`).
  - `isDownloadableAttachment` and `downloadAttachment` (`libs/chat-hooks/src/attachment/useAttachmentAction/useAttachmentAction.ts`) SHALL treat such an id as downloadable and pass it to the host's injected `resolveDownloadUrl`. When that returns `undefined`, no download starts and `downloadAttachment` returns `false`.
  - The library SHALL NOT build a URL or know an `/api` route. The app passes `resolveAttachmentDownloadUrl` (`apps/chat/src/utils/dial-file.ts`), which delegates to `resolveDialFileDownloadUrl` for a `files/` id and to `resolveProjectFileDownloadUrl` for a project file id, at the `useAttachmentAction` call sites (`apps/chat/src/hooks/conversation/useMessageAttachments.ts` and `apps/chat/src/components/ConversationSourcesPanel/ConversationSourcesPanel.tsx`).
- **Image thumbnail.** `resolveCatalogIconUrl` (`apps/chat/src/utils/icon-path.ts`) SHALL resolve a project file id through `resolveProjectFileDownloadUrl` instead of treating it as a theme icon name.
- **Audio playback.** `attachmentDisplayResolvers.resolvePlayUrl` (`apps/chat/src/utils/attachment-display-resolvers.ts`) SHALL resolve a project file id through `resolveAttachmentDownloadUrl`.

A project file id the mapping rejects, such as a file outside `context/` and `artifacts/` or a malformed escape, resolves to nothing:

- the canvas opens its Unsupported state;
- the tile offers no download;
- no request is sent.

**Feature flag:** these ids only occur in project conversations, which are behind `features.projectsEnabled`. Regular conversations, whose attachments are `files/` ids, are unaffected. **RTL impact:** none. **i18n impact:** none; the canvas's existing load-error, forbidden and unsupported strings apply.

#### Scenario: A generated file opens in a project chat

- **GIVEN** a project conversation in `projects/a1b2c3/Q4 launch` whose assistant message carries `{ "url": "projects/a1b2c3/Q4%20launch/files/artifacts/report%20v2.md", "type": "text/markdown", "title": "report v2.md" }`
- **WHEN** the user activates the attachment
- **THEN** one `GET /api/v1/projects/projects%2Fa1b2c3%2FQ4%20launch/artifacts/report%20v2.md` request is made, and the canvas renders the Markdown

#### Scenario: A nested output opens and downloads under its own name

- **GIVEN** an assistant message attachment `projects/a1b2c3/q4/files/artifacts/run-1/data.csv`
- **WHEN** the user activates it, then the canvas Download action
- **THEN** the canvas requests `/api/v1/projects/projects%2Fa1b2c3%2Fq4/artifacts/run-1%2Fdata.csv` and shows the CSV table, and the downloaded file is named `data.csv`

#### Scenario: Tile download of a project file

- **WHEN** the user activates the download action of a tile whose attachment `url` is `projects/a1b2c3/q4/files/artifacts/report.pdf`
- **THEN** a download of `/api/v1/projects/projects%2Fa1b2c3%2Fq4/artifacts/report.pdf` starts

#### Scenario: Image thumbnail of a project file

- **WHEN** an assistant message carries an image attachment `projects/a1b2c3/q4/files/artifacts/chart.png`
- **THEN** its thumbnail `<img>` source is `/api/v1/projects/projects%2Fa1b2c3%2Fq4/artifacts/chart.png`

#### Scenario: A project file outside context and artifacts

- **WHEN** an attachment `url` is `projects/a1b2c3/q4/files/tmp/x.csv`
- **THEN** activating it opens the canvas Unsupported state, its tile offers no download, and no request is made

#### Scenario: Regular conversations are unchanged

- **WHEN** an attachment in a regular conversation has `url` `files/a1b2c3/docs/report.txt`
- **THEN** it resolves to `/api/v1/files/download?bucket=a1b2c3&path=docs%2Freport.txt`, exactly as before
