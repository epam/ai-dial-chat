# Tasks

**Slicing strategy: risk-first, then vertical.**

Group 1 is a standalone bug fix that everything else stands on — the theme picker cannot be
demonstrated to work until the stored preference survives a reload. Groups 1–2 deliver the Settings
picker end to end and are shippable on their own, with no backend change and no feature flag.

Group 3 is the riskiest unknown (does DIAL Core accept an unknown `catalog_properties` key?) and is
proven before any UI depends on it, per `design.md` D1. Groups 4–8 then run vertically: contract,
backend, editor, runtime, docs.

Scope discipline: each task touches only what it names. Out-of-scope findings become follow-ups in
group 10, never inline edits.

Verification uses the `lean-verification` skill; `npm run test:file -- <path>` for the red/green
loop within a task, `npm run verify:changed` at the end of each group.

---

## 1. Fix the theme foundation (no new feature, shippable alone)

- [x] 1.1 Write failing tests in `apps/chat/src/utils/tests/apply-theme-colors.spec.ts` for the
      stale-property cases: applying theme B after theme A removes A-only keys; calling with no
      theme clears everything previously written.
- [x] 1.2 Make `apps/chat/src/utils/apply-theme-colors.ts` track the property names it last wrote
      per target element and `removeProperty` them before writing the next set. Keep the existing
      signature.
- [x] 1.3 Write failing tests in `apps/chat/src/context/tests/ThemeContext.spec.tsx` for the restore
      order: a stored id present in the configuration wins; `system` is honoured; a stored id absent
      from the configuration falls back to `config.themes[0].id` then `ThemeId.Light`; the stored
      value is not overwritten on fallback.
- [x] 1.4 Replace the restore block at `apps/chat/src/context/ThemeContext.tsx:93-107` with that
      resolution order. Guard the existing `config?.themes?.[0].id` read against an empty `themes`
      array while you are in the block — it currently throws on `[]`.
- [x] 1.5 Verify: `npm run test:file -- apps/chat/src/utils/tests/apply-theme-colors.spec.ts` and
      `npm run test:file -- apps/chat/src/context/tests/ThemeContext.spec.tsx`, then
      `npm run verify:changed`.

## 2. Settings theme picker over every configured theme

- [x] 2.1 Generalize `apps/chat/src/hooks/theme/useThemeOptions.ts` to return
      `{ options, selectedTheme, setTheme }` per the `theme-selection` spec: one option per
      configured theme in order, `system` appended only when both `light` and `dark` exist, labels
      from i18n for the three known ids and from `displayName` (falling back to `id`) otherwise.
      Memoise `options` on `config.themes` and `t`.
- [x] 2.2 Add `apps/chat/src/hooks/theme/tests/useThemeOptions.spec.ts` covering all four option-set
      scenarios in the spec.
- [x] 2.3 Un-park the theme row in
      `apps/chat/src/pages/SettingsPage/PreferencesTab/PreferencesTab.tsx`: delete the note at
      `:26-47` and the commented block at `:92-107`, render the ui-kit `Select` as the first row,
      wire `isThemeRowShown = !isUserSettingsHidden && options.length > 1`, and add it to
      `hasAnyRow` and the `isResolvingRows` gate.
- [x] 2.4 Extend `apps/chat/src/pages/SettingsPage/PreferencesTab/tests/` for: two themes → row
      shown; one theme → row absent; `HideUserSettings` → row absent; selecting a theme calls
      `setTheme`; a custom theme renders under its `displayName`.
- [x] 2.5 Verify with `npm run verify:changed`. **Checkpoint — groups 1–2 are independently
      shippable.**

## 3. Prove the storage assumption (blocks everything after it)

- [ ] 3.1 Against a live DIAL Core, create an application with
      `application_type_schema_id` set and a `catalog_properties.themeUrl` key, then read it back
      through `getCustomApplication`. Confirm the key round-trips and that DIAL Core does not reject
      it against `catalogSchemaId`.
- [ ] 3.2 Record the outcome in `design.md` under D1 — either "confirmed, no change" or the agreed
      namespaced-key fallback. Do not start group 4 until this line exists.

## 4. Backend: environment, feature flag, allowlist

- [x] 4.1 Add `THEMES_ALLOWED_ORIGINS` (optional string) to `EnvironmentVariables` in
      `apps/chat-api/src/config/environment.config.ts` with class-validator decorators. No casts.
      (No `APP_THEMES_ENABLED` — the allowlist is the only switch.)
- [x] 4.2 ~~Register a `features.appThemesEnabled` client flag.~~ **Dropped at the user's request** —
      no client feature flag; `THEMES_ALLOWED_ORIGINS` alone decides whether a theme can load.
- [x] 4.3 In `apps/chat-api/src/themes/theme.service.ts`, parse `THEMES_ALLOWED_ORIGINS` once in the
      constructor into a `Set<string>` of `https` origins; drop and `warn` on each unparseable or
      non-`https` entry.
- [x] 4.4 Add a private `resolveAllowedOrigin(themeUrl)` helper that parses, checks the protocol,
      checks set membership, and throws `BadRequestException` — with a message that discloses
      nothing about reachability — before any socket is opened.
- [x] 4.5 Tests in `apps/chat-api/src/themes/tests/theme.service.spec.ts` for every branch of 4.3
      and 4.4, including that no `fetch` is issued on rejection.
- [x] 4.6 Verify: `npm exec nx test chat-api` and `npm exec nx lint chat-api`.

## 5. Backend: remote theme proxy endpoints

- [x] 5.1 Add `GetRemoteThemeDto` and `GetRemoteThemeIconDto` under
      `apps/chat-api/src/themes/dto/`, reusing the existing `GetThemeIconDto` icon-name allowlist
      regex verbatim for `iconName`.
- [x] 5.2 Add `ThemeService.getRemoteTheme(themeUrl)`: resolve the origin, fetch
      `<origin><pathname>/config.json` with `redirect: 'manual'`, `AbortController` on
      `THEMES_SERVICE_TIMEOUT_MS`, 256 KB body cap, and the documented error mapping.
- [x] 5.3 Add configuration validation to that method: non-empty `themes` array, non-empty string
      `id` per theme, string colour values, colour keys matching `^[a-zA-Z0-9-]+$` (non-conforming
      keys dropped, malformed `themes` → `BadGatewayException`).
- [x] 5.4 Add `ThemeService.getRemoteThemeIcon(themeUrl, iconName)` with the same origin resolution,
      redirect handling and timeout, plus a 2 MB body cap and the existing `mime-types` lookup.
- [x] 5.5 Add caching: `themes:remote:<sha256(origin+pathname)>` and
      `themes:remote:icon:<sha256(origin+pathname)>:<iconName>`, both at the existing 5-minute TTL.
- [x] 5.6 Create `apps/chat-api/src/themes/remote-theme.controller.ts` —
      `@Controller({ path: 'themes', version: '1' })`, **not** `@Public()`, handlers `getRemoteTheme`
      and `getRemoteThemeIcon`, `@ApiOperation` plus an `@ApiResponse` for every status the spec
      lists (200/400/401/404/502/503), `Cache-Control: public, max-age=300`.
- [x] 5.7 Register it in `apps/chat-api/src/themes/themes.module.ts` alongside the untouched
      `ThemeController`; confirm both resolve the same `ThemeService` instance.
- [x] 5.8 Add `apps/chat-api/src/themes/tests/remote-theme.controller.spec.ts` and extend the
      service spec: allow-listed fetch, rejected origin with no outbound call, http rejected by the
      pipe, path/query discarded, redirect → 502, oversized body → 502, malformed config → 502,
      unsafe colour key dropped, timeout → 503, cache hit, traversal icon name → 400, 401 for an
      unauthenticated caller.
- [x] 5.9 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`,
      `npm exec nx build chat-api`.

## 6. Backend: themeUrl on the application write and read paths

- [x] 6.1 Add `themeUrl` to `apps/chat-api/src/applications/dto/create-application.dto.ts` and
      `update-application.dto.ts` with `@IsString() @IsOptional()`, an https-or-empty URL check, and
      `@ApiPropertyOptional`.
- [x] 6.2 In `apps/chat-api/src/applications/applications.service.ts`, write
      `catalog_properties.themeUrl` on create when the value is non-empty.
- [x] 6.3 In the same service's update path, apply **merge** semantics to `catalog_properties` —
      omitted/`null` carries through, non-empty sets the one key, empty deletes the one key, an
      emptied map is written as `{}`. Do not touch the `applicationProperties` replacement logic.
- [x] 6.4 Add `themeUrl` to `ModelCatalogPropertiesDto` and `themeUrl: getString(raw, 'themeUrl')`
      to `mapCatalogProperties` in
      `apps/chat-api/src/deployments/utils/deployment-mapper.util.ts`.
- [x] 6.5 Extend `apps/chat-api/src/applications/tests/` and
      `apps/chat-api/src/deployments/details/tests/deployments-details.service.spec.ts` for every
      scenario in the `applications-write-api` and `deployment-details-api` deltas, including that
      sibling catalog keys survive and a non-string value is ignored.
- [x] 6.6 Verify: `npm exec nx test chat-api`, `npm exec nx lint chat-api`.

## 7. Contract regeneration

- [x] 7.1 Run `npm run openapi` and `npm run openapi:check`; confirm the new operation ids are
      `getRemoteTheme` / `getRemoteThemeIcon` and that the three DTOs carry `themeUrl`.
- [x] 7.2 Build and lint `chat-api-client`. Do not hand-edit any generated file.
- [x] 7.3 Add `THEMES_REMOTE = '/api/v1/themes/remote'` and
      `THEMES_REMOTE_ICON = '/api/v1/themes/remote/icon'` to the `ApiEndpoints` enum in
      `apps/chat/src/server-api/base.ts` — the icon URL is built by hand for `<img src>`, as
      `resolveCatalogIconUrl` does today.
- [x] 7.4 Add a `getRemoteTheme` wrapper to `apps/chat/src/server-api/` delegating to the generated
      client, following the shape of `apps/chat/src/server-api/deployments.ts`.

## 8. Frontend: the AppsEditor theme URL field

- [ ] 8.1 Add the four `appsEditor.generalForm.themeUrl*` keys to
      `apps/chat/src/i18n/locales/en.json` and the matching `AppsEditorI18nKeys` members in
      `apps/chat/src/constants/translation-keys.ts`.
- [ ] 8.2 Add `themeUrl?: string` to `GeneralFormInitialValues` and
      `getThemeUrl: () => string \| undefined` to `GeneralFormHandle` in
      `apps/chat/src/pages/AppsEditor/GeneralForm.tsx`. Leave `TriggerSaveGeneralPayload` in
      `apps/chat/src/types/apps-editor.ts` unchanged — it is the iframe wire contract.
- [ ] 8.3 Render the ui-kit `Input` below `DeploymentCreationForm`, always shown, with the label,
      placeholder, caption and error slot from 8.1. Seed it through its own ref-guarded effect (the
      shared one has already latched by the time the details request resolves).
- [ ] 8.4 Add https-or-empty validation that blocks submission and renders
      `appsEditor.generalForm.themeUrlInvalid`, alongside — not replacing —
      `validateDeploymentCreationFields`.
- [ ] 8.5 Pass `themeUrl` on the create path (`createApplication` in `handleSubmit`) and on the edit
      path (the follow-up `updateApplication` in `AppsEditor.handleSaveSuccess`,
      `apps/chat/src/pages/AppsEditor/AppsEditor.tsx:291-300`, via `getThemeUrl()`). Send neither
      while the flag is off.
- [ ] 8.6 In `AppsEditor`, fetch `getDeploymentDetails(existingAppId)` when editing and the flag is
      on, read `applicationDetails?.catalogProperties?.themeUrl`, and merge it into
      `generalFormInitialValues`. Cancelled flag, no state after unmount, keyed on the app id, quiet
      on failure.
- [ ] 8.7 Extend `apps/chat/src/pages/AppsEditor/tests/` for every scenario in the `app-editor-flow`
      delta: field shown/absent by flag, prefill, edit not clobbered, both validation rejections,
      empty submits clean, both save paths, clearing, and the quiet details failure.
- [ ] 8.8 Verify with `npm run verify:changed`.

## 9. Frontend: the app theme overlay

- [ ] 9.1 Extend `ThemeContext` with `appThemeUrl`, `setAppThemeUrl`, `isAppThemeActive`, keeping
      `useMemo`/`useCallback` and the outside-provider throw.
- [ ] 9.2 Add the fetch-and-apply effect: `getRemoteTheme`, cancelled flag, an in-memory
      per-URL cache for the provider's lifetime, id-matched theme selection falling back to the
      first theme, colours applied in place of the base theme, console-only error handling.
- [ ] 9.3 Make the base theme reapply synchronously on `setAppThemeUrl(null)` from the already
      loaded base configuration, and re-run the app-theme selection when the base theme changes.
- [ ] 9.4 Resolve `currentThemeLogo` from the app configuration's `images` through a
      `/api/v1/themes/remote/icon` URL when an app theme is active, falling back to the base logo.
      Leave `currentThemeFavicon` and `useFavicon` on the operator's favicon.
- [ ] 9.5 Wire the conversation surface: read
      `selectedDeploymentDetails.applicationDetails?.catalogProperties?.themeUrl` from
      `DeploymentsContext` (`apps/chat/src/context/DeploymentsContext.tsx:551-585`, no new request)
      and drive `setAppThemeUrl` from one effect with a clearing cleanup.
- [ ] 9.6 Wire the editor surface: drive `setAppThemeUrl` from the details fetched in 8.6, clearing
      on unmount and re-setting after a save that changes the value.
- [ ] 9.7 Extend `apps/chat/src/context/tests/ThemeContext.spec.tsx` for every scenario in the
      `active-app-theme` delta, including flag-off inertness, id matching, replacement-not-merge,
      the untouched stored preference, mid-flight navigation, the per-URL cache, and that focus and
      the logo's `alt` survive a repaint.
- [ ] 9.8 Add surface-level tests for activation and clearing on both routes.
- [ ] 9.9 Measure the repaint cost of switching between two themed conversations
      (`design.md` risk list). If perceptible, add a short debounce to `setAppThemeUrl` and record
      the measurement in `design.md`; otherwise record that no debounce was needed.
- [ ] 9.10 Verify with `npm run verify:changed`.

## 10. Docs, accessibility gate, and final verification

- [ ] 10.1 Update `docs/theme-customization.md`: remove the "ids other than light/dark/system are
      unreachable" limitation at `:94`, describe the generalized picker, and add a per-application
      theme section covering `THEMES_ALLOWED_ORIGINS`, the two surfaces, the
      logo-yes/favicon-no rule, and the five-minute cache.
- [ ] 10.2 Update `docs/architecture.md`: the two new `ApiEndpoints` members, the new versioned
      themes routes, and the new context surface — same change, not a follow-up.
- [ ] 10.3 Update `apps/chat-api/README.md` and `apps/chat-api/.env.template` with
      `THEMES_ALLOWED_ORIGINS`. No `ENABLED_FEATURES_ROLES.md` entry — there is no feature flag.
- [ ] 10.4 Run the accessibility pass on the two new controls per `.claude/rules/a11y.md`: the
      Settings `Select` is labelled and keyboard-operable, the editor `Input` associates its caption
      and error, no decorative icon is left unlabelled, and no focus is lost on a theme repaint.
- [ ] 10.5 Run `npm run validate:docs` — it is not covered by lint, test, or build, and the PR
      workflow runs it as its own job.
- [ ] 10.6 Run `npm run verify:full` once, then the five-axis review from
      `.claude/skills/code-review-and-quality/SKILL.md`.
- [ ] 10.7 Record any out-of-scope finding met along the way as a follow-up item here rather than
      fixing it inline — in particular the pre-existing inaccuracy in
      `openspec/specs/themes-module/spec.md`, which says `/api/v1/themes/*` where the code serves
      `/api/themes/*` (the delta in this change corrects it; confirm the archive picks that up).
