# Spec Delta

## MODIFIED Requirements

### Requirement: Bounded, contained and verified upstream reads

Every upstream read for the celebrations endpoints SHALL go through one reader in `apps/chat-api/src/celebrations/`:

- It resolves the target from a server-side path only: the fixed `celebrations/index.json`, an index `manifest.path`, or a manifest-relative asset `file`.
- It requires the resolved URL to keep the origin of `THEMES_CONFIG_URL` and to stay under its `celebrations/` path. `..`, an absolute URL, a scheme or a backslash in the stored path makes the resource unavailable.
- It never builds a URL from client input other than the validated IDs used as registry keys.
- It never follows a redirect (`redirect: 'manual'`, so a 3xx is treated as an invalid upstream status) and uses the existing `THEMES_SERVICE_TIMEOUT_MS` through an `AbortController`.
- It reads the body as a stream and aborts once the cap is exceeded. The caps are 64 KiB for the index, 64 KiB for a manifest, 512 KiB for Lottie JSON (raised from 300 KiB by S4, #9223) and 100 KiB for a poster or icon.
- It verifies the exact declared `bytes` and the lowercase SHA-256 before parsing, caching or serving, and verifies the declared media type against the allowlist `application/json`, `image/svg+xml`, `image/png`, `image/webp`.
- It parses JSON with a depth limit: 32 for the index and manifests, 64 for Lottie.

The index has no declared hash. It is bounded by its cap and validated by schema. Raw `fetch` is used because the themes host is a non-DIAL static upstream (`apps/chat-api/AGENTS.md`).

#### Scenario: Oversized animation
- **WHEN** an asset's actual bytes exceed 512 KiB, whatever its declared `bytes` says
- **THEN** the reader stops at the cap and `GET /api/v1/celebrations/assets/{assetId}` responds `502`

#### Scenario: Republished bytes under an existing version
- **WHEN** a manifest's bytes no longer match the `sha256` the index declares
- **THEN** `GET /api/v1/celebrations/packs/{packId}/{version}` responds `502`, and nothing is cached

#### Scenario: Upstream redirect
- **WHEN** the themes host answers a manifest request with `302` to another origin
- **THEN** the redirect is not followed and the BFF responds `502`

#### Scenario: Stored path escapes the celebrations root
- **WHEN** an index `manifest.path` is `../config.json`
- **THEN** that pack is treated as unpublished, and the request responds `404` without an upstream request

