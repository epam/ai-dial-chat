## Context

Additional content locales are the translation targets for a toolset's or application's
Name/Description, stored on the entity as a DIAL Core locale map. Today they come from
`ADDITIONAL_CONTENT_LOCALE_CODES`, an empty constant in `apps/chat/src/utils/locale.ts`, so the
`DeploymentLocalesField` control (`libs/builder-form`) never renders (#8787).

`development-0.x` drove the same feature from `AVAILABLE_LOCALES`. The former
`apps/chat/src/utils/app/resolveAvailableLocales.ts` on that branch parsed the variable,
stripping `[`, `]` and quotes, and fell back to the `public/locales` folder names. It always
appended `en`. `LocalesService.getPrimaryLocale()` returned the **first** entry, so in 0.x the
primary locale was configurable. That one list drove both the UI language switcher and the editor's
locale options. Codes were short (`en`, `de`, `ar`). `getLocaleDisplayName` named a code through a
small dictionary with an `Intl.DisplayNames` fallback.

1.0 separates the two concerns. UI languages are `SUPPORTED_LANGUAGES`, a build-time list backed by
`<code>.json` bundles. `PRIMARY_LOCALE` is fixed to its first entry (`en`). Runtime configuration
travels through `CONFIG_DEFINITIONS` → `EnvConfigProvider` → `CLIENT_CONFIG_MAPPINGS` →
`ClientConfigResponseDto` → `AppConfigContext`. `publish.publicationFilterSources` is the closest
existing key of this shape: a comma-separated env var resolved into a client-visible string array.

`DeploymentLocalesField` currently returns `null` whenever `availableLocaleOptions` is empty. It
labels the summary through the option labels, and it builds each row's `Select` only from
`availableLocaleOptions`. A stored row whose code is not offered therefore renders an empty select,
or no control at all.

## Goals / Non-Goals

**Goals:**

- Operators choose the additional content locales at runtime through `ADDITIONAL_CONTENT_LOCALES`.
- A 0.x deployment's `AVAILABLE_LOCALES` keeps working, with a deprecation warning.
- A malformed code fails startup.
- Translations under a code that is no longer configured stay visible, editable and deletable.
- Codes are shown as language names, including codes that have no UI bundle.

**Non-Goals:**

- A configurable `PRIMARY_LOCALE`, and any migration of 0.x data whose primary content was stored
  under a non-`en` first locale.
- New UI languages or translation bundles.
- Per-role or per-tenant lists.

## Decisions

### D1. Presence decides precedence; the new variable always wins

`ADDITIONAL_CONTENT_LOCALES` is used whenever it is **present**, even as an empty string.
`AVAILABLE_LOCALES` is read only when the new variable is absent. This gives operators an explicit
way to switch the legacy value off (`ADDITIONAL_CONTENT_LOCALES=`) without unsetting it, which
matters for Helm charts that template every key. Distinguishing "absent" from "empty" requires the
`EnvironmentVariables` properties to have **no** property initialiser (unlike
`PUBLICATION_FILTER_SOURCES = []`) and a `@Transform` that returns `undefined` for an absent value.

_Alternative rejected:_ treating empty as absent, as `PUBLICATION_FILTER_SOURCES` does. That
pattern falls back because an empty source list would break the picker. Here an empty list is a
legitimate "off", and falling back would silently resurrect a legacy value the operator tried to
clear.

### D2. Syntax is validated at boot; canonicalisation happens at resolution

`environment.config.ts` rejects malformed codes. Each entry must pass `@Matches(/^[A-Za-z0-9-]+$/)`
(the allowlist rule in `apps/chat-api/AGENTS.md` for strings reaching clients and logs),
`@MaxLength(35)`, and a small custom `@ValidatorConstraint` that calls `Intl.getCanonicalLocales`.
`EnvConfigProvider` then canonicalises (`de-de` → `de-DE`) and deduplicates in its
`content.additionalLocales` branch, next to the existing `fileManager.availableTabs` and
`publish.publicationFilterSources` branches. Keeping the transform to split-and-trim leaves
validation errors reporting what the operator actually typed.

`Intl.getCanonicalLocales` needs full ICU. Node 24, used by the `chat-api` image, ships full ICU by
default.

_Alternative rejected:_ a hand-written BCP-47 regex. The grammar (extlang, script, variants,
extensions) is easy to get subtly wrong, and `Intl` is the reference implementation the browser
will use anyway.

### D3. The primary locale is filtered in the frontend only, by exact match

The backend passes the canonical list through unchanged. `buildAdditionalLocaleOptions` in
`libs/chat-hooks` already drops `primaryLocale`, and the app supplies `PRIMARY_LOCALE`. So the
knowledge of which locale is primary stays where it already lives (`SUPPORTED_LANGUAGES`), and the
backend never duplicates it. The match is exact, so `en-GB` stays offerable next to the primary
`en`. That is a legitimate British-English translation, and `composeLocalePayload` already drops
only the exact primary key.

_Alternative rejected:_ stripping `en` in `EnvConfigProvider` for the legacy fallback. That hardcodes
the primary locale into the BFF, and it would drift the moment `SUPPORTED_LANGUAGES[0]` changed.

### D4. Labels are autonyms, resolved in the app

`getLocaleDisplayName(code)` in `apps/chat/src/utils/locale.ts` returns
`new Intl.DisplayNames([code], { type: 'language' }).of(code)`, falling back to
`code.toUpperCase()` when it throws or echoes the code. An autonym (`Deutsch`, `العربية`) is the
convention for language pickers. `SUPPORTED_LANGUAGES.nativeName` and 0.x already use it, and
an autonym does not change with the viewer's UI language, so there is no `useMemo` dependency on
`i18n.language`. The 0.x hardcoded dictionary is not ported, because `Intl` covers those four
codes.

The lib receives labels as data: `LocaleOption.label` for configured codes, and the optional
`formatLocaleLabel` callback for retained ones. Neither `libs/chat-hooks` nor `libs/builder-form`
calls `Intl.DisplayNames`. Keeping lib output identical for hosts that pass nothing is the reason
the default stays `code.toUpperCase()`.

### D5. Retained entries are derived inside `DeploymentLocalesField` from `value`

The field already owns `value` and `availableLocaleOptions`, so it can compute the retained codes
(`value` languages minus option codes) without the host doing anything. Each row's `Select` gets
`availableLocaleOptions` plus that row's own retained code. "Add locale" is limited to the count of
configured options. The render guard becomes `options.length === 0 && retained.length === 0`.

_Alternative rejected:_ a `isRetired` flag on the shared `LocaleOption` model in
`libs/chat-shared`, set by the host. It would widen a shared peer's public model for one consumer
and push derivable state onto every host.

### D6. The summary row shows codes, not labels

`Locales: [DE], [PT-BR]` stays compact and keeps the existing scenario's wording. With autonym
labels the summary would read `Locales: [Deutsch], [português (Brasil)]`. The summary therefore
switches from the option-label lookup to `entry.language.toUpperCase()`. Because today's labels
already equal the uppercased code, this changes nothing for current hosts.

### D7. Client contract

The field is `config.additionalContentLocales: string[]`, mapped from `content.additionalLocales`.
It has no role gating and no feature flag: an empty list is the off state. The field adds no
endpoint, no new authorisation and no cache key. It rides the existing `getClientConfig` response
and its existing cache/TTL. `ClientConfigResponseDto` gains `@ApiProperty({ type: [String] })`.
Regenerate with `npm run openapi`.

### D8. State ownership and memoisation

`AppConfigContext` owns the list. Both editors call
`useMemo(() => buildAdditionalLocaleOptions(additionalContentLocales), [additionalContentLocales])`,
replacing today's `useMemo(..., [])`. The array identity is stable between config loads because it
lives in the memoised context value. No new context, hook or provider is introduced.

## Risks / Trade-offs

- [0.x deployments whose first `AVAILABLE_LOCALES` entry was not `en` stored their primary
  Name/Description under that locale, while 1.0 reads `en`.] → Out of scope to migrate. The
  migration guide documents it explicitly, so an operator knows to check before upgrading.
  `resolveLocalizedText` still falls back to the first defined value, so such names stay visible.
- [0.x data uses short codes such as `de`. An operator who now configures `de-DE` sees the old `de`
  rows as retained rather than matched.] → The rows stay visible and editable, not lost. The README
  advises reusing the codes already in the data.
- [A malformed code takes the BFF down at startup.] → Intended, as the issue requires. The
  validation error names the variable and the value, and the README documents the accepted form.
- [Autonyms in another script render inside a page whose `lang` is the UI language. WCAG 3.1.2
  Language of Parts would want `lang` on each option, and the kit `Select` option model has no
  `lang` field.] → Recorded as a kit follow-up (out of scope per `.claude/rules/a11y.md` "Scope
  boundary"). Screen readers still read the label, possibly with the wrong voice.
- [Mixed-direction labels (`العربية` in an LTR select, or Latin labels in RTL).] → Browser bidi
  handles a single-run label. The `Select` already uses logical layout, and no layout CSS changes.
- [A Helm chart that templates `ADDITIONAL_CONTENT_LOCALES=""` by default silently disables a
  legacy `AVAILABLE_LOCALES`.] → This is D1's intended semantics. It is documented in the README and
  the migration guide.

## Migration Plan

1. Deploy as usual. With neither variable set, behaviour is unchanged.
2. A 0.x deployment that keeps `AVAILABLE_LOCALES` gets the same additional locales immediately and
   a startup deprecation warning.
3. Operators rename the variable to `ADDITIONAL_CONTENT_LOCALES` at their convenience. `en` may be
   left in the list; it is filtered out.

**Rollback:** revert the change. Stored entity data is not touched by this change, so nothing needs
to be undone in DIAL Core. After a rollback the control is hidden again, and stored translations are
preserved by the existing "hiding never calls `onChange`" rule.

## Open Questions

- When should the `AVAILABLE_LOCALES` fallback be removed? Proposal: in the first release after the
  0.x line reaches end of support. That is tracked as a follow-up, not decided here.
