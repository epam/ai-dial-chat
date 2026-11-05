## ADDED Requirements

### Requirement: AppConfigContext exposes additionalContentLocales

`AppConfigState.config` in `apps/chat/src/context/AppConfigContext.tsx` SHALL gain `additionalContentLocales: string[]`. It is initialised to `[]` in `INITIAL_STATE` and stays `[]` on fetch failure. `loadConfig` SHALL populate it from `response.config?.additionalContentLocales ?? []`. `AppConfigContext` owns this state. The value is part of the context value that is already memoised, so no consumer re-renders beyond what a config load already triggers.

The toolset and application editors SHALL read the list through `useAppConfig().config.additionalContentLocales`. They SHALL NOT read the former module constant `ADDITIONAL_CONTENT_LOCALE_CODES`, which is removed from `apps/chat/src/utils/locale.ts`.

#### Scenario: Configured locales are available after the initial fetch

- **WHEN** `AppConfigProvider` has resolved its initial `getClientConfig` call and the response carries `config.additionalContentLocales: ["de"]`
- **THEN** `useAppConfig().config.additionalContentLocales` is `["de"]`

#### Scenario: Fetch failure leaves the locale control hidden

- **WHEN** `getClientConfig` rejects
- **THEN** `useAppConfig().config.additionalContentLocales` is `[]`, so no additional locale is offered and stored translations are preserved

#### Scenario: Missing field in an older backend response

- **WHEN** the response's `config` lacks `additionalContentLocales`
- **THEN** `useAppConfig().config.additionalContentLocales` is `[]`
