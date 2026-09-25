## ADDED Requirements

### Requirement: client-config response assembly separates orchestration from field mapping

`AppConfigService.getClientConfig` SHALL own orchestration only. It SHALL handle the
cache lookup and write, resolve `app.version` in advance, resolve client-visible
definitions sequentially, apply `value ?? definition.defaultValue`, map `features.*`,
and produce `metadata`. The default value and conversion of each non-feature `config`
field SHALL be owned by a typed, app-local mapping module in
`apps/chat-api/src/app-config/`. That module SHALL have exactly one mapping entry per
client-visible non-feature registry key other than `app.version`. The module SHALL be a
pure module. It SHALL NOT be a Nest provider, and it SHALL hold no mutable module-level
response state.

The observable contract of `GET /api/v1/client-config` SHALL be unchanged by this
separation. That covers the HTTP method and path, the `appId` validation, the status
codes, the `ClientConfigResponseDto` shape, the OpenAPI `operationId` `getClientConfig`,
and the generated-client types. No regeneration of `libs/chat-api-client` and no change
to frontend callers SHALL be required. The endpoint SHALL remain ungated by any feature
flag. It SHALL introduce no user-visible strings and has no RTL impact.

**Caching:** unchanged. The key is
`app-config:client:{encodedAppId}:user:{encodedUserId|anonymous}:roles:{sortedEncodedRoles|none}`.
The TTL is 60 seconds, passed to the cache as `60000` milliseconds, and entries expire
by TTL only.

**Observability:** unchanged. There is still one resolution debug log per key, emitted
by `CompositeConfigProvider`, and the normalizer warnings are still logged under the
`AppConfigService` logger context. Unmapped keys SHALL NOT produce any new logs,
metrics, or exceptions.

#### Scenario: Every mapped field keeps its current value policy

- **WHEN** providers resolve any combination of absent, `null`, `false`, `0`, empty-string, whitespace-only, wrong-typed, or well-formed values for the client-visible keys
- **THEN** each `config` field equals what the pre-refactor service returned for the same inputs. For example, `transcribeSizeLimitBytes` returns `0` unchanged, a non-number falls back to `5242880`, and a whitespace-only `announcement.title` becomes `null`. An empty-string `announcement.html` stays `''`, and a non-string `footer.html` becomes `''`. `mcpAppTheme` becomes `null` for any value other than `light` or `dark`. A non-object or array `customVariables` becomes `{}`. A non-array `fileManagerTabs` becomes the three default tabs

#### Scenario: Provider null falls back to the registry default before conversion

- **WHEN** a provider returns `null` for `fileManager.availableTabs`
- **THEN** the registry `defaultValue` `['my_files', 'shared', 'organization']` is converted and returned, exactly as before the refactor

#### Scenario: Response field set and order are unchanged

- **WHEN** `GET /api/v1/client-config?appId=chat-ui` is called with all providers returning `undefined`
- **THEN** `Object.keys(response.config)` lists the same fields in the same order as before the refactor, starting with `aiTextRefinementAvailable`, `appVersion`, `activeEventId` and ending with `publicationFilterSources`, `maxAttachmentFileSizeBytes`

#### Scenario: app.version is resolved once, first

- **WHEN** the cache misses
- **THEN** the composite provider is called with `app.version` exactly once, before any other key. Each remaining client-visible definition is then resolved exactly once in `CONFIG_DEFINITIONS` order, sequentially, and every call receives the full evaluation context

#### Scenario: Footer and appVersion use the same resolved version

- **WHEN** `CHAT_VERSION` resolves to `2026.08.10-a1b2c3d` and `FOOTER_HTML_MESSAGE` contains `%%VERSION%%`
- **THEN** `config.appVersion` is `2026.08.10-a1b2c3d` and `config.footerHtmlMessage` contains that same string in place of the token

#### Scenario: Field-specific text policies stay distinct

- **WHEN** `announcement.html`, `announcement.title`, `announcement.description`, `welcomeScreen.description`, and `footer.html` each resolve to a string containing markup and surrounding whitespace
- **THEN** `announcementHtml` is passed through verbatim. `announcementTitle` and `welcomeScreenDescription` are trimmed plain text. `announcementDescription` is trimmed and then passed through the announcement sanitizer. `footerHtmlMessage` gets `%%VERSION%%` substitution and the footer sanitizer

#### Scenario: Normalizer warnings are unchanged

- **WHEN** `ENABLED_UI_FEATURES` contains a deprecated alias and an unrecognized entry, and `ANNOUNCEMENTS` contains a rejected entry
- **THEN** the same warning messages are logged in the same order and with the same count as before the refactor

#### Scenario: A cache hit has no resolution side effects

- **WHEN** a second request with the same app, user, and role set (in any role order) arrives within the TTL
- **THEN** the cached response is returned with its original `metadata.resolvedAt`, the composite provider is not called, and no normalizer warning is logged

#### Scenario: Per-call state is isolated across callers

- **WHEN** two requests with different role sets resolve different values for the same key, one after the other or concurrently
- **THEN** each response reflects only its own resolved values, and each response gets its own `config` object. A field that falls back because its value has the wrong shape gets a fresh copy of the mapping module's default. Provider-returned values, including registry `defaultValue` arrays and objects returned through `value ?? definition.defaultValue`, are still passed through by reference and never mutated, as before the refactor

#### Scenario: An unmapped non-feature key is ignored silently

- **WHEN** the mapping lookup receives a key that has no entry, including inherited property names such as `constructor` or `__proto__`
- **THEN** the accumulator is left unchanged and no exception or log is produced
