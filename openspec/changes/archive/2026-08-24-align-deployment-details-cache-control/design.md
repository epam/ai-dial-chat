## Context

The endpoint currently caches `DeploymentDetailsDto` in the BFF for 60 seconds under `deployments:details:<userSub>:<deployment>`. Toolset create/update/delete/login/logout flows invalidate the affected entry because the detail response includes mutable user-level authentication status. PR #7839 removed the original browser-facing `private, max-age=60` header, but the main OpenSpec retained the pre-#7839 cache contract and an external automation scenario continued to assert it.

The controller's current description says that omitting `Cache-Control` prevents browsers from serving stale data. That is weaker than the intended contract: HTTP caches may apply heuristic freshness when no explicit policy is present. RFC 9111 section 5.2.2.5 defines `no-store` as prohibiting storage and reuse by both private and shared caches.

## Goals / Non-Goals

**Goals:**

- Make the client-facing cache policy explicit and testable without changing the existing BFF cache.
- Align the canonical OpenSpec with the current user-scoped key and toolset invalidation behavior.
- Preserve every request/response DTO, status code, auth rule, throttle, generated SDK method, and frontend call site.

**Non-Goals:**

- Changing the 60-second server-side TTL or the existing cache-manager implementation.
- Adding frontend caching, changing catalog fetch timing, or modifying `libs/catalog`.
- Exposing response headers through a new generated-client `Raw` call.
- Adding UI, i18n, RTL, accessibility, feature-flag, telemetry, or memoisation behavior.

## Decisions

### Use `Cache-Control: private, no-store`

`DeploymentsController.getDeploymentDetails` will follow the existing mutable-user-data pattern used by deployment limits and return `private, no-store`. `no-store` is the operative directive; `private` makes the user-specific nature of the endpoint explicit and stays consistent with repository conventions.

Alternatives:

- `private, max-age=60` was rejected because browser freshness can outlive a BFF invalidation and can reuse a response after toolset credentials or the active identity changes.
- No header was rejected because it relies on cache heuristics and does not encode the intended guarantee.
- `private, no-cache` would permit storage but require validation. It was rejected because the BFF already owns the useful cache and the response contains mutable user-specific auth state, so retaining a browser copy has no material benefit.

### Keep server-side caching unchanged

The BFF cache remains `deployments:details:<userSub>:<deployment>` with a 60,000 ms TTL and in-flight request deduplication on the same key. Existing toolset writes invalidate the affected user's entry through `DeploymentsDetailsService.invalidateDetailsCache`. The HTTP header changes only browser/intermediary behavior.

### Preserve the generated client contract

The endpoint remains authenticated `GET /api/v1/deployments/{deployment}/details`, throttled at 60 requests per minute, with `operationId: getDeploymentDetails`, the same path DTO, response DTO, and error mapping. The normal generated `DeploymentsApi.getDeploymentDetails({ deployment })` call remains correct because callers do not need to inspect the header.

## Risks / Trade-offs

- [Every details fetch reaches the BFF instead of being served directly from a browser cache] → The BFF's user-scoped 60-second cache and in-flight deduplication avoid repeated DIAL Core work; one local BFF request is the intentional cost of fresh auth state.
- [The redundant `private` directive could be viewed as unnecessary beside `no-store`] → Keep it for consistency with existing user-specific endpoints and to communicate ownership clearly.

## Migration Plan

Ship as a non-breaking response-header hardening. No data migration or frontend rollout is required. Regenerate OpenAPI artifacts because the Swagger description changes, then archive this OpenSpec change so the main capability reflects the deployed contract. Roll back by removing the header decorator and reverting the spec/test updates.

## Open Questions

None.
