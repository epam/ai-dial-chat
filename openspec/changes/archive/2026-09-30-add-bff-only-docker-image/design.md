## Context

- **Root image** (`Dockerfile`): stages `node-base` → `deps` → `builder` → `runner`. The
  `builder` stage runs `nx run-many -t build -p @epam/chat,chat-overlay-sandbox` and then
  `nx run chat-api:prune`. The `runner` stage copies `apps/chat-api/dist`, runs
  `npm ci --omit=dev`, strips npm, then copies `apps/chat/dist` and
  `apps/chat-overlay-sandbox/dist`. CI publishes it as `epam/ai-dial-chat` through
  `epam/ai-dial-ci/.github/workflows/node_release.yml@4.12.0`. That workflow builds exactly
  one Dockerfile per call.
- **Precedent**: `apps/mcp-app-sandbox/Dockerfile` uses the same `node-base`/`deps` stages,
  prunes a single NestJS app, and copies no static files. It is published by a sibling job in
  `release.yml` (`release_mcp_app_sandbox_image`) and validated by `docker_build_mcp_app_sandbox`
  in `pr.yml`.
- **CI constraint**: `epam/ai-dial-ci/actions/build_docker@4.11.0` has these inputs:
  `image-names`, `image-tags`, `dockerfile-path`, registry credentials, `platforms`,
  `push-enabled`, `trivy-*`. It always uses `context: .`. It has **no `target` and no
  `build-args` input**.
- **Nx graph**: `@epam/chat-api` has no project dependency on `@epam/chat` or
  `chat-overlay-sandbox`. Its `build` depends on `^build`/`^typecheck` of workspace libs only.
  So `nx run chat-api:prune` on its own never builds the frontend.
- **Runtime already tolerates a missing frontend**: `createFrontendMiddleware`
  (`apps/chat-api/src/app/static-assets.ts:110-123`) reads `index.html` only if it exists. With
  `template == null`, `serveHtml` calls `next()`, `express.static` finds nothing, and the
  request reaches Nest's 404. `GET /api/health` computes `buildId` with a `try/catch` and falls
  back to `"dev"` (`apps/chat-api/src/health/health.controller.ts:12-24`).
- **Version stamping**: `resolveAppVersion` (`apps/chat-api/src/common/utils/app-version.ts`)
  inlines the root `package.json` `version` at bundle time. `node_release.yml` stamps it with
  `npm version <next> --no-git-tag-version` before building the main image. The
  mcp-app-sandbox job **does not** stamp it, so its bundle reports the committed root version.

## Goals / Non-Goals

**Goals:**

- A BFF-only image built from the same commit as `ai-dial-chat`, with identical tags, in the
  same Release Workflow run.
- No change to the root `Dockerfile`, the `ai-dial-chat` image, or the shared ai-dial-ci
  workflows.
- `buildId` stays meaningful for clients polling a BFF-only deployment.

**Non-Goals:**

- A frontend-only image, CDN packaging, or Helm chart changes.
- Adding the image to `deploy-development.yml`. This is a follow-up that needs a GitLab
  project id.
- Multi-arch builds beyond what `build_docker` does by default.
- Removing the duplication between the three Dockerfiles, for example with a shared base
  image. See Risks.

## Decisions

### D1. Separate Dockerfile at `apps/chat-api/Dockerfile`

A separate file is **required**, not only preferred. `build_docker` cannot select a stage or
pass build args, so the root `Dockerfile` can yield only its final stage. Placing the file in
the app folder matches `apps/mcp-app-sandbox/Dockerfile`, and it keeps the root `Dockerfile`
meaning "the full chat image".

Alternatives:

- `Dockerfile.bff` at the root. It works just as well, but it breaks the "an app's own image
  lives in the app folder" convention the sandbox set.
- A `bff` stage plus `--target`. This needs a new ai-dial-ci release with a `target` input and
  a bump of every `@4.11.0` pin. Rejected for now, and recorded as the path to remove the
  duplication later.

Contents: copy `node-base` and `deps` verbatim from the root `Dockerfile`. The `builder` stage
runs only `npm exec nx run chat-api:prune`. The `runner` stage is the root `runner` minus the
two static `COPY` lines, keeps `EXPOSE 5000` and `CMD ["node", "apps/chat-api/dist/main.js"]`,
and carries a header comment saying that this is the root image minus the frontend and that the
two files must be kept in sync.

The build context stays the repository root. The root `.dockerignore` applies unchanged:
BuildKit uses `<Dockerfile>.dockerignore` only if one exists, and we add none.

### D2. Publish from a sibling job in `release.yml`

Add `release_bff_image`, cloned from `release_mcp_app_sandbox_image`:
`semantic_versioning@4.11.0` with the same `promote` expression, then `build_docker@4.11.0`
with `IMAGE_NAME: ${{ github.repository }}-bff`, the same tag expressions, and
`push-enabled: true`. The job adds one step that the sandbox job lacks, run before
`build_docker`:

```yaml
- name: Stamp release version
  run: npm version "${{ steps.semantic_versioning.outputs.next-version }}" --no-git-tag-version --allow-same-version
```

This runs on the checked-out tree. Because the Docker build context is `.`, the stamped
`package.json` is what `COPY . .` picks up. It needs no `npm ci` (`npm version` edits only the
manifest and lockfile). It also needs no `actions/setup-node`, because the ubuntu runner ships
with Node/npm. Without this step, the BFF-only image would report a different `version`, and
therefore a different `buildId`, than `ai-dial-chat` from the same run.

Why not a job that depends on `release`: `node_release.yml` does not expose its version outputs,
and a `needs:` chain would serialize the builds for no benefit. Recomputing the version is
deterministic for the same commit, and the sandbox job already relies on that.

### D3. PR validation job

Add `docker_build_bff`, cloned from `docker_build_mcp_app_sandbox`: build only, `image-tags:
test`, and no credentials. It runs in parallel with `run_tests`.

### D4. `buildId` fallback: hash of the resolved app version

Change `computeBuildId` in `apps/chat-api/src/health/health.controller.ts` so that, when
`index.html` cannot be read, it returns
`sha256(resolveAppVersion(CHAT_VERSION)).hex.slice(0, 12)` instead of `"dev"`.

- `BUILD_ID` is a module-level constant today, computed before `ConfigService` exists. Move
  the computation into the controller constructor, next to the existing `appVersion`
  resolution, so it can use the same resolved version. It remains once per process, because
  the controller is a singleton.
- The full image is unaffected: when `index.html` exists, the hash of that file still wins.
- Local API-only dev gets a stable per-version value instead of `"dev"`. Clients compare only
  equality, so nothing depends on the literal `"dev"`. Update the stale comment ("this path
  never runs against a real deployment").
- Update the Swagger `buildId` description to cover both sources. This changes only the
  description text, not the schema shape. Run `npm run openapi` and commit the regenerated
  `libs/chat-api-client/openapi.json` if the description is emitted there, and run
  `npm run openapi:check`.

Alternatives: hash the BFF's own `main.js`. It would change on every code change, even
without a version bump, but the user chose the version as the source. It is recorded under
Open Questions for development builds. Leaving `"dev"` was rejected, because it silently
disables new-version detection for BFF-only deployments.

Authorization: `GET /api/health` stays `@Public()`. Its response shape does not change.

### D5. Registries and cleanup

- Docker Hub: someone with EPAM org rights must create `epam/ai-dial-chat-bff` before the
  first `development` push after merge. Otherwise the push step fails and the Release
  Workflow run is marked failed, although `ai-dial-chat` itself is still published by its own
  job.
- GHCR: the package `ai-dial-chat-bff` is created on the first push, owned by the repo. After
  that first push, check that it is linked to `epam/ai-dial-chat` and has the same visibility
  (public) as the sibling packages.
- `cleanup-untagged-images.yml` runs `dataaxiom/ghcr-cleanup-action` without a `package`
  input, which defaults to the repository's own package. Extending it to the `-bff` (and the
  existing `-mcp-app-sandbox`) packages is a separate, low-risk follow-up and is not part of
  this change.

## Risks / Trade-offs

- [Three Dockerfiles repeat the same `node-base`/`deps` stages. A future npm or Node base
  bump could miss one] → A header comment in each file names its siblings. The root
  `README.md` Production Deployment section lists all three images. The long-term fix is D1's `target`
  alternative, once ai-dial-ci supports it.
- [On `development`, `semantic_versioning` may return the same `next-version` for several
  pushes. The BFF-only `buildId` would then not change between those dev deploys, and open
  tabs would not be prompted to reload] → Deployments that need per-commit detection set
  `CHAT_VERSION` (for example `<version>-<sha>`), which feeds both `version` and `buildId`.
  This limitation is documented in `apps/chat-api/README.md`. See Open Questions.
- [A BFF-only deployment with the frontend hosted elsewhere: `buildId` tracks the BFF
  version, not the frontend bundle's] → This is acceptable, because both are released
  together with the same version. It is documented next to the image.
- [The Docker Hub repository is missing on the first run] → The D5 prerequisite is listed as
  task 1.1.
- [The image is bigger than needed because the builder copies the full monorepo] → This is
  the same as mcp-app-sandbox. Only the pruned `dist` reaches the final stage, so the runtime
  size is unaffected.

## Migration Plan

1. Create the Docker Hub repository `epam/ai-dial-chat-bff` (prerequisite).
2. Merge the change. The PR job builds the image, and the first `development` push publishes
   `ai-dial-chat-bff:development`.
3. Deployers that host the frontend separately switch their BFF workload from
   `ai-dial-chat:<tag>` to `ai-dial-chat-bff:<same tag>` with the same environment.

**Rollback:** revert the PR. The `ai-dial-chat` image is untouched. Published `-bff` tags stay
until they are deleted manually. The `buildId` fallback revert only changes BFF-only and local
dev values.

## Open Questions

- Does `semantic_versioning` produce a distinct `next-version` per `development` push? If not,
  should the BFF-only fallback additionally mix in `GITHUB_SHA`, baked in at build time? This
  can be decided after the first dev run by comparing two consecutive `version` values.
- Should `deploy-development.yml` gain a `development-bff` environment? This needs a GitLab
  project id from the deployment team.
