## 1. Contract types

- [ ] 1.1 Add `ReadyToSave = 'READY_TO_SAVE'` to `AppsEditorEvent` in
      `apps/chat/src/types/apps-editor.ts`, with a JSDoc comment describing it as distinct
      from `ReadyToInteract` (data-model-ready vs. UI-rendered) per `design.md`.

## 2. AppEditorIframe.tsx

- [ ] 2.1 Rename the existing `isLoading` state to `isUiLoading` (still driven by the native
      iframe `load` event and `ReadyToInteract`); keep it controlling the spinner overlay only.
- [ ] 2.2 Add a new `isReadyToSave` boolean state, `false` by default, set to `true` only on
      receiving `${displayName}/${AppsEditorEvent.ReadyToSave}` in the existing `handleMessage`
      switch.
- [ ] 2.3 Reset `isReadyToSave` to `false` whenever the iframe reloads (i.e. whenever
      `iframeUrl` changes), mirroring how `isUiLoading` is already reset on reload.
- [ ] 2.4 Change the `onReadyChange` effect to report `isReadyToSave` (not `!isUiLoading`).
- [ ] 2.5 Update the JSDoc on the `onReadyChange` prop to state it now reflects "ready to
      save", not "UI rendered".

## 3. AppsEditor.tsx readiness timeout

- [ ] 3.1 Add a `SETTINGS_READY_TIMEOUT_MS` constant (15000, see `design.md` Decision 3) with
      an explanatory comment distinguishing it from `SETTINGS_SAVE_TIMEOUT_MS`.
- [ ] 3.2 Add a ready-timeout ref/state, started when the Settings step becomes visible
      (mirrors the existing `settingsReadyKeyRef` reset-on-app/schema-change logic) and cleared
      as soon as `isSettingsReady` becomes `true`.
- [ ] 3.3 On timeout, surface a new inline error (reuse the existing `saveError` notification
      area or a distinct one — decide based on whether save-error and readiness-error need to
      coexist) with the new i18n key from Task 4, without touching `isSaving`/
      `pendingSaveAction` (no save is in progress at this point).
- [ ] 3.4 Ensure the readiness timeout is cleared/reset correctly when the iframe reloads for
      a different app/schema (same key-based reset as `isSettingsReady`), so a stale timeout
      can't fire after switching apps.

## 4. i18n

- [ ] 4.1 Add `AppsEditorI18nKeys.ErrorSettingsNotReady` (or similar) to
      `apps/chat/src/constants/translation-keys.ts`.
- [ ] 4.2 Add the matching English string to `apps/chat/src/i18n/locales/en.json` under the
      `appsEditor.error` namespace, checking first whether an existing generic string can be
      reused per the i18n dedup rule in `AGENTS.md`.

## 5. Tests

- [ ] 5.1 Update `apps/chat/src/pages/AppsEditor/tests/AppsEditor.spec.tsx`'s "Settings step
      readiness gating" describe block: rename/extend the mock's `onReadyChange` trigger to
      simulate `ReadyToSave` semantics (the mock already calls `onReadyChange` directly, so
      most assertions carry over — verify the "does not disable Next on the General step" and
      timeout tests still hold).
- [ ] 5.2 Add a test asserting Save/Preview stay disabled when only a `ReadyToInteract`-style
      readiness fires without a `ReadyToSave`-style one, if the mock granularity allows
      distinguishing them (otherwise cover this at the `AppEditorIframe.spec.tsx` level).
- [ ] 5.3 Add/update `apps/chat/src/pages/AppsEditor/tests/AppEditorIframe.spec.tsx` (create if
      it doesn't exist) covering: `ReadyToInteract` alone does not set ready-to-save;
      `ReadyToSave` sets it; reload resets it to `false`; `onReadyChange` is called with the
      right value at the right time.
- [ ] 5.4 Add a test for the new readiness timeout in `AppsEditor.spec.tsx`: no `ReadyToSave`
      within `SETTINGS_READY_TIMEOUT_MS` surfaces the new error and does not affect
      `isSaving`/save-in-progress state.

## 6. Verification

- [ ] 6.1 `npm exec nx test chat` (or scoped to the touched spec files) — all pass.
- [ ] 6.2 `npm exec nx lint chat` — no new violations.
- [ ] 6.3 `npm exec nx build chat` — builds cleanly.
- [ ] 6.4 Manually confirm (per `docs/` or local run) that the Settings step's Save/Preview
      stay disabled indefinitely (until the readiness timeout fires) against an unmodified
      Quick Apps editor that has not yet implemented `ReadyToSave` — this is the expected,
      intentional behavior until that team ships their side (see `design.md` Migration Plan).
