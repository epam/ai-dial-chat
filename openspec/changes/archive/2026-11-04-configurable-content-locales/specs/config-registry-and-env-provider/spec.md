## ADDED Requirements

### Requirement: Registry declares the content.additionalLocales key

`CONFIG_DEFINITIONS` (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`) SHALL include an entry:

- `key='content.additionalLocales'`
- `type='config'`
- `valueType='json'`
- `visibility='client'`
- `defaultValue=[]`
- `critical=false`
- `envVar='ADDITIONAL_CONTENT_LOCALES'`
- `owner='chat-team'`
- `description`: summarizes that this is the list of content locale codes, beyond the fixed primary locale, that authors may translate toolset and application Name/Description into, and that `AVAILABLE_LOCALES` is read as a deprecated fallback.

The empty default is deliberate. With no locale configured, the "Add locale" control stays hidden, which is the behaviour before this key existed. Content locales are user-authored data, not UI languages, so this key SHALL NOT affect `SUPPORTED_LANGUAGES` or the primary locale.

**Feature flag:** not gated, and no role gating (`allowedRolesEnvVar` is not set). **RTL impact:** none. **i18n impact:** none; values are locale codes.

#### Scenario: Registry contains the content.additionalLocales key

- **WHEN** the registry is imported
- **THEN** it contains an entry with `key='content.additionalLocales'`, `type='config'`, `valueType='json'`, `visibility='client'`, `envVar='ADDITIONAL_CONTENT_LOCALES'`, and `defaultValue=[]`

#### Scenario: Unconfigured deployment resolves to an empty list

- **WHEN** neither `ADDITIONAL_CONTENT_LOCALES` nor `AVAILABLE_LOCALES` is set
- **THEN** the key resolves to `[]`

### Requirement: EnvConfigProvider resolves content locales with a deprecated legacy fallback

`EnvConfigProvider` (`apps/chat-api/src/app-config/config-registry/env-config.provider.ts`) SHALL resolve `content.additionalLocales` through a dedicated branch, using this precedence:

1. When `ADDITIONAL_CONTENT_LOCALES` is present in the environment, including as an empty string, its list SHALL be used and `AVAILABLE_LOCALES` SHALL be ignored. Present-but-empty is an explicit "no additional locales" and resolves to `[]`.
2. Otherwise, when `AVAILABLE_LOCALES` is present, its list SHALL be used. This is the `development-0.x` variable, so `[`, `]`, `'` and `"` characters SHALL be stripped before splitting. This matches the former 0.x `resolveAvailableLocales`, so `["ar","en"]` and `ar,en` both parse.
3. Otherwise the key resolves to `undefined`, and the registry default `[]` applies.

Each list SHALL be split on commas and trimmed, with empty entries dropped. Every code SHALL be canonicalised with `Intl.getCanonicalLocales` (`de-de` → `de-DE`), and the list SHALL be deduplicated after canonicalisation, keeping the first occurrence. The provider SHALL NOT remove the primary locale; that filter belongs to the frontend (see `content-locale-configuration`), so the backend never encodes which locale is primary.

When the legacy fallback is used, a single `Logger.warn` SHALL be emitted at provider initialisation, not per request. It names `AVAILABLE_LOCALES` as deprecated and `ADDITIONAL_CONTENT_LOCALES` as its replacement. It SHALL NOT be emitted when `ADDITIONAL_CONTENT_LOCALES` is present.

**Observability:** the deprecation warning is the only new log line. No new metric.

#### Scenario: New variable resolves to canonical, deduplicated codes

- **WHEN** `ADDITIONAL_CONTENT_LOCALES=de, fr-fr ,de-DE,de` is set
- **THEN** the resolved value is `['de', 'fr-FR', 'de-DE']`

#### Scenario: Legacy variable is used when the new one is absent

- **WHEN** `ADDITIONAL_CONTENT_LOCALES` is absent and `AVAILABLE_LOCALES=["ar","en"]` is set
- **THEN** the resolved value is `['ar', 'en']` and one deprecation warning naming both variables is logged at startup

#### Scenario: New variable wins over the legacy one even when empty

- **WHEN** `ADDITIONAL_CONTENT_LOCALES=` (empty) and `AVAILABLE_LOCALES=ar,en` are both set
- **THEN** the resolved value is `[]` and no deprecation warning is logged

#### Scenario: Deprecation warning is not repeated per request

- **WHEN** only `AVAILABLE_LOCALES` is set and `content.additionalLocales` is resolved for many requests
- **THEN** the deprecation warning has been logged exactly once

### Requirement: Content locale variables are validated as BCP-47 tags at boot

`EnvironmentVariables` (`apps/chat-api/src/config/environment.config.ts`) SHALL declare `ADDITIONAL_CONTENT_LOCALES?: string[]` and `AVAILABLE_LOCALES?: string[]`. A `@Transform` SHALL keep an absent value `undefined`, which is what distinguishes "absent" from "present but empty", and SHALL split a present value into a trimmed, non-empty list (`[]` for an empty string). For `AVAILABLE_LOCALES` the transform SHALL also strip the legacy bracket and quote characters.

Each entry SHALL pass, per item:

- `@Matches(/^[A-Za-z0-9-]+$/)`, an allowlist, because the value reaches the browser and log lines;
- `@MaxLength(35)`;
- a custom constraint that accepts the entry only when `Intl.getCanonicalLocales(entry)` does not throw.

A failing entry SHALL fail environment validation at startup, and the error SHALL name the variable and the rejected value. A region subtag SHALL NOT be required, so short codes such as `de` and `ar` (the 0.x convention) are valid.

#### Scenario: Short and regional codes are accepted

- **WHEN** `ADDITIONAL_CONTENT_LOCALES=de,ar,pt-BR,zh-Hant` is set
- **THEN** environment validation passes

#### Scenario: A malformed code fails startup

- **WHEN** `ADDITIONAL_CONTENT_LOCALES=de,not a tag` is set
- **THEN** environment validation fails at application startup and the error names `ADDITIONAL_CONTENT_LOCALES`

#### Scenario: A malformed legacy code fails startup

- **WHEN** `ADDITIONAL_CONTENT_LOCALES` is absent and `AVAILABLE_LOCALES=en,e$`
- **THEN** environment validation fails at application startup and the error names `AVAILABLE_LOCALES`

#### Scenario: Absent variables pass validation

- **WHEN** neither variable is set
- **THEN** environment validation passes and both properties are `undefined`
