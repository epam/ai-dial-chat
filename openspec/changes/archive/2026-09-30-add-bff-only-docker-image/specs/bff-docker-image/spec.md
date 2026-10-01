## ADDED Requirements

### Requirement: BFF-only image contents

The repository SHALL provide `apps/chat-api/Dockerfile`, built with the repository root as the
build context (`docker build -f apps/chat-api/Dockerfile .`). The final image SHALL contain
only the NestJS BFF: the pruned `apps/chat-api/dist` bundle (including `main.js`, the pruned
`package.json`/`package-lock.json` and `workspace_modules/`) and its production
`node_modules`. It SHALL NOT contain `apps/chat/dist` or `apps/chat-overlay-sandbox/dist`, and
its build SHALL NOT run the `build` target of `@epam/chat` or `chat-overlay-sandbox`.

The image SHALL use the same base image, pinned npm version and hardening as the root
`Dockerfile`: it upgrades `libcrypto3`/`libssl3`, runs `npm ci --omit=dev` from the pruned
lockfile, and removes npm/npx and the npm cache after the last install. The root `Dockerfile`
and the `ai-dial-chat` image SHALL stay unchanged.

#### Scenario: Frontend bundles are absent

- **WHEN** the image built from `apps/chat-api/Dockerfile` is inspected
- **THEN** `/app/apps/chat-api/dist/main.js` exists
- **AND** neither `/app/apps/chat/dist` nor `/app/apps/chat-overlay-sandbox/dist` exists

#### Scenario: npm is not available at runtime

- **WHEN** a shell in the running container runs `npm --version`
- **THEN** the command is not found, the same as in the `ai-dial-chat` image

### Requirement: BFF-only image runtime

The image SHALL expose port `5000` and start with `node apps/chat-api/dist/main.js` from
`/app`, with `NODE_ENV=production`. It SHALL read exactly the same environment variables as
the `ai-dial-chat` image. No new variable is introduced, and none is required to switch off
static serving. `/api/*` routes SHALL behave the same as in the full image. Because no
frontend `index.html` is present, a non-API `GET` (for example `/` or `/chat/123`) SHALL fall
through to Nest's default 404 instead of an SPA response, and `GET /overlay-sandbox/*` SHALL
return 404 even when `OVERLAY_SANDBOX_ENABLED=true`.

#### Scenario: Health check answers without a frontend

- **WHEN** the container is started with a valid production environment and `GET /api/health` is called
- **THEN** the response is HTTP 200 with `status: "ok"` and a non-empty `buildId`

#### Scenario: Root path is not served

- **WHEN** `GET /` is called on the running container
- **THEN** the response is HTTP 404 and no HTML document is returned

#### Scenario: Enabled overlay sandbox has nothing to serve

- **WHEN** the container runs with `OVERLAY_SANDBOX_ENABLED=true` and `GET /overlay-sandbox/` is called
- **THEN** the response is HTTP 404 and the process does not fail at startup

### Requirement: BFF-only image published with ai-dial-chat

The Release Workflow (`.github/workflows/release.yml`) SHALL build and push the BFF-only
image on every run that publishes `ai-dial-chat`, that is on every push to `development` or
`release-*` and on `workflow_dispatch`. It SHALL run as its own job in parallel with the
`release` job. It SHALL push to `epam/ai-dial-chat-bff` (Docker Hub) and
`ghcr.io/epam/ai-dial-chat-bff`, with the image name derived from `${{ github.repository }}-bff`.

Tags SHALL follow the same rules the `ai-dial-chat` image uses for the same run:

- `development` for pushes to `development`
- `<next-version>` (from `epam/ai-dial-ci/actions/semantic_versioning`, with the same
  `promote` input) for `release-*` branches
- additionally `latest` when that action reports `is-latest == 'true'` on a `release-*` branch

Before building, the job SHALL stamp the workspace root `package.json` version with
`<next-version>` (`npm version <next-version> --no-git-tag-version`), so that the bundled
`PACKAGE_VERSION`, and with it `/api/health` `version` and `buildId`, matches the
`ai-dial-chat` image of the same run. The image SHALL be scanned by the Trivy step built into
`build_docker`, the same as the other images.

#### Scenario: Development push publishes both images

- **WHEN** a commit is pushed to `development`
- **THEN** `ai-dial-chat:development` and `ai-dial-chat-bff:development` are both pushed to Docker Hub and GHCR by the same Release Workflow run

#### Scenario: Promoted release tags match

- **WHEN** the Release Workflow is dispatched with `promote: true` on `release-1.4` and the computed next version is `1.4.0`
- **THEN** `ai-dial-chat-bff` is pushed with tags `1.4.0` and, if it is the latest release, `latest`, the same tags as `ai-dial-chat` in that run

#### Scenario: Version is stamped into the bundle

- **WHEN** the BFF-only image from a `release-*` run with next version `1.4.0` starts without `CHAT_VERSION`
- **THEN** `GET /api/health` reports `version: "1.4.0"`

### Requirement: BFF-only image validated on pull requests

The PR Workflow (`.github/workflows/pr.yml`) SHALL build the BFF-only image from
`apps/chat-api/Dockerfile` on every pull request targeting `development` or `release-*`,
without pushing, as a job independent of `run_tests`. A Dockerfile or build failure SHALL fail
the pull request.

#### Scenario: Broken Dockerfile fails the PR

- **WHEN** a pull request introduces a change that makes `docker build -f apps/chat-api/Dockerfile .` fail
- **THEN** the `docker_build_bff` job fails and the PR checks report a failure
