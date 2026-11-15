## Why

The content locales an author can translate a toolset's or application's Name/Description into
are fixed at build time. `ADDITIONAL_CONTENT_LOCALE_CODES` in `apps/chat/src/utils/locale.ts` is a
hardcoded, empty array, so the "Add locale" control (`DeploymentLocalesField`) is hidden on every
deployment (#8787), and an operator who wants `de`/`fr` translations has to change source, rebuild
and redeploy. Issue [#8803](https://github.com/epam/ai-dial-chat/issues/8803) asks for this to become
runtime configuration.

The legacy chat (`development-0.x`) already did this through `AVAILABLE_LOCALES`, and
`docs/legacy-chat-migration-guide.md` currently lists that variable as "dropped with no replacement".
So deployments moving from 0.x lose a setting they already have.

## Problem

- The additional content locales are a build-time constant that operators cannot change.
- The 0.x `AVAILABLE_LOCALES` setting has no 1.0 successor, so a migrated deployment silently loses
  the translation targets it offered before.
- Translations stored under a code that is no longer offered stop being reachable in the editor.
  `DeploymentLocalesField` renders nothing when `availableLocaleOptions` is empty. When it is not
  empty, a stored row whose code is missing from the options shows an empty language select.
- The language dropdown labels a code with `code.toUpperCase()` (`buildAdditionalLocaleOptions` in
  `libs/chat-hooks/src/shared/locale.ts`), so authors see `PT-BR` rather than a language name.

## Solution (option C: new key with a deprecated legacy fallback)

- **New registry key.** Add `content.additionalLocales` to `CONFIG_DEFINITIONS`
  (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`) with
  `visibility: 'client'` and default `[]`. It is backed by a new comma-separated
  `ADDITIONAL_CONTENT_LOCALES` env var. It follows the `publish.publicationFilterSources` pattern
  end to end: registry entry, `EnvConfigProvider` special case, `CLIENT_CONFIG_MAPPINGS` entry,
  `ClientConfigResponseDto` field, and `AppConfigContext` field with a safe default.
- **Legacy fallback.** When `ADDITIONAL_CONTENT_LOCALES` is absent, the 0.x `AVAILABLE_LOCALES` is
  read instead, after stripping `[`, `]` and quotes the way 0.x `resolveAvailableLocales` did. A
  deprecation warning is logged once at startup. When the new variable is present, even as an
  empty value, it always wins.
- **Boot validation.** Every code in either variable must be a well-formed BCP-47 tag
  (`Intl.getCanonicalLocales`). Codes are canonicalised and deduplicated. A malformed code fails
  startup instead of rendering a broken dropdown. A region is not required, so 0.x short codes such
  as `de` and `ar` stay valid.
- **Primary locale unchanged.** `PRIMARY_LOCALE` stays `SUPPORTED_LANGUAGES[0].code` (`en`). The
  frontend's existing primary filter drops it from the configured list, so a 0.x
  `AVAILABLE_LOCALES=ar,en` yields `ar` as the only additional locale.
- **Stored but no longer configured.** The editor keeps a translation whose code is no longer
  configured. It is shown with its language name and can be edited or deleted, but its code is
  never offered when adding a row. This is a `libs/builder-form` behaviour change:
  `DeploymentLocalesField` derives these codes from its own `value`.
- **Display names.** `apps/chat` resolves each code to its autonym through `Intl.DisplayNames`,
  ported from the 0.x `getLocaleDisplayName`, with `code.toUpperCase()` as the fallback. The result
  reaches the libs as resolved `label` values and as an optional label-formatter prop.

## Alternatives considered

| Option                                  | Verdict                                                                                                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. New key only (as the issue suggests) | Clean, but every 0.x deployment silently loses its translation targets until someone renames the variable.                                                                                                      |
| B. Reuse the `AVAILABLE_LOCALES` name   | Zero migration cost, but in 0.x that variable also chose the UI languages and the primary locale, so keeping the name implies semantics 1.0 rejects.                                                            |
| **C. New key + deprecated fallback**    | **Chosen.** A clear new name with no silent loss for migrated deployments. `ANNOUNCEMENT_HTML_MESSAGE` in the migration guide is the precedent for a legacy variable that keeps working.                        |
| D. Frontend-only runtime config         | Rejected. The frontend reads no environment variables in 1.0 (migration guide), and this would skip boot validation.                                                                                            |

## Non-goals

- Making `PRIMARY_LOCALE` configurable, or migrating 0.x data whose primary content was stored under
  a non-`en` first locale. That case is documented as a manual migration concern.
- Adding UI display languages. `SUPPORTED_LANGUAGES` and `apps/chat/src/i18n/locales/*.json` are
  untouched, and a content locale still needs no UI bundle.
- Per-role or per-tenant locale lists, or role gating of the key.
- Changing how translations are stored, composed (`composeLocalePayload`) or resolved
  (`resolveLocalizedText`).

## Capabilities

### New Capabilities

- `content-locale-configuration`: how `apps/chat` turns the configured codes into "Add locale"
  options for the toolset and application editors. Covers the primary-locale filter, autonym labels
  and keeping stored codes that are no longer configured.

### Modified Capabilities

- `config-registry-and-env-provider`: adds the `content.additionalLocales` key, the
  `ADDITIONAL_CONTENT_LOCALES` / legacy `AVAILABLE_LOCALES` resolution, and BCP-47 boot validation.
- `client-config-endpoint`: `GET /api/v1/client-config` exposes `config.additionalContentLocales`.
- `app-config-context`: `AppConfigContext` exposes `additionalContentLocales` with an empty-list
  default.
- `builder-form`: `DeploymentLocalesField` keeps rows whose language is not in
  `availableLocaleOptions`, renders when such rows exist, and takes an optional label formatter.
- `chat-hooks-domain-utilities`: `buildAdditionalLocaleOptions` gains an optional label resolver,
  and the app wrapper takes the codes as an argument instead of reading
  `ADDITIONAL_CONTENT_LOCALE_CODES`.

## Impact

- **Backend:** `apps/chat-api/src/config/environment.config.ts` (two variables plus validation),
  `config-registry.constants.ts`, `env-config.provider.ts`, `client-config.mapper.ts`, and
  `dto/client-config-response.dto.ts`. The OpenAPI schema and the generated
  `@epam/ai-dial-chat-api-client` gain one field. No new endpoint and no cache-key change.
- **Frontend:** `apps/chat/src/context/AppConfigContext.tsx`, `apps/chat/src/utils/locale.ts`
  (`buildAdditionalLocaleOptions` takes codes and the UI language), and both editors
  (`ApplicationFormEditor.tsx`, `toolset/ToolsetApplicationEditor.tsx`).
- **Libs:** `libs/builder-form` (`DeploymentLocalesField`; a public prop is added) and
  `libs/chat-hooks` (`buildAdditionalLocaleOptions` takes an optional label resolver). Both stay
  host-agnostic. The app resolves the codes and labels and passes them as values and a callback.
  Neither lib reads config, env or i18n.
- **i18n:** no new user-visible strings. Language names come from `Intl.DisplayNames`, not from
  translation keys.
- **Docs:** `apps/chat-api/README.md` (every environment-variable table), `apps/chat-api/.env.template`,
  `docs/legacy-chat-migration-guide.md` (move `AVAILABLE_LOCALES` from "Dropped" to "Renamed or
  re-shaped" and document the 0.x primary-locale caveat), and the `libs/builder-form` and
  `libs/chat-hooks` READMEs. `docs/architecture.md` does not list individual client-config keys, so
  it needs no change.

## Backward compatibility and rollback

The change is not breaking. With neither variable set the key resolves to `[]`, and the editors
behave exactly as today (control hidden, stored locales preserved). The new lib props are optional
and default to today's rendering. Rollback is a plain revert; the stored data format is unchanged.
One operational note: a deployment that sets either variable to a malformed code fails startup by
design, so the boot error names the offending variable and value.

## Acceptance criteria

- `ADDITIONAL_CONTENT_LOCALES=de,fr-FR` offers German and French (France) in "Add locale" for
  toolsets and applications, without a rebuild.
- With only `AVAILABLE_LOCALES=["ar","en"]` set, Arabic is offered, `en` is not, and one deprecation
  warning is logged at startup.
- `ADDITIONAL_CONTENT_LOCALES=` (present but empty) overrides `AVAILABLE_LOCALES` and offers nothing.
- `ADDITIONAL_CONTENT_LOCALES=de,not a tag` fails startup with a validation error.
- An entity with a stored `it` translation, edited on a deployment that no longer configures `it`,
  still shows the `it` row, lets the author edit or delete it, and does not offer `it` for a new row.
- `npm run openapi:check`, `npm run validate:docs`, `npm run validate:specs` and
  `npm run verify:full` pass.
