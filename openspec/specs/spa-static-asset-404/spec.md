## Purpose

Ensure requests for missing static assets (stale hashed JS/CSS chunks from a previous deployment) fail with a clear 404 instead of silently falling back to the SPA shell, which would otherwise let a stale tab execute mismatched HTML/JS.

## Requirements

---

### Requirement: Missing static asset returns 404, not the SPA shell

`apps/chat-api`'s static file serving SHALL return HTTP 404 for any request under `/assets/**` (main frontend static root) or `/overlay-sandbox/assets/**` (overlay sandbox static root) that does not match an existing file on disk. The SPA `index.html` fallback SHALL NOT be served for these paths, regardless of `Accept` header or session state.

#### Scenario: Missing hashed JS chunk returns 404

- **WHEN** a client requests `GET /assets/DialFileManagerPage-<stale-hash>.js` and no file with that name exists in the frontend's built `dist/assets` directory
- **THEN** the response is HTTP 404, and the response body is not the contents of `index.html`

#### Scenario: Missing hashed CSS file returns 404

- **WHEN** a client requests `GET /assets/<stale-hash>.css` and no matching file exists on disk
- **THEN** the response is HTTP 404, and the response body is not the contents of `index.html`

#### Scenario: Missing overlay sandbox asset returns 404

- **WHEN** a client requests `GET /overlay-sandbox/assets/<stale-hash>.js` and no matching file exists in the overlay sandbox's built `dist/assets` directory
- **THEN** the response is HTTP 404, and the response body is not the contents of the overlay sandbox's `index.html`

#### Scenario: Existing asset is served normally

- **WHEN** a client requests `GET /assets/<hash>.js` for a file that exists on disk
- **THEN** the response is HTTP 200 with the file's actual content and a JavaScript `Content-Type`

---

### Requirement: Non-asset client-side routes still receive the SPA fallback

Requests to paths outside `/api/**`, `/overlay-sandbox/**`, and `/assets/**` (or `/overlay-sandbox/assets/**`) that do not match a static file SHALL continue to receive HTTP 200 with the SPA `index.html`, preserving client-side routing.

#### Scenario: Unknown client-side route still serves index.html

- **WHEN** a client requests `GET /conversations/thread-1`, a route with no matching static file
- **THEN** the response is HTTP 200 with the contents of `index.html`
