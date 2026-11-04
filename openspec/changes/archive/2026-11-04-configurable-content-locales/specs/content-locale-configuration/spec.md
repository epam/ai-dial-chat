## ADDED Requirements

### Requirement: Editors build additional-locale options from the configured codes

`buildAdditionalLocaleOptions` in `apps/chat/src/utils/locale.ts` SHALL take the configured codes as a parameter (`buildAdditionalLocaleOptions(codes: string[])`) instead of reading a module constant. It delegates to `@epam/ai-dial-chat-hooks`'s `buildAdditionalLocaleOptions` with `PRIMARY_LOCALE` and `getLocaleDisplayName` as the label resolver. `ApplicationFormEditor` (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`) and `ToolsetApplicationEditor` (`apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx`) SHALL each compute their options with `useMemo(() => buildAdditionalLocaleOptions(additionalContentLocales), [additionalContentLocales])`, reading the list from `useAppConfig().config`. Both SHALL pass `getLocaleDisplayName` as the locale-label formatter to the builder-form field, so that a stored-but-unconfigured code is labelled the same way as a configured one.

Codes are offered in configured order. A code equal to `PRIMARY_LOCALE` SHALL be dropped by exact match, so `en-GB` stays offerable alongside the primary `en`. `PRIMARY_LOCALE` SHALL remain `SUPPORTED_LANGUAGES[0].code` and SHALL NOT be derived from configuration.

**Feature flag:** not gated; an empty list is the "off" state. **i18n:** no new keys. **RTL impact:** none. The labels render inside the existing builder-form `Select`, which already uses logical layout.

#### Scenario: Configured codes become options without a rebuild

- **WHEN** client config returns `additionalContentLocales: ["de", "fr-FR"]` and an author opens the toolset or application editor
- **THEN** the "Add locale" language dropdown offers exactly those two codes, in that order

#### Scenario: The primary locale is never offered

- **WHEN** client config returns `additionalContentLocales: ["ar", "en"]` (a migrated 0.x `AVAILABLE_LOCALES`)
- **THEN** only `ar` is offered, and the primary Name/Description fields stay labelled with `EN`

#### Scenario: No configured codes keeps the control hidden

- **WHEN** client config returns `additionalContentLocales: []` and the entity has no stored translations
- **THEN** no locale control is rendered, as before this change

### Requirement: Locale codes are labelled with their own language name

`apps/chat/src/utils/locale.ts` SHALL export `getLocaleDisplayName(code: string): string`. It returns the code's autonym, meaning the language name in that language, as given by `new Intl.DisplayNames([code], { type: 'language' }).of(code)` (`de` → `Deutsch`, `fr-FR` → `français (France)`, `ar` → `العربية`). When `Intl.DisplayNames` throws or returns the input unchanged, it SHALL fall back to `code.toUpperCase()`. The label does not depend on the viewer's UI language. This mirrors the native-name convention of `SUPPORTED_LANGUAGES` and the 0.x `getLocaleDisplayName`, and needs no UI translation bundle for the code.

#### Scenario: A code with no UI bundle still gets a language name

- **WHEN** `getLocaleDisplayName('de')` is called on a deployment whose only UI bundle is `en`
- **THEN** it returns `Deutsch`

#### Scenario: An unresolvable code falls back to the uppercased code

- **WHEN** `Intl.DisplayNames` cannot name the code (it returns the code itself)
- **THEN** `getLocaleDisplayName` returns the code uppercased

### Requirement: Stored translations survive removal of their code from configuration

When an entity loaded into either editor has a translation under a code that is not among the current options, the editor SHALL keep that translation. It is shown with its `getLocaleDisplayName` label, it can be edited or deleted, and it is written back unchanged on save when it is left alone. The code SHALL NOT be offered for a new row. The rendering is specified by `builder-form` ("Editable additional-locale entries for name and description"). The host only supplies the configured options and the label formatter.

#### Scenario: A no-longer-configured translation remains editable

- **GIVEN** a toolset stored with an `it` translation, on a deployment where `additionalContentLocales` is `["de"]`
- **WHEN** the author opens "Edit locales"
- **THEN** the popup shows the `it` row labelled `italiano` with its name and description, and a new row may pick only `de`

#### Scenario: Deleting a no-longer-configured translation removes it on save

- **GIVEN** the same toolset
- **WHEN** the author deletes the `it` row, saves the popup, and saves the toolset
- **THEN** the update request's `locales` no longer contains `it`
