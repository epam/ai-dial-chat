## Slicing strategy

Vertical. Slice 1 puts one configured code on screen end to end (env → registry → client-config →
context → editor). Slice 2 adds the legacy fallback. Slice 3 adds language-name labels. Slice 4
keeps stored-but-unconfigured translations editable in `libs/builder-form`. Slice 5 covers docs.
Each slice is independently verifiable. Slices 2–4 depend only on slice 1.

## 1. Slice 1: `ADDITIONAL_CONTENT_LOCALES` reaches the editors

- [x] 1.1 In `apps/chat-api/src/config/environment.config.ts`, add `ADDITIONAL_CONTENT_LOCALES?: string[]` with **no** property initialiser. Add a `@Transform` that returns `undefined` for an absent value, `[]` for an empty string, and a trimmed, non-empty split list otherwise. Add per-item `@Matches(/^[A-Za-z0-9-]+$/)`, `@MaxLength(35)`, and a custom `IsBcp47Locale` `@ValidatorConstraint` that passes when `Intl.getCanonicalLocales(value)` does not throw. Place the constraint next to the other env validators in `apps/chat-api/src/config/`. Follow `apps/chat-api/AGENTS.md` for env conventions.
  - Verification: add cases to `apps/chat-api/src/config/tests/validation.spec.ts` covering accepted (`de,ar,pt-BR,zh-Hant`), absent (`undefined`), empty (`[]`) and rejected (`de,not a tag`, `e$`, over 35 characters). Run `npm run test:file -- apps/chat-api/src/config/tests/validation.spec.ts`.
- [x] 1.2 Add the `content.additionalLocales` entry to `CONFIG_DEFINITIONS` in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` (`valueType: 'json'`, `visibility: 'client'`, `defaultValue: []`, `envVar: 'ADDITIONAL_CONTENT_LOCALES'`, `owner: 'chat-team'`).
  - Verification: extend `apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`, then run `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`.
- [x] 1.3 In `apps/chat-api/src/app-config/config-registry/env-config.provider.ts`, add a `content.additionalLocales` branch. When the configured list is defined, return it canonicalised with `Intl.getCanonicalLocales` and deduplicated, keeping the first occurrence. When it is `undefined`, return `undefined`. Do not filter the primary locale.
  - Verification: extend `apps/chat-api/src/app-config/tests/config-registry/env-config.provider.spec.ts` with "canonical, deduplicated codes", "absent resolves to undefined" and "present-but-empty resolves to []". Run `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/env-config.provider.spec.ts`.
- [x] 1.4 Map `content.additionalLocales` → `additionalContentLocales` in `CLIENT_CONFIG_MAPPINGS` and add `additionalContentLocales: []` to the default config object in `apps/chat-api/src/app-config/client-config.mapper.ts`. Add `@ApiProperty({ type: [String], description })` with `additionalContentLocales!: string[]` to `apps/chat-api/src/app-config/dto/client-config-response.dto.ts`.
  - Verification: run `npm run test:file -- apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts` (the coverage test must pass with the new key). Extend `apps/chat-api/src/app-config/tests/app-config.service.spec.ts` with a configured-locales case and run it.
- [x] 1.5 Run `npm run openapi` and then `npm run openapi:check`. Build and lint the generated client with `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`. Do not hand-edit `libs/chat-api-client`.
- [x] 1.6 In `apps/chat/src/context/AppConfigContext.tsx`, add `additionalContentLocales: string[]` to `AppConfigState.config`, set it to `[]` in `INITIAL_STATE` and on failure, and populate it in `loadConfig` from `response.config?.additionalContentLocales ?? []`.
  - Verification: extend `apps/chat/src/context/tests/AppConfigContext.spec.tsx` (configured, failed fetch, missing field), then run `npm run test:file -- apps/chat/src/context/tests/AppConfigContext.spec.tsx`.
- [x] 1.7 In `apps/chat/src/utils/locale.ts`, delete `ADDITIONAL_CONTENT_LOCALE_CODES` and change `buildAdditionalLocaleOptions` to take `codes: string[]`. In `apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx` and `apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx`, read `useAppConfig().config.additionalContentLocales` and memoise with `[additionalContentLocales]` as the dependency.
  - Verification: update `apps/chat/src/utils/tests/locale.spec.ts` ("offers configured codes in order", "drops the primary locale by exact match", "keeps `en-GB`"). Add a render test to the existing toolset adapter suite `apps/chat/src/pages/ApplicationEditor/tests/toolsetDefinition.spec.tsx` (its `ToolsetEditor` stub already covers every host-injected prop, so a new file would duplicate that setup), asserting that a mocked `additionalContentLocales: ['de']` reaches the editor as a `Deutsch` option and that the primary `en` is dropped (role/text queries only). Run both with `npm run test:file -- <path>`.
- [x] 1.8 Slice check: run `npm run verify:changed`.

## 2. Slice 2: Deprecated `AVAILABLE_LOCALES` fallback

- [x] 2.1 In `apps/chat-api/src/config/environment.config.ts`, add `AVAILABLE_LOCALES?: string[]` with the same validators as `ADDITIONAL_CONTENT_LOCALES`. Its `@Transform` also strips `[`, `]`, `'` and `"` before splitting.
  - Verification: add `["ar","en"]` (accepted, yields `['ar', 'en']`) and `en,e$` (rejected, names `AVAILABLE_LOCALES`) to `apps/chat-api/src/config/tests/validation.spec.ts` and run it.
- [x] 2.2 In `env-config.provider.ts`, make the `content.additionalLocales` branch fall back to `AVAILABLE_LOCALES` only when `ADDITIONAL_CONTENT_LOCALES` is `undefined`. Log one `Logger.warn` deprecation message from `onModuleInit` when the fallback is in effect. Never log the values themselves beyond the variable names.
  - Verification: extend `apps/chat-api/src/app-config/tests/config-registry/env-config.provider.spec.ts` with "legacy used when new absent", "new empty wins over legacy, no warning" and "warning logged once across many resolutions". Run it.
- [x] 2.3 Slice check: run `npm run verify:changed`.

## 3. Slice 3: Language-name labels

- [x] 3.1 In `libs/chat-hooks/src/shared/locale.ts`, add the optional third parameter `formatLabel: (code: string) => string = (code) => code.toUpperCase()` to `buildAdditionalLocaleOptions`, with JSDoc stating the default. Architecture guard: the lib still reads no config, env, i18n or `Intl.DisplayNames`.
  - Verification: extend `libs/chat-hooks/src/shared/tests/locale.spec.ts` (default label, custom resolver), then run `npm run test:file -- libs/chat-hooks/src/shared/tests/locale.spec.ts`.
- [x] 3.2 Export `getLocaleDisplayName(code)` from `apps/chat/src/utils/locale.ts` (an `Intl.DisplayNames` autonym that falls back to `code.toUpperCase()` when it throws or echoes the input), and pass it as `formatLabel` from the app wrapper.
  - Verification: extend `apps/chat/src/utils/tests/locale.spec.ts` (`de` → `Deutsch`, an unresolvable code → uppercased code, `Intl.DisplayNames` throwing → uppercased code), then run it.

## 4. Slice 4: Stored-but-unconfigured translations stay editable (`libs/builder-form`)

- [x] 4.1 In `libs/builder-form/src/components/DeploymentLocalesField/DeploymentLocalesField.tsx`:
  - add `formatLocaleLabel?: (code: string) => string` (default `code.toUpperCase()`, stated in its JSDoc);
  - derive the retained codes from `value`;
  - render when there are options **or** retained entries;
  - give each row's `Select` the configured options plus that row's own retained code, labelled through `formatLocaleLabel`;
  - render the summary from `entry.language.toUpperCase()`;
  - disable "Add locale" when every configured code is in use;
  - pre-select only configured codes for new rows.

  Architecture guard: no i18n, config, `Intl` or host knowledge enters the lib. Labels arrive as data or the callback.
  - Verification: extend `libs/builder-form/src/components/DeploymentLocalesField/tests/DeploymentLocalesField.spec.tsx` with the builder-form delta scenarios: retained entry keeps the control visible with "Add locale" disabled; retained label via `formatLocaleLabel`; retained code not offered to a new row; deleting a retained entry; summary shows codes when labels are names. Use role and label queries only. Run `npm run test:file -- libs/builder-form/src/components/DeploymentLocalesField/tests/DeploymentLocalesField.spec.tsx`.
- [x] 4.2 Thread `formatLocaleLabel` through `DeploymentCreationFormProps` (`libs/builder-form/src/models/deployment-creation-form.ts`, `DeploymentCreationForm.tsx`) and `MetadataFormProps` (`libs/builder-form/src/models/metadata-form-props.ts`, `MetadataForm.tsx`), each with inline JSDoc.
  - Verification: run `npm exec nx run builder-form:typecheck` and the existing `DeploymentCreationForm`/`MetadataForm` specs under `libs/builder-form/src/components/*/tests/`.
- [x] 4.3 Pass `formatLocaleLabel={getLocaleDisplayName}` from `ApplicationFormEditor.tsx` and `ToolsetApplicationEditor.tsx`.
  - `ToolsetApplicationEditor` renders `libs/toolset-editor`'s `ToolsetEditor`, so `ToolsetEditorProps` gains the same optional `formatLocaleLabel` and forwards it to `MetadataForm`.
  - Verification: extend `apps/chat/src/pages/ApplicationEditor/tests/toolsetDefinition.spec.tsx` with "a stored `it` translation is shown when only `de` is configured". Run it.
- [x] 4.4 RTL / a11y check: the change adds no physical-direction classes, and the retained row reuses the existing `Select`/`Label required` wiring. Confirm with a `dir="rtl"` render assertion in `DeploymentLocalesField.spec.tsx` that the retained row's select keeps its accessible name.
- [x] 4.5 Slice check: run `npm run verify:changed`.

## 5. Slice 5: Docs

- [x] 5.1 Add `ADDITIONAL_CONTENT_LOCALES` and the deprecated `AVAILABLE_LOCALES` to every environment-variable table in `apps/chat-api/README.md`, covering the format, BCP-47 validation, presence-wins precedence, the primary-locale filter, and the advice to reuse the codes already present in stored data. Add commented examples to `apps/chat-api/.env.template`.
- [x] 5.2 In `docs/legacy-chat-migration-guide.md`, move `AVAILABLE_LOCALES` from "Dropped with no replacement" to "Renamed or re-shaped" (→ `ADDITIONAL_CONTENT_LOCALES`, content locales only, legacy still read with a warning). Add the caveat that 0.x took its primary locale from the first entry, so content whose first entry was not `en` needs checking before upgrade.
- [x] 5.3 Update `libs/chat-hooks/README.md` (`buildAdditionalLocaleOptions` signature and example) and `libs/builder-form/README.md` (`formatLocaleLabel` on `DeploymentLocalesField`, `DeploymentCreationForm` and `MetadataForm`, plus retained-entry behaviour). Every example must compile.
- [x] 5.4 Run `npm run validate:docs` and `npm run validate:specs`.

## 6. Close

- [ ] 6.1 Follow-up, out of scope: open a ui-kit issue asking for a `lang` field on `Select` options, so autonym labels satisfy WCAG 3.1.2.
- [ ] 6.2 Follow-up, out of scope: track removing the `AVAILABLE_LOCALES` fallback after 0.x end of support.
- [ ] 6.3 Run `npm run verify:full` once.
