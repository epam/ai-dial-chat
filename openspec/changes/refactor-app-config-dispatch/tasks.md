Slicing strategy: **risk-first**. First, pin the current observable behavior against the
unchanged service. Then move the dispatch in one reviewable slice. Last, add the drift
guard and clean up. Each slice leaves `chat-api` green.

Test command for every exact-file step: `npm run test:file -- <path>`. Service spec
path: `apps/chat-api/src/app-config/tests/app-config.service.spec.ts`.

## 1. Characterize the current service (no production changes)

- [ ] 1.1 Re-read `apps/chat-api/src/app-config/app-config.service.ts` on the current
      base, and confirm the 25 non-feature branches listed in `design.md` §Context. If
      the count or the policies drifted, update `design.md` and the matrix below before
      writing tests.
- [ ] 1.2 In `apps/chat-api/src/app-config/tests/app-config.service.spec.ts`, add
      explicit-literal cases for the fields that have no assertions today:
      `mcpAppSandboxUrl`, `mcpAppUserAgent`, and `mcpAppHostName` (configured string →
      value, non-string → `null`); `mcpAppTheme` (`'light'`, `'dark'` pass through;
      `'blue'`, `''`, `true` → `null`); and `welcomeScreenDescription` (trimmed text,
      blank → `null`, markup kept literally, non-string → `null`).
- [ ] 1.3 Add wrong-shape and nullish cases for the remaining mapped fields that lack
      them:
  - `transcribeSizeLimitBytes` and `maxAttachmentFileSizeBytes`: `0` → `0`; `'5'` →
    default.
  - `activeEventId`, `asrModelId`, `defaultDeploymentId`, `dialCoreExternalUrl`: `42` →
    `null`.
  - `fileManagerTabs` and `publicationFilterSources`: `'x'` → default; an array with
    non-string entries passes through verbatim.
  - `overlayAllowedOrigins`, `allowedConnectOrigins`, `customVisualizers`: `{}` → `[]`.
  - `overlayEnabled`: `'true'` → `false`.
  - `customVariables`: `[]` and `'x'` → `{}`.
  - `announcementHtml`: `''` → `''`, `5` → `null`.
  - `footerHtmlMessage`: `5` → `''`.
  - Provider `null` for `fileManager.availableTabs` → the registry default tabs.
- [ ] 1.4 Add orchestration cases:
  - `compositeProvider.resolve` is called with `app.version` exactly once and first.
  - The remaining calls follow the order of `CONFIG_DEFINITIONS` filtered to
    client-visible definitions without `app.version`, one call each, and each call
    receives the same full context object (`appId`, `userId`, `roles`, `environment`).
  - Server-visible keys (`utility.modelId`, `features.llmConversationNaming`,
    `features.responsesApiEnabled`) are never resolved.
- [ ] 1.5 Add response-shape cases:
  - `Object.keys(result.config)` equals the current 27-field order literal.
  - `Object.keys(result)` is `['appId', 'features', 'config', 'metadata']`.
  - `features` keys are the client `features.*` short keys in registry order.
- [ ] 1.6 Add isolation and cache cases:
  - Two cache-miss calls for different role sets that resolve different values return
    independent results. Their default `fileManagerTabs`, `overlayAllowedOrigins`, and
    `customVariables` are not reference-equal to each other.
  - A cache hit returns the identical `metadata.resolvedAt` and makes zero new
    `resolve` calls. The existing hit and warning cases at the end of the
    `getClientConfig` block already cover the no-new-warnings part, so keep them.
- [ ] 1.7 Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts`
      is green against the **unchanged** service. Record any pre-existing failure
      separately. After that, run `npm run verify:changed` once for this slice.

## 2. Extract the typed mapping and wire it into the loop

- [ ] 2.1 Create `apps/chat-api/src/app-config/client-config.mapper.ts` as described in
      `design.md` D1. It contains:
  - the `MappedClientConfig` type and the `ClientConfigMappingInput` interface;
  - `createDefaultClientConfig()`, which returns fresh arrays and objects in the current
    response field order;
  - the `defineMapping` helper and `CLIENT_CONFIG_MAPPINGS` as a `ReadonlyMap`, with one
    entry for each of the 25 keys in the `design.md` table;
  - `applyClientConfigValue()`, a no-op for unknown keys.

  Move `DEFAULT_FILE_MANAGER_TABS`, `DEFAULT_PUBLICATION_FILTER_SOURCES`,
  `isApplicationVisualizerRegistry`, and named constants for the two size defaults into
  it. Reuse `normalizeAnnouncements`, `normalizeEnabledUiFeatures`, `toNullableText`,
  `sanitizeAnnouncementHtml`, and `sanitizeFooterHtml` unchanged. Keep the existing
  plain-text block comments on the title and welcome entries. No `any`, no blanket
  `as` casts, no dotted-path writes, extensionless relative imports, and no Nest
  decorators.
- [ ] 2.2 In `apps/chat-api/src/app-config/app-config.service.ts`, replace the 25
      locals and the ladder with `createDefaultClientConfig()` and
      `applyClientConfigValue(config, def.key, { resolved, appVersion, warn })` inside
      the same sequential loop, following `design.md` D2. Build the response as
      `config: { aiTextRefinementAvailable, appVersion, ...config }`. Leave the cache
      get and set, `resolveConfiguredVersion`, the `app.version` filter, the feature
      branch, `isEnabled`, `resolveValue`, and `getClientConfigCacheKey` unchanged.
      Remove imports that are no longer used.
- [ ] 2.3 Verification:
      `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts apps/chat-api/src/app-config/tests/app-config.controller.spec.ts apps/chat-api/src/app-config/tests/enabled-ui-features.normalizer.spec.ts apps/chat-api/src/app-config/tests/announcements.normalizer.spec.ts`
      passes with **no edits** to the existing or §1 expectations. Then run
      `npm exec nx run chat-api:typecheck` and `npm exec nx lint chat-api`.

## 3. Registry drift guard and mapper unit tests

- [ ] 3.1 Create `apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts`
      with the coverage guard from `design.md` D4, tested against the real
      `CONFIG_DEFINITIONS`:
  - Client `type: 'config'` keys minus `app.version` equal the mapping keys, and a
    failure message names the missing and stale keys.
  - Each field is owned by exactly one entry, and the owned fields equal
    `Object.keys(createDefaultClientConfig())`.
  - There are no entries for server-visible or feature keys.
  - `app.version` is the only unmapped client config key.
- [ ] 3.2 In the same spec, add mapper-level behavior tests:
  - `createDefaultClientConfig()` returns a new object with new arrays and objects on
    each call.
  - `applyClientConfigValue` with `'constructor'`, `'__proto__'`, `'toString'`, or an
    unknown key leaves the accumulator deep-equal to the defaults and does not throw.
  - The `footer.html` entry uses the `appVersion` it is given.
  - The normalizer-backed entries forward the `warn` callback they are given.
- [ ] 3.3 Verification:
      `npm run test:file -- apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`.
      Temporarily add an unmapped client key locally to confirm the guard fails and
      names it, then revert the change. Afterwards, run `npm run verify:changed` once
      for slices 2–3.

## 4. Docs, specs, and final verification

- [ ] 4.1 Re-check `docs/architecture.md` (the `app-config/` tree entry) and
      `apps/chat-api/README.md` (the domain table and client-config sections). Update
      them only if they describe the service's internal dispatch. The expected result
      is no change, and that outcome gets recorded. If a doc is touched, run
      `npm run validate:docs`.
- [ ] 4.2 Confirm that `libs/chat-api-client/openapi.json` is unchanged by running
      `npm run openapi:check`, and that `git diff` has no DTO, controller, frontend, or
      `libs/*` changes.
- [ ] 4.3 Run `npm run verify:full` once. Record the revision and the result, with
      pre-existing failures listed separately from introduced ones. Never mark a check
      passed if it was not run or failed.

## 5. Follow-ups (out of scope, record only)

- [ ] 5.1 Record as a separate follow-up, and do not implement here: the
      prototype-backed `DEPRECATED_UI_FEATURE_ALIASES` lookup in
      `enabled-ui-features.normalizer.ts`, and the `mcpApps.userAgent` registry
      description, which says it defaults to `"ai-dial-chat"` while the registry
      `defaultValue` and the BFF response are `null`. Check whether the fallback lives
      client-side, and fix the description if it does not. Both are observations for
      later changes.
