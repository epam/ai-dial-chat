## ADDED Requirements

### Requirement: UI_EVENT selects one decorative event

UI_EVENT SHALL be an optional validated lowercase kebab-case identifier. An absent value or `none` SHALL resolve to null; other valid identifiers SHALL be exposed as config.activeEventId:string|null by existing GET /api/v1/client-config. Unknown valid IDs SHALL be allowed through the API and result in no decoration when absent from the frontend registry. HALLOWEEN_ENABLED and features.halloweenEnabled SHALL be removed with no fallback. There SHALL be no new role-gating flag or scheduling behavior. Existing endpoint authentication, status codes, configuration cache and refresh behavior SHALL be retained. Swagger and the generated AppConfigApi.getClientConfig response model SHALL reflect the new config field; callers SHALL continue using the normal method through the existing app adapter.

#### Scenario: Event explicitly selected
- **WHEN** UI_EVENT is halloween or new-year
- **THEN** GET /api/v1/client-config returns the corresponding string in config.activeEventId

#### Scenario: Old configuration only
- **WHEN** only the removed HALLOWEEN_ENABLED variable is set
- **THEN** config.activeEventId is null and no seasonal decoration is enabled

#### Scenario: Explicit off
- **WHEN** UI_EVENT is none
- **THEN** config.activeEventId is null

## REMOVED Requirements

### Requirement: Registry contains the halloweenEnabled client feature key

**Reason**: UI_EVENT is the sole event selector; separate per-holiday flags are removed.
**Migration**: Replace HALLOWEEN_ENABLED=true with UI_EVENT=halloween.
