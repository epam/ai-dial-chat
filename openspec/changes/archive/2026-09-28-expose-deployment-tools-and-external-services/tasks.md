## 1. Backend DTO and mapping

- [x] 1.1 Add `tools?: boolean` to `RawDeploymentFeaturesDto` in
      `apps/chat-api/src/deployments/dto/raw-deployment.dto.ts`, matching the existing
      member style (optional, no decorator — it's a plain raw-payload interface).
- [x] 1.2 Add `tools?: boolean` to `DeploymentFeaturesDto` in
      `apps/chat-api/src/deployments/dto/deployment-item.dto.ts`, with an
      `@ApiPropertyOptional({ description: 'Whether the deployment supports tools/functions in chat completion requests' })`
      decorator matching `DeploymentFeaturesDetailsDto.tools`'s description
      (`deployment-details.dto.ts:134-137`).
- [x] 1.3 In `mapToDeploymentItem`
      (`apps/chat-api/src/deployments/utils/deployment-mapper.util.ts:283-302`), add
      `...(raw.features?.tools === true && { tools: true })` to the `features` object
      literal, alongside the existing `responsesApi`/`chatCompletion`/`skillsSupported`
      spreads, following the identical truthy-only-when-true pattern already used
      there.

## 2. Backend tests

- [x] 2.1 In `apps/chat-api/src/deployments/listing/tests/deployments-listing.service.spec.ts`,
      add a scenario asserting a raw item with `features: { tools: true }` maps to
      `result.deployments[i].features.tools === true` (the existing fixture at line
      717 already sends this shape but only asserts on `skillsSupported` — add the
      missing assertion there or as a new adjacent `it`, whichever reads more clearly
      alongside the existing `skillsSupported`/`responsesApi` test groups).
- [x] 2.2 Add a scenario asserting a raw item with no `features.tools` (or a
      non-boolean value there, e.g. `features: { tools: 'yes' }`) maps to
      `result.deployments[i].features?.tools === undefined`, mirroring the existing
      "maps differing skills_supported values" / non-boolean-value tests in the same
      file (see the `skills_supported: 'yes'` case around line 696).
- [x] 2.3 Add a scenario confirming `features.tools` does not affect the cache key or
      `interface_type` filtering — two items differing only in `features.tools` both
      appear in the response with their respective values, and
      `cacheManager.set` is called with the same key shape as the existing
      `skills_supported` caching test (mirrors the "does not change list caching or
      filtering" pattern at line ~710-735).

## 3. Contract regeneration

- [x] 3.1 Run `npm run openapi` to regenerate `libs/chat-api-client/openapi.json` and
      the generated SDK types with the new `tools` field on `DeploymentFeaturesDto`.
- [x] 3.2 Run `npm run openapi:check` to verify the regenerated contract matches the
      DTO annotations with no drift.
- [x] 3.3 Build and lint `chat-api-client`
      (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`) to
      confirm the regenerated types compile cleanly.

## 4. Documentation check

- [x] 4.1 Check whether `apps/chat-api/README.md`'s API reference enumerates
      `DeploymentFeaturesDto` members elsewhere (it currently references
      `features.skillsSupported`/`features.responsesApi` only in specific
      feature-flag contexts, not as a full field list — confirm this is still true
      before deciding whether an update is needed). If a full enumeration exists,
      add `tools` to it in the same change.
- [x] 4.2 Run `npm run validate:docs` to confirm no README/docs drift was introduced.

## 5. Verification

- [x] 5.1 Run `npm run test:file -- apps/chat-api/src/deployments/listing/tests/deployments-listing.service.spec.ts`
      and confirm the new and existing scenarios pass.
- [x] 5.2 Run `npm run verify:changed` once this slice is complete.
- [x] 5.3 Run `npm run verify:full` once, at the end of the change, before requesting
      review.
