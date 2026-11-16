## MODIFIED Requirements

### Requirement: Saved files are fetched by the shared canvas resolvers through the project file endpoint

A context file stored in the project (the view page's files, and the edit page's files with `isStored`) SHALL be opened as an attachment whose `url` is its locator, `{projectId}/files/context/{fileName}` (`toProjectContextFileUrl` in `apps/chat/src/utils/dial-file.ts`). The app's `resolveDialUrl` (the same function that resolves a `files/` id for the conversation canvas) maps that locator to the BFF endpoint through `resolveProjectFileDownloadUrl`, so the shared content resolvers in `libs/chat-hooks/src/files/attachment-canvas.ts` fetch it, with no project-specific fetch.

`resolveProjectFileDownloadUrl` SHALL decode every segment of the locator before encoding it for the route, and SHALL take the project id from before the first `/files/` segment (see the `project-view-ui` capability). That covers a DIAL Core percent-encoded context file id in a message attachment as well as the app's own unencoded locator. A context file is always one segment directly under `context/`. A locator with a deeper path under `context/` resolves to nothing.

**Endpoint (existing, reused unchanged).** `GET /api/v1/projects/{id}/files/{fileName}` (`downloadProjectFile` in `apps/chat-api/src/projects/projects.controller.ts`), authenticated with the session cookie. `id` is the URL-encoded project id and `fileName` a name directly under the project's `context/` folder.

```http
GET /api/v1/projects/projects%2Fbucket-1%2Fsupport/files/tickets.csv
200 OK
Content-Type: text/csv
Content-Disposition: attachment; filename="tickets.csv"
X-Content-Type-Options: nosniff
Cache-Control: private, no-store

<binary stream>
```

Errors: `400` invalid id or file name, `401` not authenticated, `403` the `projectsEnabled` feature is off for the user or DIAL Core denied access, `404` the project or file does not exist, `502` DIAL Core returned an error, `503` DIAL Core is unavailable or timed out.

**Generated-client impact: none.** The endpoint is requested by URL, as the conversation canvas requests `/api/v1/files/download`; no `chat-api` or OpenAPI change, and the generated `downloadProjectFileRaw` is not involved.

**Behavior, as for a DIAL file in a conversation.**

- The canvas opens in its loading state and shows the preview when the bytes arrive.
- A `403` shows the canvas's forbidden state; any other non-2xx status, and a network failure, show its load-error state.
- The canvas file type comes from the file name (the card's content type), not from the response header.
- The project file has no metadata URL, so the resolvers read no ETag and cache nothing, matching the BFF's `Cache-Control: private, no-store`: every activation requests the file.
- A load error offers the shared canvas's Retry (see the `canvas` capability), which requests the file again as a new request.
- A response that belongs to a request the user has superseded is discarded by the `useLatestCanvasRequest` guard, as in a conversation.

#### Scenario: Saved file loads and renders

- **GIVEN** the view page of a project that stores `tickets.csv`
- **WHEN** the user activates its card
- **THEN** one `GET /api/v1/projects/{id}/files/tickets.csv` request is made, the canvas shows a loading state, then the CSV table

#### Scenario: Forbidden

- **WHEN** the request answers `403`
- **THEN** the canvas shows the forbidden message, and no preview is shown

#### Scenario: Other failure

- **WHEN** the request answers `502`, or fails at the network
- **THEN** the canvas shows the load-error message with a Retry button, and activating it requests the file again

#### Scenario: Unchanged file on the edit page

- **GIVEN** the edit page with a stored `report.pdf` the user has not removed
- **WHEN** the user activates its card
- **THEN** the file is requested through the endpoint, the PDF renders, and the form is not modified

#### Scenario: Locator mapping

- **WHEN** the locator `projects/bucket-1/support/files/context/Q4 tickets.csv` is resolved
- **THEN** it maps to `/api/v1/projects/projects%2Fbucket-1%2Fsupport/files/Q4%20tickets.csv`, and a locator with no file name, a name containing `/`, or no `projects/` prefix resolves to nothing

#### Scenario: A Core-encoded context file id

- **WHEN** the id `projects/bucket-1/Q4%20launch/files/context/Q4%20tickets.csv` is resolved
- **THEN** it maps to `/api/v1/projects/projects%2Fbucket-1%2FQ4%20launch/files/Q4%20tickets.csv`
