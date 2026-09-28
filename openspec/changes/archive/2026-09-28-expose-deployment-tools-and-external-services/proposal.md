## Why

We need the ability to see, directly from the deployments list, whether a given
deployment supports tool calling — without issuing a separate details request per
item. `GET /api/v1/deployments` (the list endpoint) currently has no way to report
that per item, so a consumer that needs to filter the list by tool-calling support
can't do it from the list response alone. The list mapper already receives this flag
from DIAL Core in the same response it already fetches — it just isn't copied
through — so this is a same-request passthrough, not a new upstream capability or an
N+1 lookup.

## What Changes

- Add a `tools` boolean to `DeploymentFeaturesDto` (`apps/chat-api/src/deployments/dto/deployment-item.dto.ts`),
  the list-item features type returned by `GET /api/v1/deployments`. Optional, following
  the existing convention for every other flag on that DTO except the two required ones.
- Add `tools?: boolean` to `RawDeploymentFeaturesDto` (`apps/chat-api/src/deployments/dto/raw-deployment.dto.ts`)
  so the raw-payload type documents the field the mapper now reads.
  DIAL Core's `/v1/deployments` list response already returns this field inside each
  item's `features` object — the same `DeploymentWithFeatures`-derived shape the
  details endpoints (`getModel`/`getApplication`/`getToolset`) expose as
  `DeploymentFeaturesDetailsDto.tools`. This is evidenced by the existing test fixture
  `{ ...mockApplication, features: { tools: true } }` in
  `deployments-listing.service.spec.ts:717`, which chat-api's own list mapper already
  receives and silently drops today.
- Extend `mapToDeploymentItem` (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`)
  to copy `raw.features?.tools` into the mapped item's `features.tools`, following the
  same truthy-only-when-true convention already used for `responsesApi`, `chatCompletion`,
  and `skillsSupported` on that function (a `DeploymentFeaturesDto` field is included only
  when Core reports it `true`; `false`/absent stays omitted).
- Regenerate the OpenAPI contract (`npm run openapi`) and verify it (`npm run openapi:check`)
  so `libs/chat-api-client` picks up the new field.
- Document the field in `apps/chat-api/README.md`'s API reference, if that doc enumerates
  `DeploymentFeaturesDto` members (verify during design/implementation).

## Capabilities

### New Capabilities

(none — this extends an existing response shape, not a new capability)

### Modified Capabilities

- `deployment-listing`: `GET /api/v1/deployments` items now report `features.tools`
  when DIAL Core marks the deployment as tool-calling-capable, matching what
  `GET /api/v1/deployments/{deployment}`'s `features.tools` already reports for the
  same deployment. (Check `openspec/specs/` for the exact existing spec name/path
  during the `specs` artifact step; this proposal assumes the listing behavior is
  covered by a `deployment-listing`-named capability or equivalent — confirm and
  adjust the delta spec's path to match.)

## Non-goals

- No change to `GET /api/v1/deployments/{deployment}` (`DeploymentFeaturesDetailsDto`)
  — it already has `tools`.
- No new query-parameter filter (e.g. `?tools=true`) on `GET /api/v1/deployments` —
  the ask is for the flag to be visible per item so a consumer can filter client-side;
  a server-side filter param is a separate, non-requested enhancement.
- No change to toolset list items — `DeploymentsListingService` already excludes
  toolset entries from `/api/v1/deployments` (see the `TODO` at
  `deployments-listing.service.ts:202-215`), so `features.tools` on a toolset item is
  not reachable through this endpoint regardless of this change.

## Impact

- **Affected code:** `apps/chat-api/src/deployments/dto/deployment-item.dto.ts`,
  `apps/chat-api/src/deployments/dto/raw-deployment.dto.ts`,
  `apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`, their existing specs
  (`deployments-listing.service.spec.ts`, and any `deployment-mapper.util.spec.ts` if one
  exists — verify during implementation), and the generated OpenAPI contract consumed by
  `libs/chat-api-client`.
- **Affected APIs:** `GET /api/v1/deployments` response body — additive, optional field;
  not a breaking change. No version bump needed under existing URI-versioning
  conventions (`/api/v1/deployments` stays `v1`).
- **Dependencies:** none beyond the OpenAPI regen scripts already in the repo
  (`npm run openapi`, `npm run openapi:check`).
- **Consumers:** any consumer of `GET /api/v1/deployments` gains the ability to filter
  the list by tool-calling support without a per-item details round trip. No frontend
  (`apps/chat`) consumption change is included in this proposal — `apps/chat` does not
  currently read `DeploymentFeaturesDto.tools` from the list and isn't asked to.
- **i18n:** none — this is a backend DTO field with no user-visible string.
</content>
</invoke>
<invoke name="Read">
<parameter name="file_path">C:\projects\dial\ai-dial-chat\openspec\changes\expose-deployment-tools-and-external-services\tasks.md