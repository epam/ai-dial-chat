## Context

`GET /api/v1/deployments` doesn't expose tool-calling support per item, so a consumer
of the list endpoint has no way to filter deployments by tool-calling support without
making a separate details request per item. Investigation found this is a plain
passthrough gap in the list mapper, not a missing upstream capability:
`DeploymentsListingService.listDeployments`
(`apps/chat-api/src/deployments/listing/deployments-listing.service.ts`) already
fetches the exact same DIAL Core `/v1/deployments` response the details endpoints
later re-derive `features.tools` from — the field is already present in that
response, in the same `features` object `mapToDeploymentItem` already reads
`system_prompt`/`temperature`/`mcp`/etc. from. The existing unit test fixture
`{ ...mockApplication, features: { tools: true } }`
(`deployments-listing.service.spec.ts:717`) already sends the mapper a raw item
carrying `features.tools`, and the current assertions only check that
`skillsSupported` stays `undefined` on that item — they never assert anything about
`tools`, because `mapToDeploymentItem` silently drops it today. So no DIAL Core
change, no second API call, and no N+1 fan-out are needed.

## Goals / Non-Goals

**Goals:**

- Make `GET /api/v1/deployments` report `features.tools` per item, computed from the
  same request the endpoint already makes, so a consumer can filter the list by
  tool-calling support without a per-item details round trip.
- Keep the field's semantics identical to `DeploymentFeaturesDetailsDto.tools`
  (`apps/chat-api/src/deployments/dto/deployment-details.dto.ts:137`): `true` when
  DIAL Core reports the deployment as tool-calling-capable, omitted otherwise — same
  optional-boolean convention as every other `DeploymentFeaturesDto` member besides
  `systemPrompt`/`temperature`.

**Non-Goals:**

- A server-side `?tools=true` filter query parameter on `GET /api/v1/deployments`.
  The ask is for the flag to be visible so a client can filter; a server-side filter
  is a separate, unrequested enhancement and would need its own design (query
  validation, cache-key interaction, `DeploymentsQueryDto` changes).
- Any change to toolset-typed list items — `DeploymentsListingService` already
  excludes toolsets from `/api/v1/deployments` responses entirely (line 202-218's
  `TODO`), independent of this change.
- Frontend (`apps/chat`) consumption of the new field. `apps/chat` doesn't read
  `DeploymentFeaturesDto` for tool-calling today and nothing asks it to.

## Decisions

**Read `features.tools` the same way `mapDeploymentFeatures` already does for
details, but inline in `mapToDeploymentItem` rather than by reusing
`mapDeploymentFeatures` itself.** `mapDeploymentFeatures`
(`deployment-mapper.util.ts:170-214`) returns a `DeploymentFeaturesDetailsDto` — a
much richer 20+-field shape — and is purpose-built for the details response. Calling
it from the list mapper and re-narrowing its result back down to
`DeploymentFeaturesDto`'s 8 fields would add an indirection with no benefit over
reading `raw.features?.tools` directly, the same way `mapToDeploymentItem` already
reads `responses_api`/`chat_completion`/`skills_supported` inline rather than through
`mapDeploymentFeatures`. Alternative considered: extract a small shared
`getBoolean(raw.features, 'tools')` call (the mapper util already exports `getBoolean`
for exactly this) — this is in fact the concrete implementation, consistent with how
`chatCompletion`/`responsesApi`/`skillsSupported` are each mapped with the same
`raw.features?.X === true` pattern one line above where `tools` will go.

**Only add `tools` to `DeploymentFeaturesDto` and `RawDeploymentFeaturesDto`; leave
`DeploymentFeaturesDetailsDto` untouched.** It already has `tools`
(`deployment-details.dto.ts:137`) — this change extends the list-item DTO to match,
not the details DTO.

**No caching changes.** Per the `deployments-api` spec's existing pattern for
`skillsSupported`/`mcp`/etc. ("None of these fields participates in any
deployments-list caching key or filtering behavior; they are additive metadata
only"), `features.tools` follows the same rule — it's part of the cached
`DeploymentItemDto[]` payload (cached under `deployments:list:<userSub>[:interface:<type>]`
for 30 000 ms, same as every other field on the item) but never a cache-key input and
never part of `interface_type` filtering.

**Regenerate the OpenAPI contract in the same change.** Per
`apps/chat-api/AGENTS.md` / `.claude/rules/nestjs-best-practices.md`, any DTO field
change requires `npm run openapi` + `npm run openapi:check`, and a build/lint pass of
`libs/chat-api-client` so the generated SDK type picks up `tools?: boolean` on
`DeploymentFeaturesDto`.

## Risks / Trade-offs

- **[Risk] The `features.tools` field might not be present in every DIAL Core
  deployment (only some deployment types compute it) → Mitigation:** the mapping
  reads it defensively (`getBoolean`, returns `undefined` for anything non-boolean or
  absent), exactly like every sibling field on `DeploymentFeaturesDto`. A deployment
  that doesn't report `tools` simply omits the field from its mapped `features`,
  which is indistinguishable from "not tool-calling-capable" to a client filtering on
  truthiness — the same ambiguity `skillsSupported`/`responsesApi` already accept.
- **[Risk] The one hard fact this design rests on — that DIAL Core's list payload
  already includes `features.tools` — comes from a test fixture, not a live Core
  response or its OpenAPI spec → Mitigation:** task list includes verifying this
  against a real (or logged) `/v1/deployments` raw response before merging; if it
  turns out the list endpoint's Core-side payload does NOT actually include `tools`
  in practice (i.e. the test fixture was aspirational rather than observed), the
  `tools` field will simply come back `undefined` for every item — a silent,
  non-breaking no-op — and filtering by tool-calling support would then genuinely
  require a DIAL Core change after all, which is out of scope for chat-api alone.

## Migration Plan

Purely additive, optional field on an existing 200 response — no version bump, no
client-breaking change, no data migration. Deploy backend and regenerate
`libs/chat-api-client` together (existing OpenAPI regen scripts already enforce this
via `npm run openapi:check` in CI). Rollback is a plain revert; no persisted state is
introduced.

## Open Questions

- Does `DeploymentItemDto shape`'s existing spec capability (`deployments-api`) need a
  scenario asserting `features.tools` is excluded from cache-key composition
  explicitly, the way `skills_supported does not change list caching or filtering` do
  for its field? (Answered — yes, added as a matching scenario in this change's delta
  spec.)
- Should `apps/chat-api/README.md`'s API reference (if it enumerates
  `DeploymentFeaturesDto` members) be updated in the same change? Verify during
  implementation per `.claude/rules/docs.md`'s same-change rule and run
  `npm run validate:docs`.
