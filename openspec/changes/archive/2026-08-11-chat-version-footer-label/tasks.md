**Slicing strategy: contract-first, then vertical.** The DTO/OpenAPI contract is agreed and
regenerated first (group 1–2) because the generated `@epam/chat-api-client` sits between the two
sides and regenerating mid-stream would invalidate frontend work. After the contract lands, each
remaining slice is a thin vertical cut that is independently verifiable: backend resolution →
context field → UI label → docs.

Every slice ends with the verification commands listed in its own task. Read
`apps/chat-api/AGENTS.md` before starting group 1 (all of groups 1–3 touch `apps/chat-api/**`).

## 1. Backend contract: env var, registry entry, DTO

- [x] 1.1 Add `CHAT_VERSION?: string` to `EnvironmentVariables` in
      `apps/chat-api/src/config/environment.config.ts` with `@IsOptional()` + `@IsString()` and
      no `@Matches` allowlist (design D1 — no path/URL/log sink). Place it near the other
      general app-level vars (e.g. adjacent to `FOOTER_HTML_MESSAGE`), not in an auth block.
- [x] 1.2 Add the `app.version` definition to `CONFIG_DEFINITIONS` in
      `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` with exactly
      the field values in the `chat-version-display` spec table
      (`type: 'config'`, `valueType: 'string'`, `visibility: 'client'`, `defaultValue: null`,
      `critical: false`, `envVar: 'CHAT_VERSION'`, `owner: 'chat-team'`). Write the
      `description` to state the `packageJson.version` fallback.
- [x] 1.3 Confirm no change is needed in
      `apps/chat-api/src/app-config/config-registry/env-config.provider.ts` — the generic
      `definition.envVar` tail already resolves and type-checks the value. Do **not** add a
      key-specific branch.
- [x] 1.4 Add `appVersion!: string` to `ClientConfigDto` in
      `apps/chat-api/src/app-config/dto/client-config-response.dto.ts` with `@ApiProperty`
      (`type: String`, non-nullable, `example: '0.45.0'`, description naming `CHAT_VERSION` and
      the `package.json` fallback).
- [x] 1.5 Verify the slice: `npm exec nx lint chat-api`. Defer `npm exec nx build chat-api`
      to task 2.5 — adding a required `appVersion` to `ClientConfigDto` makes the response
      object literal in `app-config.service.ts` fail typecheck until task 2.1 populates it, so
      groups 1 and 2 land as one commit.

## 2. Backend resolution and version-token unification

- [x] 2.1 In `apps/chat-api/src/app-config/app-config.service.ts`, add an `appVersion` local to
      `getClientConfig`, resolve `def.key === 'app.version'` into it inside the existing
      `for (const def of clientDefinitions)` chain, and coalesce blank/non-string values to the
      module-level `APP_VERSION` constant with `.trim()` applied (design D3). Include
      `appVersion` in the returned `response.config` object.
- [x] 2.2 Change `sanitizeFooterHtml` in the same file to take the resolved version as a
      parameter instead of closing over `APP_VERSION`, and pass the value computed in 2.1 at the
      `def.key === 'footer.html'` call site (design D4). Ensure `app.version` is resolved before
      `footer.html` is consumed — if the `CONFIG_DEFINITIONS` order does not guarantee that,
      resolve `app.version` explicitly before the loop rather than relying on array ordering.
- [x] 2.3 Add unit tests to `apps/chat-api/src/app-config/tests/app-config.service.spec.ts`
      covering the `chat-version-display` scenarios: `CHAT_VERSION` set; unset → falls back to
      `packageJson.version`; blank/whitespace → falls back; surrounding whitespace trimmed;
      identical value for a roleless user and an `admin` user.
- [x] 2.4 Update the existing `substitutes %%VERSION%% token in footerHtmlMessage` test and add
      a new case asserting the token resolves to `CHAT_VERSION` and equals `config.appVersion`
      in the same response (`footer-message` spec, "Version token honours CHAT_VERSION").
- [x] 2.5 Verify the slice: `npm exec nx test chat-api`, `npm exec nx lint chat-api`,
      `npm exec nx build chat-api`.

## 3. Regenerate the API client

- [x] 3.1 Run `npm run openapi` to regenerate `libs/chat-api-client/openapi.json` and
      `libs/chat-api-client/src/generated/**`. Do not hand-edit any generated file.
- [x] 3.2 Run `npm run openapi:check` and confirm it reports no drift.
- [x] 3.3 Verify the generated package: `npm exec nx build chat-api-client` and
      `npm exec nx lint chat-api-client`.
- [x] 3.4 Architecture guard for `libs/*`: confirm the diff under `libs/` is confined to
      `libs/chat-api-client/` generated output (the documented OpenAPI-client exception) and
      that no hand-authored lib gained an `/api` path, a `server-api` import, an app context,
      env/feature-flag access, routing, analytics, storage, or SDK setup.

## 4. Frontend context field

- [x] 4.1 Add `appVersion: string` to `AppConfigState['config']` in
      `apps/chat/src/context/AppConfigContext.tsx`, set `appVersion: ''` in `INITIAL_STATE`,
      and read `response.config?.appVersion ?? ''` in `loadConfig` — mirroring the existing
      `footerHtmlMessage` handling. No new context, provider, or memoisation.
- [x] 4.2 Confirm no change is needed in `apps/chat/src/server-api/app-config.api.ts` — the
      wrapper returns the generated response type, which now carries `appVersion`.
- [x] 4.3 Verify the slice: `npm exec nx lint chat` and `npm exec nx test chat`.

## 5. Version formatting utility

- [x] 5.1 Add the `formatAppVersion` exported arrow function to
      `apps/chat/src/utils/footer-message.ts` (trim, then prefix `v` unless the value already
      starts with `v`/`V`). Do not create a new one-function utils file.
- [x] 5.2 Add unit tests for `formatAppVersion` in the existing utils spec location for
      `apps/chat/src/utils/footer-message.ts` (create
      `apps/chat/src/utils/tests/footer-message.spec.ts` if none exists), covering all four
      scenarios in the `chat-version-display` spec: bare version, already-prefixed (`v` and
      `V`), whitespace trimming, and a build-stamped pre-release string.
- [x] 5.3 Verify: `npm exec nx test chat`.

## 6. i18n keys

- [x] 6.1 Add `VersionAriaLabel = 'footerMessage.versionAriaLabel'` to the
      `FooterMessageI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`.
- [x] 6.2 Add `"versionAriaLabel": "Application version {{version}}"` under the existing
      `footerMessage` object in `apps/chat/src/i18n/locales/en.json`. Before adding, grep
      `en.json` for an equivalent existing string to avoid a duplicate value.
- [x] 6.3 Add the same key to every other locale file under `apps/chat/src/i18n/locales/` so no
      locale is missing a key.

## 7. FooterMessage rendering

- [x] 7.1 Restructure `apps/chat/src/components/FooterMessage/FooterMessage.tsx`: read
      `config.appVersion` alongside `config.footerHtmlMessage` from `useAppConfig()`, compute
      `isMessageVisible` (ready + `footer` flag + non-empty sanitized HTML) and
      `isVersionVisible` (ready + non-empty `appVersion`), and return `null` only when both are
      false.
- [x] 7.2 Move `dangerouslySetInnerHTML` off the `<section>` root onto a child element rendered
      only when `isMessageVisible`; keep the `eslint-disable-next-line react/no-danger` comment
      with it. Add `relative` to the `<section>` and keep its existing
      `dial-tiny-text w-full px-4 pb-4 pt-1 text-center leading-5 text-secondary desktop:px-8`
      classes and the anchor-styling selectors on whichever element still owns the HTML subtree.
- [x] 7.3 Render the version `<span>` when `isVersionVisible`: text
      `formatAppVersion(appVersion)`, `dir="ltr"`,
      `aria-label={t(FooterMessageI18nKeys.VersionAriaLabel, { version: appVersion })}`, and
      classes `pointer-events-none absolute bottom-4 end-4 desktop:end-8` composed with
      `mergeClasses` if any class is conditional.
- [x] 7.4 RTL check: confirm the label uses the logical `end-*` inset (never `right-*`), that
      `dir="ltr"` is present on the span only (not on the region), that no directional icon was
      introduced, and that the region's padding stays symmetric/logical. Render the app with
      `dir="rtl"` on `<html>` and confirm the label pins to the left corner with the version
      glyphs in unchanged order.
- [x] 7.5 Update `apps/chat/src/components/FooterMessage/tests/FooterMessage.spec.tsx`: extend
      the `useAppConfig` mock to return `appVersion`, keep the existing sanitization assertions
      working against the restructured DOM, and add cases for every scenario in the
      `chat-version-display` "Version label renders in the footer strip" requirement plus the
      revised `footer-message` visibility scenarios (flag off + version present renders the
      region with only the label; both empty renders `null`; loading and error statuses render
      `null`). Query by role and accessible name — no `data-testid`, no `querySelector` except
      for the `pointer-events-none` class assertion.
- [x] 7.6 Verify the slice: `npm exec nx test chat`, `npm exec nx lint chat`,
      `npm exec nx build chat`.

## 8. Documentation

- [x] 8.1 Document `CHAT_VERSION` in `apps/chat-api/.env.template` next to the
      `FOOTER_HTML_MESSAGE` block: purpose, that it is optional, and the `package.json` fallback.
- [x] 8.2 Add `CHAT_VERSION` to the environment-variable table in `apps/chat-api/README.md`.
- [x] 8.3 Update the `FOOTER_HTML_MESSAGE` comment in `.env.template` and its `README.md` row to
      state that `%%VERSION%%` now resolves from `CHAT_VERSION` when set.
- [x] 8.4 Check `docs/` with the `dial-docs` skill for any doc describing footer behaviour, the
      app-config registry, or the env-var surface; update the one authoritative doc and any
      affected diagram in the same commit. If none documents this behaviour, record that no doc
      change was needed.
      **Outcome:** no doc change needed. No doc under `docs/` describes footer rendering or the
      `%%VERSION%%` token. `docs/environment-variables-migration-guide.md` claims to be a full
      env-var list but already stops at "Utility model" — it omits `FOOTER_HTML_MESSAGE`,
      `ANNOUNCEMENT_HTML_MESSAGE`, overlay, scheduled-tasks, and publish vars. Back-filling it
      is out of scope here; see follow-up 10.3. `apps/chat-api/README.md` (which that guide
      defers to) and `.env.template` are updated in 8.1–8.3.

## 9. Final verification

- [x] 9.1 Run the affected set end to end:
      `npm exec nx affected --target=lint --base=origin/development-1.0`,
      `--target=test`, and `--target=build`.
      **Outcome:** `nx build chat-api` green; `nx build chat` Vite bundle green. Two
      environment issues had to be worked around, neither caused by this change:
      (a) `nx test chat-api` fails every spec at the top-level `describe` with
      `TypeError: Cannot read properties of undefined (reading 'config')` — nx spawns vitest
      with a lowercase drive letter (`c:/…` vs `C:/…`), which loads two copies of the vitest
      module graph. Reproduced with this change stashed. Verified instead with
      `npx vitest run --config apps/chat-api/vitest.config.ts` → 124 files / 1926 tests pass,
      and `cd apps/chat && npx vitest run` → 176/177 files, 2233 pass.
      (b) `nx typecheck chat` fails only on `AnnouncementBanner.tsx` (unused imports), an
      unrelated uncommitted WIP file from a concurrent session. `tsc --noEmit` over both
      `tsconfig.app.json` and `tsconfig.spec.json` reports zero errors outside that file.
      Pre-existing unrelated failures left in place: 5 tests in
      `NavigableBottomSheet.spec.tsx` (`No "ElementSize" export is defined on the
      "@epam/ai-dial-ui-kit" mock`), and 2 eslint warnings in `files-listing.service.ts` /
      `share.service.ts`.
- [x] 9.2 Run `npm run openapi:check` once more to confirm the committed OpenAPI artifact still
      matches the final backend state.
- [x] 9.3 Run the five-axis quality review
      (`.claude/skills/code-review-and-quality/SKILL.md`) over the full diff before merge.
      **Outcome:** review returned "request changes" with two confirmed layout defects, both
      invisible to jsdom and both now fixed and re-verified by measuring in Chromium:
      (a) with no footer message the section had no in-flow child, so its box collapsed to 20px
      and the `bottom-4` label rendered *above* the section — exactly the no-`FOOTER_HTML_MESSAGE`
      deployment this change exists to serve. The label is now absolute only when a message is
      present, and in flow (`text-end`) otherwise.
      (b) `dir="ltr"` sat on the same element as `end-4`; logical insets resolve against the
      element's own direction, so the label stayed pinned to the physical right corner in RTL.
      Direction isolation moved to an inner glyph-only span; the positioned element now inherits
      page direction. Measured: RTL puts the glyphs 16px from the section's left edge, LTR 16px
      from the right.
      Also applied: `aria-label` on a role-less `<span>` (ARIA prohibits naming `generic`)
      replaced with an `sr-only` translated string plus `aria-hidden` on the glyph run;
      `appVersion` trimmed before the visibility check; `app.version` filtered out of
      `clientDefinitions` instead of `continue`-ing inside the loop.
      Separately found while re-running: `appVersion?.trim()` is deliberately optional-chained —
      23 existing specs mock `useAppConfig` without the field, and `FooterMessage` renders on
      every conversation route, so a missing field must degrade to "no label" rather than crash
      the route.

## 10. Follow-ups (out of scope — do not implement here)

- [ ] 10.1 Decide whether `%%VERSION%%` in `FOOTER_HTML_MESSAGE` should be deprecated now that a
      dedicated label exists (design, Open Questions).
- [ ] 10.2 Decide whether a deployment needs a way to suppress the version label entirely
      (design D6 / Open Questions). No requester today.
- [ ] 10.3 Back-fill `docs/environment-variables-migration-guide.md`, which claims to be the
      full `apps/chat-api` env-var list but omits every var after the utility-model section
      (footer, announcement, overlay, scheduled tasks, publish, file-manager tabs, and now
      `CHAT_VERSION`). Pre-existing gap, found during 8.4.
