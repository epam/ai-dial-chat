## MODIFIED Requirements

### Requirement: Locale utilities move; `PRIMARY_LOCALE` and the one i18n-touching function stay app-owned

`@epam/ai-dial-chat-hooks` SHALL export `toBaseLocale`, `appendLocaleCode`, `composeLocalePayload`, `decomposeLocalizedFields`, and `buildAdditionalLocaleOptions` from `apps/chat/src/utils/locale.ts`. `resolveLocalizedText` SHALL be exported with an additional required `primaryLocale: string` parameter (in place of the module-level `PRIMARY_LOCALE` constant it read internally). `buildAdditionalLocaleOptions` SHALL take `additionalLocaleCodes: string[]` and `primaryLocale: string` as explicit parameters, plus an optional third parameter `formatLabel?: (code: string) => string` that defaults to `code.toUpperCase()` and supplies each option's `label`. The lib SHALL NOT resolve language names itself and SHALL NOT read configuration; codes and the label resolver both come from the host. `PRIMARY_LOCALE` (derived from the host-owned `SUPPORTED_LANGUAGES`/`useLanguage` hook, which libs must not import per the no-i18n-in-libs rule) and `buildLocaleFieldLabels` (the only export that calls `t()`) SHALL remain in `apps/chat/src/utils/locale.ts`. That file SHALL re-export `resolveLocalizedText` as a thin wrapper that supplies `PRIMARY_LOCALE`. It SHALL re-export `buildAdditionalLocaleOptions` as a one-argument wrapper `buildAdditionalLocaleOptions(codes)` that supplies `PRIMARY_LOCALE` and the app's `getLocaleDisplayName`. The codes come from `AppConfigContext` (see `content-locale-configuration`); the former module constant `ADDITIONAL_CONTENT_LOCALE_CODES` no longer exists.

#### Scenario: Every non-i18n locale consumer resolves the moved export with unchanged behavior
- **WHEN** `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` (or any of the other current consumers) calls `resolveLocalizedText(value, activeLocale)` via the app-owned wrapper in `apps/chat/src/utils/locale.ts`
- **THEN** it resolves through `@epam/ai-dial-chat-hooks`'s `resolveLocalizedText(value, activeLocale, PRIMARY_LOCALE)` with identical behavior to the pre-move implementation

#### Scenario: Option labels default to the uppercased code
- **WHEN** `buildAdditionalLocaleOptions(['de', 'en'], 'en')` is called without `formatLabel`
- **THEN** it returns `[{ code: 'de', label: 'DE' }]`

#### Scenario: A host-supplied label resolver names each option
- **WHEN** `buildAdditionalLocaleOptions(['de'], 'en', (code) => code + '!')` is called
- **THEN** it returns `[{ code: 'de', label: 'de!' }]`
