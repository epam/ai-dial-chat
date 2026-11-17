## MODIFIED Requirements

### Requirement: An output opens in the attachment canvas, as a context file does

`ProjectViewPage` SHALL open an output the way it opens a context file (see the `project-context-file-preview` capability). Its `onOpenOutput(name)` calls `openAttachmentCanvas(attachment, key, startCanvasRequest())` with:

- `attachment = toStoredProjectFileAttachment({ id: name, name, contentType }, projectId)`, whose `url` is the output locator `{projectId}/files/artifacts/{name}`, from `toProjectArtifactUrl` in `apps/chat/src/utils/dial-file.ts`;
- `key = toProjectPreviewKey(projectId, 'artifacts/' + name)`. A context file name cannot contain `/`, so an output and a context file with the same name are never the same preview and never both render selected.

The shared `toStoredProjectFileAttachment` (`libs/chat-hooks/src/project/project-file-preview.ts`, exported from `@epam/ai-dial-chat-hooks/project`) SHALL take the locator builder for the folder as a required parameter, so that context and output cards share it; `apps/chat/src/utils/project-file-preview.ts` binds it to the app's locator builders.

`resolveDialUrl` SHALL map an output locator to `GET /api/v1/projects/{encodeURIComponent(projectId)}/artifacts/{encodeURIComponent(relativePath)}` (see the `project-detail-api` capability), through `resolveProjectFileDownloadUrl`:

- The locator SHALL start with `projects/`. The project id is everything before the **first** `/files/` after `projects/{bucket}/`, and the in-project path is everything after it. `files` is a name DIAL Core reserves, so no project path contains a `files` segment.
- Every segment of the project id and of the in-project path SHALL be decoded with `decodeURIComponent` before it is encoded for the route. One function therefore serves both:
  - the app's own unencoded locators, which contain no `%` because a DIAL name cannot contain one;
  - DIAL Core's percent-encoded ids, as they arrive in message attachments (see the `project-conversations-ui` capability).
- A segment that fails to decode, or is empty after decoding, makes the locator resolve to nothing.
- An in-project path of `artifacts/` followed by one or more segments maps to the artifact route, with those segments joined by `/` as `relativePath`. A path of `context/` followed by exactly one segment maps to the context-file route. Every other path resolves to nothing.
- The shared canvas content resolvers, the canvas Download action and `resolveAbsoluteDialUrl` therefore reach outputs with no project-specific fetch.
- **Generated-client impact:** none for the canvas; it requests the route by URL.

The Outputs section still lists only the direct children of `artifacts/`, so a card's `relativePath` is a single segment. Nested paths reach the resolver only from message attachments.

The page derives `selectedOutputName` from the canvas `attachmentId`: the card id after the `artifacts/` prefix in the project scope, or `undefined`. It passes `isDetailsStacked` to `ProjectView` while either a context file or an output is open.

Handlers are memoised with `useCallback`.

#### Scenario: Opening an output

- **WHEN** the user activates the `report.pdf` output card of `projects/bucket-1/support`
- **THEN** one `GET /api/v1/projects/projects%2Fbucket-1%2Fsupport/artifacts/report.pdf` request is made, and the canvas shows the PDF
- **AND** the `report.pdf` output card renders selected, and the Details panel stacks below the main column

#### Scenario: Locator mapping

- **WHEN** the locator `projects/bucket-1/support/files/artifacts/Q4 deck.pptx` is resolved
- **THEN** it maps to `/api/v1/projects/projects%2Fbucket-1%2Fsupport/artifacts/Q4%20deck.pptx`
- **AND** an output locator with no file name, or with an empty segment, resolves to nothing

#### Scenario: A Core-encoded output id is not encoded twice

- **WHEN** the id `projects/bucket-1/Q4%20launch/files/artifacts/report%20v2.md` is resolved
- **THEN** it maps to `/api/v1/projects/projects%2Fbucket-1%2FQ4%20launch/artifacts/report%20v2.md`
- **AND** the same project and file written unencoded, `projects/bucket-1/Q4 launch/files/artifacts/report v2.md`, maps to the same URL

#### Scenario: A nested output maps to the artifact route

- **WHEN** the id `projects/bucket-1/support/files/artifacts/run-1/data.csv` is resolved
- **THEN** it maps to `/api/v1/projects/projects%2Fbucket-1%2Fsupport/artifacts/run-1%2Fdata.csv`

#### Scenario: The project id ends at the first files segment

- **WHEN** the id `projects/b/p/files/artifacts/files/artifacts/x.csv` is resolved
- **THEN** the project id is `projects/b/p` and the relative path is `files/artifacts/x.csv`

#### Scenario: Unresolvable ids

- **WHEN** the id is `projects/b/p/files/tmp/x.csv`, `projects/b/p/files/artifacts/%E0%A4%A.csv` (a malformed escape) or `projects//files/artifacts/a.csv`
- **THEN** it resolves to nothing, and no request is made

#### Scenario: Same name in context and outputs

- **WHEN** the project has a context file `notes.md` and an output `notes.md`, and the output is open in the canvas
- **THEN** only the output card renders selected
