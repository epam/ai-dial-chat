# Tasks

**Slicing strategy: vertical.** Group 1 is the foundation the picker stands on — it cannot be
demonstrated to work until a stored preference survives a reload. Group 2 puts the control on
screen. Group 3 is documentation.

Scope discipline: each task touches only what it names. Out-of-scope findings become follow-ups in
group 3, never inline edits.

Verification uses the `lean-verification` skill; `npm run test:file -- <path>` for the red/green
loop within a task, `npm run verify:changed` at the end of each group.

> **Scope removed.** An earlier revision of this change also covered a per-application theme URL:
> an editor field, `themeUrl` on the application write/read API, DIAL Core `catalog_properties`
> storage, a `GET /api/v1/themes/remote` proxy with an origin allowlist, and a runtime overlay that
> repainted the window while a themed app was open. **The user removed that scope.** Its code,
> tests, endpoint, environment variable and four spec capabilities were deleted, not parked. The
> previous groups 3–9 are gone with it.

---

## 1. Fix the theme foundation

- [x] 1.1 Write failing tests in `apps/chat/src/utils/tests/apply-theme-colors.spec.ts` for the
      stale-property cases: applying theme B after theme A removes A-only keys; calling with no
      theme clears everything previously written.
- [x] 1.2 Make `apps/chat/src/utils/apply-theme-colors.ts` track the property names it last wrote
      per target element and `removeProperty` them before writing the next set. Keep the existing
      signature.
- [x] 1.3 Write failing tests in `apps/chat/src/context/tests/ThemeContext.spec.tsx` for the restore
      order: a stored id present in the configuration wins; `system` is honoured; a stored id absent
      from the configuration falls back to `light`; the stored value is not overwritten on fallback;
      nothing stored resolves to `light` even when the configuration lists `dark` first.
- [x] 1.4 Replace the restore block in `apps/chat/src/context/ThemeContext.tsx` with that resolution
      order, guarding the `config.themes` read against an empty array.
- [x] 1.5 Verify: `npm run test:file` on both specs, then `npm run verify:changed`.

## 2. Settings theme picker over every configured theme

- [x] 2.1 Generalize `apps/chat/src/hooks/theme/useThemeOptions.ts` to return
      `{ options, selectedTheme, setTheme }`: one option per configured theme in order, `system`
      appended only when both `light` and `dark` exist, labels from i18n for the three known ids and
      from `displayName` (falling back to `id`) otherwise. Memoise `options` on `config.themes`
      and `t`.
- [x] 2.2 Add `apps/chat/src/hooks/theme/tests/useThemeOptions.spec.ts` covering every option-set
      scenario in the spec.
- [x] 2.3 Un-park the theme row in
      `apps/chat/src/pages/SettingsPage/PreferencesTab/PreferencesTab.tsx`: delete the parked note
      and commented block, render the ui-kit `Select` as the first row, wire
      `isThemeRowShown = !isUserSettingsHidden && options.length > 1`, and add it to `hasAnyRow` and
      the `isResolvingRows` gate.
- [x] 2.4 Extend `apps/chat/src/pages/SettingsPage/PreferencesTab/tests/` for: two themes → row
      shown; one theme → row absent; `HideUserSettings` → row absent; selecting a theme calls
      `setTheme`; a custom theme renders under its `displayName`; the theme row alone suppresses the
      empty state.
- [x] 2.5 Mock `useThemeOptions` in `apps/chat/src/pages/SettingsPage/tests/SettingsPage.spec.tsx` —
      that suite renders the real `PreferencesTab` without a `ThemeProvider`.
- [x] 2.6 Verify with `npm run verify:changed`.

## 3. Docs and final verification

- [x] 3.1 Update `docs/theme-customization.md`: remove the "ids other than light/dark/system are
      unreachable" limitation, describe the generalized picker (every configured theme, `system`
      only when both `light` and `dark` exist, row hidden below two options), and state that `light`
      is the default for a user who has never chosen.
- [x] 3.2 Check whether `docs/architecture.md` describes the theme picker or the `ThemeContext`
      restore behaviour; update it only if it does. No new endpoint, context or route was added, so
      it may need nothing.
- [x] 3.3 Run the accessibility pass on the new control per `.claude/rules/a11y.md`: the `Select` is
      labelled via `labelProps.label`, keyboard-operable through the kit component, and no focus is
      lost when the theme repaints.
- [x] 3.4 Run `npm run validate:docs` — not covered by lint, test or build; the PR workflow runs it
      as its own job.
- [x] 3.5 Run `npm run verify:full` once, then the five-axis review from
      `.claude/skills/code-review-and-quality/SKILL.md`.
- [x] 3.6 Record any out-of-scope finding met along the way as a follow-up here rather than fixing
      it inline. All of the following are pre-existing on this branch and **not** caused by this
      change:
      - `@epam/ai-dial-chat-shared:typecheck` fails on `ToolbarOptions.tabs` in
        `DialFileManagerShell.tsx` and `FileManagerAttachModal.tsx`, and
        `useFileAttachmentPicker.spec.ts` ("filters the tab list down to allowedTabs") fails with
        it — one root cause, the file-manager package bump. Fixed in the sibling
        `ai-dial-react-file-manager` repo and released as a package, not here. This blocks
        `lint:check` for everything downstream.
      - `SkillEditorPreview.spec.tsx` and `apps/chat-api/src/telemetry/tests/http-lifecycle.integration.spec.ts`
        fail intermittently in a full-suite run and pass in isolation — load-sensitive flakes.
      - `npm run test:full:quiet` exits `0` even when tasks fail; read the log, not the exit code.
