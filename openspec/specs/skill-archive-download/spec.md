# skill-archive-download Specification

## Purpose

Defines the whole-skill archive download flow: reuse of the existing, unmodified `GET /api/v1/skills/download` endpoint and generated client wrapper, the `apps/chat` orchestration in `CatalogView.tsx` (bucket/path resolution, filename resolution from `Content-Disposition` with a sanitized fallback, success/failure notification), and the library-isolation boundary that keeps all of this backend and filesystem knowledge out of `libs/catalog`.

## Requirements


### Requirement: A whole-skill archive endpoint already exists and requires no backend or generated-client change

`GET /api/v1/skills/download` (`SkillsController.downloadSkill`, `apps/chat-api/src/skills/skills.controller.ts`, `operationId: 'downloadSkill'`, `@ApiProduces('application/zip')`) SHALL remain the endpoint this capability uses. It SHALL NOT be modified, and no new endpoint, DTO, or OpenAPI change SHALL be introduced by this capability.

The endpoint SHALL continue to delegate to `SkillsDownloadService.downloadSkill` (`apps/chat-api/src/skills/download/skills-download.service.ts`), which proxies DIAL Core's `downloadSkillFolder` and streams its response, forwarding `content-type`, `content-disposition`, and `etag` through the existing `SAFE_SKILL_DOWNLOAD_HEADERS` allowlist. `apps/chat-api/src/skills/package/skills-package.service.ts` SHALL NOT be involved in archive download — it is exclusively part of the skill *upload* path and never constructs a ZIP.

The generated `SkillsApi.downloadSkillRaw`/`downloadSkill` (`libs/chat-api-client/src/generated/src/apis/SkillsApi.ts`) SHALL remain the sole generated client surface this capability calls, through the existing app-level wrapper `downloadSkill(bucket, path, signal?): Promise<Response>` (`apps/chat/src/server-api/skills.api.ts`). This capability SHALL NOT hand-edit any generated client file, and SHALL NOT add a new legacy `base.ts` wrapper or a direct component-level `fetch`.

Authorization for the download SHALL follow the same rule the endpoint already applies to every skill route: `bucket`/`path` are opaque strings forwarded to DIAL Core, which is the sole authorization boundary; personal, shared, and public/organisation skills SHALL all be downloadable through the identical code path, differentiated only by whichever bucket/path the catalog item already carries — no bucket-specific branching SHALL be added in `apps/chat` or `apps/chat-api` for this capability.

#### Scenario: The existing endpoint is reused unmodified

- **WHEN** the skills controller, download service, and generated client are inspected after this capability lands
- **THEN** `downloadSkill`'s route, `operationId`, response content type, and header-forwarding allowlist are byte-for-byte identical to before this capability existed

#### Scenario: `npm run openapi:check` reports no diff

- **WHEN** `npm run openapi:check` runs after this capability's frontend changes land
- **THEN** it passes with no diff, confirming no backend contract or generated client changed

#### Scenario: A shared skill downloads through the same path as a personal one

- **WHEN** the current user downloads a skill from a bucket they do not own but have shared access to
- **THEN** the same `downloadSkill(bucket, path)` call is made, and DIAL Core's own authorization result (200, or a 4xx it maps) determines the outcome — no separate code path exists for shared vs. personal buckets

---

### Requirement: `CatalogView` wires Download for skills through the existing generic `onDownload`/`isDownloadVisible` contract

`apps/chat/src/components/CatalogView/CatalogView.tsx`'s existing `handleDownload` (previously restricted to `CatalogEntityType.Prompt`) SHALL gain a `CatalogEntityType.Skill` branch. `isDownloadVisible` SHALL gain the matching branch. Neither the existing `CatalogEntityType.Prompt` branch's logic nor its outcome SHALL change.

The Skill branch SHALL:

1. Resolve `{ bucket, path }` from the same `openSkillRef` that the manifest loader and supporting-file renderer populate when the panel opens on a skill. If no skill is currently open (`openSkillRef.current == null`), the handler SHALL return without calling any API.
2. Call the existing `downloadSkill(bucket, path)` wrapper (`apps/chat/src/server-api/skills.api.ts`). No new server-api function, generated-client call, or raw `fetch` SHALL be introduced.
3. Treat a non-OK `Response` (`response.ok === false`) as a failure, without attempting to read its body as an archive.
4. On success, resolve the save filename and trigger the browser download per the following requirement, then report success through `notifyOperationSuccess(NotifiableEntity.Skill, EntityOperation.Downloaded, { name: savedName })`.
5. On any failure (a thrown error, a rejected promise, or a non-OK response), report failure through `showErrorNotification` using a new `catalog.details.skillDownloadError` key, following the same `getApiErrorDetails`-derived `traceId` pattern the existing Prompt branch already uses. The details panel SHALL remain open.

#### Scenario: Activating Download calls the verified endpoint with the open skill's bucket and path

- **WHEN** a skill's details panel is open and its Download action is activated
- **THEN** `downloadSkill` is called with exactly the `bucket` and `path` `openSkillRef.current` carries for that skill

#### Scenario: No open skill means no request

- **WHEN** Download is somehow activated with `openSkillRef.current` unset
- **THEN** no request is made and no error is thrown

#### Scenario: A successful download reports success

- **WHEN** `downloadSkill` resolves an OK response and the browser save completes
- **THEN** `notifyOperationSuccess` is called with `NotifiableEntity.Skill`, `EntityOperation.Downloaded`, and the saved filename

#### Scenario: A non-OK response is treated as a failure without decoding

- **WHEN** `downloadSkill` resolves a `Response` with `ok: false`
- **THEN** the response body is not read as an archive, and the failure path (below) runs

#### Scenario: Prompt's existing Download behavior is untouched

- **WHEN** a Prompt's Download action is activated
- **THEN** the existing Prompt branch runs exactly as it did before this capability existed, with no code path shared with the new Skill branch beyond the outer `if`/`else` dispatch

---

### Requirement: Archive failures are reported through the existing operation-notification mechanism, without distinguishing status codes

A rejected `downloadSkill` call, a non-OK response, or any error thrown while resolving the archive or triggering the save SHALL result in a single, generic failure notification via `showErrorNotification({ message: t(CatalogI18nKeys.DetailsSkillDownloadError), requestId: traceId })`, where `traceId` comes from `getApiErrorDetails(err)`, matching the existing Prompt-download branch's error-reporting shape exactly.

This capability SHALL NOT introduce per-status-code messaging (distinguishing unauthorized, forbidden, not-found, or server error) — a single failure message covers all of them, consistent with the existing Prompt-download branch's own granularity.

The details panel SHALL remain open after any failure. No confirmation dialog SHALL be shown before the download starts.

#### Scenario: Unauthorized response

- **WHEN** `downloadSkill`'s underlying request resolves a 401
- **THEN** the generic skill-download failure notification is shown and the panel stays open

#### Scenario: Forbidden response

- **WHEN** `downloadSkill`'s underlying request resolves a 403
- **THEN** the generic skill-download failure notification is shown and the panel stays open

#### Scenario: Missing skill

- **WHEN** `downloadSkill`'s underlying request resolves a 404
- **THEN** the generic skill-download failure notification is shown and the panel stays open

#### Scenario: Server failure

- **WHEN** `downloadSkill`'s underlying request resolves a 5xx or the request throws a network error
- **THEN** the generic skill-download failure notification is shown and the panel stays open

---

### Requirement: The save filename comes from `Content-Disposition`, with a sanitized deterministic fallback

The Skill branch SHALL resolve the saved file's name through the existing `apps/chat/src/utils/file-download.ts::triggerBrowserDownload(response, fallbackName)`, unmodified. `fallbackName` SHALL be `` `${sanitizeFileName(item.name)}.zip` ``, using the existing `apps/chat/src/utils/file-name.ts::sanitizeFileName` unmodified.

`triggerBrowserDownload` SHALL be relied upon, not reimplemented, for: extracting a filename from a quoted or unquoted `Content-Disposition` header, stripping `/`/`\` from whatever it extracts, falling back to `fallbackName` when the header is absent or unusable, converting the response body to a `Blob`, and triggering the browser save through the existing `triggerBlobDownload` (which creates and, after a fixed delay, revokes the object URL).

A filename containing Unicode characters SHALL pass through unmodified (neither `triggerBrowserDownload`'s extraction nor `sanitizeFileName`'s character replacement re-encodes or strips non-ASCII characters). A fallback filename derived from a skill name containing path separators or other characters `NOT_ALLOWED_SYMBOLS_REGEXP` forbids SHALL have those characters replaced before being handed to the browser.

An empty response body SHALL still be saved, as a valid zero-byte file, under the resolved name — this is standard `Blob`/browser behavior and is not treated as an error by this capability.

#### Scenario: Server-provided filename is used

- **WHEN** the response carries `Content-Disposition: attachment; filename="my-skill.zip"`
- **THEN** the browser save uses `my-skill.zip`, not the sanitized-fallback name

#### Scenario: Missing filename falls back to the sanitized skill name

- **WHEN** the response carries no `Content-Disposition` header
- **THEN** the browser save uses `` `${sanitizeFileName(item.name)}.zip` ``

#### Scenario: Unicode filename is preserved

- **WHEN** the response's `Content-Disposition` (or the skill's own name, in the fallback case) contains non-ASCII Unicode characters
- **THEN** those characters appear unchanged in the saved filename

#### Scenario: Unsafe filename characters are sanitized in the fallback

- **WHEN** the skill's name contains a path separator or another character `NOT_ALLOWED_SYMBOLS_REGEXP` forbids, and the response carries no `Content-Disposition`
- **THEN** the fallback filename has those characters replaced before the browser save is triggered

#### Scenario: An empty archive still saves

- **WHEN** the response body is empty
- **THEN** a zero-byte file is saved under the resolved name, and this is not treated as a failure

---

### Requirement: Library isolation — `libs/catalog` knows nothing about the archive, the endpoint, or the filename

`libs/catalog/src/**` SHALL contain no reference to: `downloadSkill`, `Content-Disposition`, `SkillsApi`, bucket names, skill resource paths, or ZIP/archive MIME types. Its only involvement in this capability is calling the unchanged `onDownload` prop and awaiting its result (per `catalog-primary-action`'s pending-state requirement).

No `Blob`, `File`, or object-URL API (`URL.createObjectURL`/`URL.revokeObjectURL`) call for the archive SHALL exist anywhere in `libs/catalog/src`.

#### Scenario: No backend or generated-client knowledge in the lib

- **WHEN** `libs/catalog/src` is searched for `downloadSkill`, `Content-Disposition`, or `SkillsApi`
- **THEN** none appear

#### Scenario: No direct fetch or Blob handling in the lib

- **WHEN** `libs/catalog/src` is searched for `fetch(`, `URL.createObjectURL`, or `URL.revokeObjectURL`
- **THEN** none appear in the Header/DetailsPanel/Catalog components this capability touches
