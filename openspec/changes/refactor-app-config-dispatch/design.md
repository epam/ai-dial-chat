## Context

Current `development` (`a22ec0a53`), `apps/chat-api/src/app-config/app-config.service.ts`:

- `:58-63` builds the cache key and returns early on a hit.
- `:70-74` resolves `app.version` once through `resolveConfiguredVersion` (`:266-274`,
  package-version fallback in `common/utils/app-version`), then filters it out of the
  client definitions.
- `:76-101` declares 26 mutable locals: `features` plus 25 `config` fields. Several
  defaults exist in two places, in the local's initializer and in the ladder's fallback.
  For example, `5 * 1024 * 1024` appears at `:79` and `:119`, and `536_870_912` at
  `:101` and `:187`.
- `:103-189` resolves each definition sequentially through
  `compositeProvider.resolve(def.key, context)` and then applies
  `resolved = value ?? def.defaultValue`. After that come one `features.*` branch
  (`:107-112`) and **25** key branches (`:113-188`), with no final `else`.
- `:191-229` builds the response literal. The field order there is what fixes the JSON
  key order. `aiTextRefinementAvailable` comes from `ConfigService` (`UTILITY_MODEL`),
  not from the registry.
- `:231` calls `cacheManager.set(cacheKey, response, CACHE_TTL_MS)`, which is 60 000 ms.

The 25 mapped keys and their current conversion policies, which must be preserved
exactly:

| Registry key                       | Response field               | Conversion of `resolved`                                                 |
| ---------------------------------- | ---------------------------- | ------------------------------------------------------------------------ |
| `ui.activeEventId`                 | `activeEventId`              | string, else `null`                                                      |
| `asr.modelId`                      | `asrModelId`                 | string, else `null`                                                      |
| `asr.transcribeSizeLimitBytes`     | `transcribeSizeLimitBytes`   | `typeof number` (incl. `0`, `NaN`), else `5242880`                       |
| `deployments.defaultDeploymentId`  | `defaultDeploymentId`        | string, else `null`                                                      |
| `dialCore.externalUrl`             | `dialCoreExternalUrl`        | string, else `null`                                                      |
| `mcpApps.sandboxUrl`               | `mcpAppSandboxUrl`           | string, else `null`                                                      |
| `mcpApps.theme`                    | `mcpAppTheme`                | exactly `'light'`/`'dark'`, else `null`                                  |
| `mcpApps.userAgent`                | `mcpAppUserAgent`            | string, else `null`                                                      |
| `mcpApps.hostName`                 | `mcpAppHostName`             | string, else `null`                                                      |
| `fileManager.availableTabs`        | `fileManagerTabs`            | any array (entries unchecked), else default tabs                         |
| `overlay.enabled`                  | `overlayEnabled`             | `=== true`                                                               |
| `overlay.allowedOrigins`           | `overlayAllowedOrigins`      | any array, else `[]`                                                     |
| `documents.allowedConnectOrigins`  | `allowedConnectOrigins`      | any array, else `[]`                                                     |
| `announcement.html`                | `announcementHtml`           | string verbatim (incl. `''`), else `null`                                |
| `announcement.title`               | `announcementTitle`          | `toNullableText`                                                         |
| `announcement.description`         | `announcementDescription`    | `toNullableText` → `sanitizeAnnouncementHtml`, falsy → `null`            |
| `announcement.items`               | `announcements`              | `normalizeAnnouncements(resolved, warn)`                                 |
| `welcomeScreen.description`        | `welcomeScreenDescription`   | `toNullableText`                                                         |
| `footer.html`                      | `footerHtmlMessage`          | string → `sanitizeFooterHtml(resolved, appVersion)`, else `''`           |
| `uiFeatures.enabledUiFeatures`     | `enabledUiFeatures`          | `normalizeEnabledUiFeatures(resolved, warn)`                             |
| `customVariables`                  | `customVariables`            | non-null non-array object (same reference), else `{}`                    |
| `customVisualizers`                | `customVisualizers`          | any array, else `[]`                                                     |
| `applicationVisualizers`           | `applicationVisualizers`     | `isApplicationVisualizerRegistry`, else `{}`                             |
| `publish.publicationFilterSources` | `publicationFilterSources`   | any array, else default sources                                          |
| `attachments.maxFileSizeBytes`     | `maxAttachmentFileSizeBytes` | `typeof number`, else `536870912`                                        |

Special paths, which are not table entries: `app.version` resolves to `appVersion`, and
`features.*` resolves to `features[shortKey] = resolved === true`.
`aiTextRefinementAvailable` comes from `ConfigService`. Server-visible keys
(`utility.modelId`, `features.llmConversationNaming`, `features.responsesApiEnabled`)
are filtered out before the loop.

Constraints: `ConfigDefinition.key` is `string` (`app-config.types.ts:4`), and
`CONFIG_DEFINITIONS` is annotated `ConfigDefinition[]`
(`config-registry/config-registry.constants.ts:3`). The type system therefore cannot
prove on its own that the table covers every key. The reference pattern is the pure
normalizer module with a `warn` callback (`enabled-ui-features.normalizer.ts:31-34`,
`announcements.normalizer.ts:58`).

Existing coverage in `tests/app-config.service.spec.ts` (1262 lines) is strong for the
announcement fields, the enabled-UI-feature and announcement warnings, footer/version,
the cache key and hit, and role isolation. It has **no** assertions for
`mcpAppSandboxUrl`, `mcpAppTheme`, `mcpAppUserAgent`, `mcpAppHostName`, or
`welcomeScreenDescription`. It also does not assert the provider call order, the
`app.version`-first call, the full context passed per call, the `config` key order,
wrong-shaped inputs for most scalar and array fields, or `null`-to-registry-default
fallback. `tests/app-config.controller.spec.ts` mocks the service and needs no change.

## Goals / Non-Goals

**Goals:**

- `getClientConfig` keeps orchestration only. Field defaults and conversion move into
  one typed, app-local mapping module.
- One place per field for its default, with no duplicated fallback constants.
- A registry drift guard that fails in development when a new client key is not mapped.
- Byte-identical responses and identical side effects: provider call sequence, logs,
  cache calls.

**Non-Goals:**

- Changes to providers, env parsing, registry contents, `ConfigDefinition` typing,
  `isEnabled`, `resolveValue`, the DTO, OpenAPI, the generated client, or the frontend.
- Stricter validation, alias fixes, or cache TTL or capacity changes.
- Parallelizing provider calls, or moving resolution into the table.
- Any performance, memory, or reliability claim.

## Decisions

### D1. Typed app-local mapping table plus default factory (option B)

A new file, `apps/chat-api/src/app-config/client-config.mapper.ts`, exports:

- `type MappedClientConfig = Required<Omit<ClientConfigDto, 'aiTextRefinementAvailable' | 'appVersion'>>`.
  `Required` covers `allowedConnectOrigins`, which is optional in the DTO but always
  emitted today. Adding a new `ClientConfigDto` field therefore breaks
  `createDefaultClientConfig` at compile time until the field gets a default.
- `interface ClientConfigMappingInput { resolved: unknown; appVersion: string; warn: (message: string) => void }`.
  This is the narrow handler input. Handlers get neither the context nor the service.
- `createDefaultClientConfig(): MappedClientConfig` returns a **new** object on every
  call, with new arrays and objects for the defaults. Its property order matches the
  current response literal (`app-config.service.ts:199-223`), so spreading it after
  `aiTextRefinementAvailable, appVersion` keeps the JSON key order.
- Entries are built with a small generic helper,
  `defineMapping<K extends keyof MappedClientConfig>(field: K, convert: (input) => MappedClientConfig[K])`.
  Each entry records its `field`, which the coverage test uses, and the compiler checks
  each converter against that field's DTO type without casts. The helper produces a
  typed `apply(config, input)` that assigns `config[field] = convert(input)`. It is a
  single statically typed property write, not a dotted-path write.
- `CLIENT_CONFIG_MAPPINGS: ReadonlyMap<string, ClientConfigMapping>`. A `Map` means
  lookup never falls back to `Object.prototype`. `get('constructor')` returns
  `undefined`, and no `hasOwn` or cast is needed.
- `applyClientConfigValue(config, key, input): void` does nothing when the key has no
  entry. That matches today's missing `else`: no throw and no new log.

Current constants and helpers move to the mapper: `DEFAULT_FILE_MANAGER_TABS`,
`DEFAULT_PUBLICATION_FILTER_SOURCES`, `isApplicationVisualizerRegistry`, and the two
numeric size defaults, which become named constants. The ladder's fallbacks and the
factory both read from these named constants. Wherever a fallback fires, it returns a
fresh copy (`[...DEFAULT_FILE_MANAGER_TABS]`), so no response aliases a module constant.

Rejected alternatives: A (keep the ladder), C (handlers on the registry), and D
(generic engine). The reasons are in the proposal. An object literal plus
`Record<string, Handler>` was also rejected. It cannot prove coverage and needs
`hasOwn` guards against inherited keys. A `switch` inside a helper function was also
rejected, because it would only move the ladder somewhere else under a new name.

### D2. The service loop stays the orchestrator

```ts
const appVersion = await this.resolveConfiguredVersion(context);
const warn = (message: string) => this.logger.warn(message);
const features: Record<string, boolean> = {};
const config = createDefaultClientConfig();
for (const def of clientDefinitions) {
  const value = await this.compositeProvider.resolve(def.key, context);
  const resolved = value ?? def.defaultValue;
  if (def.type === 'feature') {
    /* unchanged prefix strip + `resolved === true` */
  } else {
    applyClientConfigValue(config, def.key, { resolved, appVersion, warn });
  }
}
const response: ClientConfigResponseDto = {
  appId: context.appId,
  features,
  config: { aiTextRefinementAvailable: …, appVersion, ...config },
  metadata: { … },
};
```

The loop keeps sequential `await` in registry order, the `value ?? def.defaultValue`
step, the `features.*` handling, the `app.version` pre-resolution and filter, and the
cache get and set with unchanged arguments. `warn` is the same arrow callback as today,
so normalizer warnings stay under the `AppConfigService` logger context
(`enabled-ui-features.normalizer.ts:10-14`).

### D3. Read-only treatment of provider values, per-call accumulator

Provider-returned values are passed through by reference, exactly as today. That
includes registry `defaultValue` arrays and objects returned by
`StaticDefaultsProvider`, `customVariables`, and the visualizer registries. They are
never mutated and never cloned, so there is no new copying cost and no observable
change. The accumulator is created per cache miss and is never stored at module level.
The normalizers already build new output, and their own specs cover that they do not
mutate input.

### D4. Coverage: compile-time field completeness plus runtime registry guard

- Compile time: `createDefaultClientConfig(): MappedClientConfig` fails to compile if a
  field is missing. `defineMapping` fails to compile if a converter returns the wrong
  type for its field.
- Runtime, in the new `tests/client-config.mapper.spec.ts`, against the real
  `CONFIG_DEFINITIONS`:
  1. The set of client `type: 'config'` keys minus `{'app.version'}` equals the set of
     `CLIENT_CONFIG_MAPPINGS` keys. Failures name the missing and stale keys.
  2. Mapped fields are unique, and together they equal
     `Object.keys(createDefaultClientConfig())`.
  3. There are no entries for server-visible or `feature` keys.

This catches a new unmapped key during `nx test chat-api` without a registry type
rewrite. The guard is test-only, and production behavior for an unmapped key stays a
silent no-op.

### D5. Characterize first, against the unchanged service

The new characterization cases go into `tests/app-config.service.spec.ts` and run green
against the **current** ladder before the extraction. The expected outputs are explicit
literals. The spec does not compare against a copy of the old implementation, and no
duplicate production code is kept as an oracle. The coverage matrix is in `tasks.md`
§1. Table-level tests in `client-config.mapper.spec.ts` add to the service suite but do
not replace it.

## Risks / Trade-offs

- [JSON key order silently changes when the response is built by spread] → The factory
  property order mirrors the current literal, and a characterization test asserts
  `Object.keys(result.config)`.
- [A converter's fallback subtly differs, for example returning `null` where `''` or
  the default was expected] → There is one characterization case per field for default,
  nullish, wrong-shape, and valid input, written before the move.
- [A default array is shared between cached responses, so mutation leaks across
  callers] → The factory and fallbacks return fresh arrays and objects, and a test
  checks that responses for two different callers are not reference-equal. Provider
  values stay shared, as they are today. That is a documented, unchanged trade-off.
- [The coverage guard only runs in tests] → Accepted. It meets the requirement to catch
  the key during development without adding runtime throws or logs.
- [The `defineMapping` generic erases per-entry types inside the `Map`] → Only `apply`
  is exposed from each entry. The typed assignment is checked where the entry is
  defined, so no cast is needed at the call site.

## Migration Plan

This is a pure refactor. It has no config or env changes, no data migration, and no
deploy ordering. To roll back, revert the extraction commit. The characterization tests
can stay, because they describe behavior that is unchanged.

## Open Questions

None blocking. The mapper's file name and export names may be adjusted during
implementation, provided the ownership boundary and the coverage guard stay as
specified.
