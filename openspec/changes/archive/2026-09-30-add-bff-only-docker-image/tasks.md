Slicing strategy: **risk-first, then vertical**. Slice 2 proves the image builds and runs
without a frontend before any CI wiring. Slice 3 fixes `buildId` in isolation. Slices 4–5 wire
CI on top of a Dockerfile already known to work. Each slice can be verified on its own.

## 1. Prerequisites

- [ ] 1.1 Ask the EPAM Docker Hub org owner to create the repository `epam/ai-dial-chat-bff`
      (public, same settings as `epam/ai-dial-chat-mcp-app-sandbox`) before merge. The first
      `development` push fails without it. Record who created it in the PR description.

## 2. BFF-only Dockerfile

- [ ] 2.1 Create `apps/chat-api/Dockerfile`: copy the `node-base` and `deps` stages verbatim
      from the root `Dockerfile`. The `builder` stage runs only `npm exec nx run chat-api:prune`.
      The `runner` stage is the root `runner` without the `apps/chat/dist` and
      `apps/chat-overlay-sandbox/dist` `COPY` lines, with `EXPOSE 5000` and
      `CMD ["node", "apps/chat-api/dist/main.js"]`. Keep the comment style of
      `apps/mcp-app-sandbox/Dockerfile`. Add a header comment saying that this is the root image
      minus the frontend and naming both sibling Dockerfiles for version bumps.
- [ ] 2.2 Add a one-line sibling cross-reference comment near `FROM node:` in the root
      `Dockerfile` and in `apps/mcp-app-sandbox/Dockerfile`, so a base-image or npm bump
      updates all three. This is comment-only; no stage change.

  **Verification** (decided 2026-09-30: delegated to CI; the local Podman VM was unavailable)
  - The PR's `docker_build_bff` job is green, which proves
    `docker build -f apps/chat-api/Dockerfile .` succeeds on a clean checkout. Mark 2.1/2.2
    done once it is green.
  - Not covered by the CI job (build-only); run these on the first pulled
    `ai-dial-chat-bff:development` image:
  - `docker run --rm --entrypoint sh ai-dial-chat-bff:local -c 'test -f apps/chat-api/dist/main.js && test ! -e apps/chat/dist && test ! -e apps/chat-overlay-sandbox/dist && ! command -v npm'`
    exits 0.
  - Start the container with a minimal valid env (`apps/chat-api/.env.template` values):
    `curl -s localhost:5000/api/health` returns 200 with `status: "ok"`, and
    `curl -s -o /dev/null -w '%{http_code}' localhost:5000/` prints `404`.

## 3. `buildId` fallback from the app version

- [x] 3.1 In `apps/chat-api/src/health/health.controller.ts`, replace the module-level
      `BUILD_ID` with a value computed once in the constructor. When
      `join(resolveFrontendRootPath(), 'index.html')` is readable, hash that file (unchanged).
      Otherwise use `sha256(this.appVersion).hex.slice(0, 12)`. Replace the stale
      "never runs against a real deployment" block comment. Update the Swagger `buildId`
      description to name both sources.
- [x] 3.2 Extend `apps/chat-api/src/health/health.controller.spec.ts` with tests, named by
      behaviour, that cover:
      the build identifier is derived from the frontend `index.html` when it exists; without a
      frontend it is the 12-char SHA-256 prefix of the resolved version; two different
      `CHAT_VERSION` values yield different identifiers without a frontend; the identifier is
      stable across repeated calls. Stub `resolveFrontendRootPath`/`readFileSync` as the existing
      spec does.
- [x] 3.3 Run `npm run openapi` and then `npm run openapi:check`. Commit
      `libs/chat-api-client/openapi.json` only if the `buildId` description changed there. Do
      not hand-edit generated client files.

  **Verification**
  - `npm run test:file -- apps/chat-api/src/health/health.controller.spec.ts`
  - `npm run test:file -- apps/chat-api/src/app/tests/static-assets.spec.ts` (regression: no
    behaviour change expected)
  - `npm run verify:changed`

## 4. CI: publish with `ai-dial-chat`

- [x] 4.1 In `.github/workflows/release.yml`, add a `release_bff_image` job cloned from
      `release_mcp_app_sandbox_image`: same `permissions`, pinned `actions/checkout`,
      `semantic_versioning@4.11.0` with the same `promote` expression, and a
      `hashFiles('apps/chat-api/Dockerfile')` step guard. Add a
      `npm version "<next-version>" --no-git-tag-version --allow-same-version` step before
      `build_docker@4.11.0`, then pass `dockerfile-path: apps/chat-api/Dockerfile` and
      `IMAGE_NAME: ${{ github.repository }}-bff`. Keep the same `image-tags` expressions as the
      sandbox job. Update the explanatory comment block above the job to say why it is a
      sibling job and why it stamps the version.

  **Verification**
  - `npx --yes @action-validator/cli .github/workflows/release.yml` (or `actionlint` if it is
    available locally) reports no errors.
  - After merge to `development`: the Release Workflow run shows `release_bff_image` green,
    and `docker pull ghcr.io/epam/ai-dial-chat-bff:development` succeeds.

## 5. CI: validate on pull requests

- [x] 5.1 In `.github/workflows/pr.yml`, add a `docker_build_bff` job cloned from
      `docker_build_mcp_app_sandbox`: build only, `image-names: ghcr.io/${{ github.repository }}-bff`,
      `image-tags: test`, `dockerfile-path: apps/chat-api/Dockerfile`, with the same
      `hashFiles` guard and a comment.

  **Verification**
  - The workflow validator from 4.1 passes on `pr.yml`.
  - The PR for this change shows `Build BFF image (validation only)` green.

## 6. Documentation

- [x] 6.1 Root `README.md` › Production Deployment: add a short list of the published images
      (`ai-dial-chat`: BFF + SPA + overlay sandbox; `ai-dial-chat-bff`: BFF only, `/` returns 404,
      frontend hosted elsewhere; `ai-dial-chat-mcp-app-sandbox`), with the Dockerfile each is
      built from and the note that they share tags per release.
- [x] 6.2 `apps/chat-api/README.md`: add a "Docker image (BFF only)" section with the build
      command, what is excluded, the unchanged env contract, the `buildId` rule without a
      frontend, and the dev-branch limitation (set `CHAT_VERSION` for per-commit reload
      detection).
- [x] 6.3 `docs/architecture.md`: add one paragraph after the monorepo tree listing the three
      images and their Dockerfiles, linking to the `apps/chat-api/README.md` section instead of
      repeating it.
- [ ] 6.4 Record follow-ups in the PR description, not as code: a `deploy-development.yml`
      `development-bff` environment (needs a GitLab project id); `cleanup-untagged-images.yml`
      coverage of the `-bff` and `-mcp-app-sandbox` GHCR packages; an ai-dial-ci `target` input
      to fold the three Dockerfiles into one.

  **Verification**
  - `npm run validate:docs`

## 7. Final verification

- [x] 7.1 `npm exec nx lint chat-api` and `npm exec nx build chat-api`
- [ ] 7.2 `npm run verify:full` (once, at the end)
