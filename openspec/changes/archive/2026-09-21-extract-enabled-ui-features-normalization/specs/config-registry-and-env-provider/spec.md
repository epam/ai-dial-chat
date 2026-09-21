## MODIFIED Requirements

### Requirement: Unrecognized entries are filtered with a warning at the service layer, not at env validation

`AppConfigService.getClientConfig` SHALL filter the resolved `uiFeatures.enabledUiFeatures` list to values that are members of the shared `OverlayFeature` enum before including it in the response, logging a `warn`-level message (naming the unrecognized value) for each entry dropped. When all entries are unrecognized, the service SHALL log an additional warning and return `null` (falling back to compiled-in defaults), rather than sending an empty array that would break the entire UI. This filtering SHALL NOT cause application boot to fail and SHALL NOT reject the request — the response always returns `200 OK`.

Membership SHALL be decided against the app-local `KNOWN_UI_FEATURES` allowlist and `DEPRECATED_UI_FEATURE_ALIASES` map (`apps/chat-api/src/app-config/known-ui-features.constants.ts`), which mirror `OverlayFeature` and `DEPRECATED_OVERLAY_FEATURE_ALIASES` without importing the browser-facing overlay package into this Node-only service.

Normalization SHALL apply the following rules, in this order:

1. A resolved value that is not an array — including the `null` default — SHALL yield `null` with no warning. An empty array SHALL likewise yield `null` with no warning.
2. Each entry SHALL be coerced with `String(entry)` before any lookup. No trimming, case folding, or other input canonicalization SHALL be applied at this layer; `ENABLED_UI_FEATURES` trimming remains the responsibility of `EnvConfigProvider`.
3. The deprecated-alias map SHALL be consulted **before** the allowlist. An entry matching an alias SHALL emit one `warn` naming both the deprecated value and its replacement, and SHALL contribute the replacement value.
4. An entry not matching an alias but present in the allowlist SHALL contribute its own value unchanged.
5. Any other entry SHALL emit one `warn` naming it, and SHALL contribute nothing.
6. Warnings SHALL be emitted per occurrence, in input order, before deduplication. A repeated deprecated or unrecognized entry SHALL therefore warn once per occurrence.
7. Accepted values SHALL be deduplicated **after** alias resolution, preserving first occurrence, so an alias and its canonical name supplied together collapse to one value at the earlier position.
8. A non-empty input that yields no accepted values SHALL emit one additional `warn` stating that compiled-in defaults are used, and SHALL yield `null`.

The resolved input array, the allowlist, and the alias map SHALL NOT be mutated, and no state SHALL be retained between requests.

A cached client-config response SHALL be returned without re-resolving providers, so a cache hit SHALL produce no normalization warnings.

#### Scenario: Unrecognized entry is dropped and logged

- **WHEN** `ENABLED_UI_FEATURES=header,not-a-real-feature` is set
- **THEN** `config.enabledUiFeatures` in the client-config response is `['header']`, and a warning naming `'not-a-real-feature'` is logged

#### Scenario: All-unrecognized input falls back to null, not an empty list

- **WHEN** `ENABLED_UI_FEATURES=totally-invalid` is set
- **THEN** the response is still `200 OK` with `config.enabledUiFeatures: null` (compiled-in defaults are used), and a warning is logged

#### Scenario: Absent, non-array, or empty input yields null silently

- **WHEN** the resolved `uiFeatures.enabledUiFeatures` value is `null`, a non-array value, or an empty array
- **THEN** `config.enabledUiFeatures` is `null` and no normalization warning is logged

#### Scenario: Recognized entries keep their input order

- **WHEN** `ENABLED_UI_FEATURES=likes,header,prompts` is set
- **THEN** `config.enabledUiFeatures` is `['likes', 'header', 'prompts']` in that order, and no warning is logged

#### Scenario: A deprecated alias resolves to its replacement with a naming warning

- **WHEN** `ENABLED_UI_FEATURES=likes,custom-applications` is set
- **THEN** `config.enabledUiFeatures` is `['likes', 'schema-apps']`, and one warning naming both `'custom-applications'` and `'schema-apps'` is logged

#### Scenario: An alias and its canonical name collapse at the first occurrence

- **WHEN** `ENABLED_UI_FEATURES=schema-apps,custom-applications` is set
- **THEN** `config.enabledUiFeatures` is `['schema-apps']` — one entry, at the position of the first occurrence

#### Scenario: Repeated invalid entries warn once per occurrence

- **WHEN** the resolved list contains the same unrecognized value twice, or the same deprecated alias twice
- **THEN** the corresponding warning is logged twice, in input order, and the accepted result still carries the value at most once

#### Scenario: Non-string entries are coerced before lookup

- **WHEN** the resolved list contains a non-string entry such as `42`
- **THEN** it is evaluated as `'42'`, fails both the alias and allowlist lookups, and is reported by a warning naming `"42"`

#### Scenario: Normalization leaves its inputs untouched

- **WHEN** a client-config response is produced from any resolved `uiFeatures.enabledUiFeatures` value
- **THEN** the resolved input array is unchanged, and `KNOWN_UI_FEATURES` and `DEPRECATED_UI_FEATURE_ALIASES` still hold exactly their declared members

#### Scenario: A cache hit produces no warnings

- **WHEN** a second `GET /api/v1/client-config` request hits the cached response for the same app, user, and roles
- **THEN** the cached `config.enabledUiFeatures` value is returned, no provider is re-resolved, and no normalization warning is logged
