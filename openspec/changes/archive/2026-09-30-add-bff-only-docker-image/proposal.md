## Why

The only production image today (`Dockerfile` at the repository root) bundles the NestJS BFF
(`apps/chat-api`) together with the built React SPA (`apps/chat/dist`) and the overlay sandbox
(`apps/chat-overlay-sandbox/dist`). Deployments that host the frontend separately (CDN, a
different origin, another host app embedding DIAL Chat through its own shell) have to ship
and run a frontend they never serve. They need a BFF-only image, released from the same
commit and with the same version tag as `ai-dial-chat`, so the two never drift apart.

## Problem

- There is no way to get the BFF without the frontend bundle. The root `Dockerfile` has a
  single final stage (`Dockerfile:44-75`), and it copies both static trees into it.
- The shared CI action cannot select a stage. `epam/ai-dial-ci/actions/build_docker@4.11.0`
  accepts `dockerfile-path` only, with no `target` or `build-args` input, and always builds
  with `context: .`. A `bff` stage inside the root `Dockerfile` therefore cannot be built or
  published by our CI.
- Without `apps/chat/dist/index.html`, `GET /api/health` reports `buildId: "dev"` for every
  build (`apps/chat-api/src/health/health.controller.ts:12-24`). The code comment assumes
  "this path never runs against a real deployment". A BFF-only deployment would make that
  false: `buildId` would never change between releases.

## Solution

Follow the precedent `apps/mcp-app-sandbox` already set (`apps/mcp-app-sandbox/Dockerfile`,
`.github/workflows/release.yml:32-70`, `.github/workflows/pr.yml:56-72`).

- **Yes, a separate Dockerfile is needed**: add `apps/chat-api/Dockerfile`. It uses the same
  base, deps and builder stages as the root image, but its builder runs only
  `nx run chat-api:prune`, and its runner has no `COPY` of `apps/chat/dist` or
  `apps/chat-overlay-sandbox/dist`.
- **Publish it next to `ai-dial-chat`**: add a `release_bff_image` job to
  `release.yml`, parallel to the existing `release` job. It pushes
  `epam/ai-dial-chat-bff` and `ghcr.io/epam/ai-dial-chat-bff`, using the same
  version/`development`/`latest` tag rules as the mcp-app-sandbox job. It also stamps the
  root `package.json` with the computed version before the build, as `node_release.yml`
  does for the main image.
- **Validate it on PRs**: add a build-only `docker_build_bff` job to `pr.yml`.
- **Make `buildId` meaningful without a frontend**: when `index.html` is absent, derive
  `buildId` from a hash of the resolved app version (`resolveAppVersion(CHAT_VERSION)`)
  instead of the constant `"dev"`. This keeps the existing values for the full image and
  for local API-only dev (the version does not change within a process).

## Non-goals

- Changing the root `Dockerfile` or the `ai-dial-chat` image in any way.
- A frontend-only image (nginx or static) for `apps/chat` or `apps/chat-overlay-sandbox`.
- Adding the BFF image to `deploy-development.yml`. That needs a new GitLab project id and
  environment, owned by the deployment team. It is tracked as a follow-up.
- Helm charts or runtime configuration changes. The BFF-only image reads exactly the same
  environment variables as the full image.
- A new env var to turn static serving off. `createFrontendMiddleware` already falls
  through to Nest's 404 when `index.html` is missing (`apps/chat-api/src/app/static-assets.ts:117-123,133-136`).

## Alternatives considered

| Option                                                           | Verdict                                                                                                                                                                            |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Separate `apps/chat-api/Dockerfile`** (picked)              | Works with the existing `build_docker` action unchanged. Same pattern as mcp-app-sandbox. The cost is duplicating about 30 lines of shared stages.                                   |
| B. Extra `bff` stage in the root `Dockerfile` + `--target`       | Rejected: `build_docker` has no `target` input. It would need an ai-dial-ci release first, and the root image's last stage would still have to be the full one.                       |
| C. Build arg `INCLUDE_FRONTEND=false` in the root `Dockerfile`   | Rejected: `build_docker` has no `build-args` input. `COPY --from` cannot be made conditional without hacks (empty dirs), and one Dockerfile with two meanings is harder to audit. |
| D. Do nothing; deployers ignore the bundled SPA                  | Baseline. Rejected: it ships dead assets, and `buildId` stays tied to a frontend the deployment doesn't serve.                                                                      |

## Acceptance criteria

- `docker build -f apps/chat-api/Dockerfile .` produces an image whose filesystem has
  `/app/apps/chat-api/dist/main.js` and no `/app/apps/chat/dist` or
  `/app/apps/chat-overlay-sandbox/dist`.
- The container starts with `node apps/chat-api/dist/main.js` on port 5000, answers
  `GET /api/health` with 200, and returns 404 for `GET /`.
- On every push to `development` / `release-*`, the Release Workflow publishes
  `ai-dial-chat-bff` to Docker Hub and GHCR. The tags match the `ai-dial-chat` image tags for
  the same run (`development`, or `<next-version>` plus `latest` when promoted).
- Every PR builds the BFF image (no push). A broken `apps/chat-api/Dockerfile` fails the PR.
- In the BFF-only image, `buildId` is non-empty, stable within a process, and differs between
  two releases with different versions.

## Rollback / backward compatibility

The change is additive and not breaking. The `ai-dial-chat` image, its tags and its runtime
behaviour stay the same: with `index.html` present, `buildId` is still its hash. To roll
back, remove the two workflow jobs and `apps/chat-api/Dockerfile`. Already-published
`ai-dial-chat-bff` tags stay in the registries until the cleanup workflow or a manual deletion
removes them.

## Capabilities

### New Capabilities

- `bff-docker-image`: the BFF-only container image. It covers what the image must contain and
  exclude, how it starts, and how CI builds it on PRs and publishes it together with
  `ai-dial-chat`.

### Modified Capabilities

- `chat-api-backend`: the `Health check endpoint` requirement. When no frontend is bundled,
  `buildId` is derived from the resolved app version instead of a constant placeholder.

## Impact

- **New files**: `apps/chat-api/Dockerfile`.
- **CI**: `.github/workflows/release.yml` (new `release_bff_image` job) and
  `.github/workflows/pr.yml` (new `docker_build_bff` job).
- **Registries**: new repositories `epam/ai-dial-chat-bff` (Docker Hub, must be created
  before the first release run, as was done for `-mcp-app-sandbox`) and
  `ghcr.io/epam/ai-dial-chat-bff` (created on first push). `cleanup-untagged-images.yml` may
  need the new package name. See design.
- **Code**: `apps/chat-api/src/health/health.controller.ts` (`computeBuildId` fallback) and its
  spec. No endpoint shape change, so no OpenAPI regeneration is needed. Only the `buildId`
  description text changes.
- **Docs**: root `README.md` (Production Deployment), `apps/chat-api/README.md` (new Docker
  image section), `docs/architecture.md` (deployment and images summary).
- **i18n / UI / libs**: none. No user-visible strings, no `libs/*` changes.
- **Scope-creep flag**: none. Shared libs and global providers are untouched.
