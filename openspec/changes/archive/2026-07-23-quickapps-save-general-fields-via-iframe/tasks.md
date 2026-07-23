## 1. Message contract

- [x] 1.1 In `apps/chat/src/types/apps-editor.ts`, add `TriggerSaveGeneralPayload`
      (`name: string`, `description?: string`, `iconUrl?: string`, `topics?: string[]`,
      `intro?: string` — no `version`) and `TriggerSaveMessage` (`{ type:
      AppsEditorEvent.TriggerSave; general?: TriggerSaveGeneralPayload }`).

## 2. GeneralForm

- [x] 2.1 In `apps/chat/src/pages/AppsEditor/GeneralForm.tsx`, add `getValues: () =>
      TriggerSaveGeneralPayload` to `GeneralFormHandle`, returning the current trimmed
      `values` normalized the same way `handlePersist` used to (trimmed name/description/
      iconUrl/intro, `topics` as-is, omitting `version`).
- [x] 2.2 Remove `handlePersist`, the `persist` entry from `GeneralFormHandle`, the
      `updateApplication` import, and `seededValuesRef`'s dirty-check usage (keep
      `seededValuesRef`/`hasSeededInitialValuesRef` only if still needed for seeding —
      check whether anything else in the file still reads them before removing).
- [x] 2.3 Update `apps/chat/src/pages/AppsEditor/tests/GeneralForm.spec.tsx`: remove
      `persist`/dirty-check test cases, add coverage for `getValues()` returning current
      trimmed form state.

## 3. AppEditorIframe

- [x] 3.1 In `apps/chat/src/pages/AppsEditor/AppEditorIframe.tsx`, change
      `AppEditorIframeHandle.triggerSave` to `(general?: TriggerSaveGeneralPayload) =>
      void` and update the `postMessage` call to send `{ type:
      AppsEditorEvent.TriggerSave, general } satisfies TriggerSaveMessage`.
- [x] 3.2 Update `apps/chat/src/pages/AppsEditor/tests/AppEditorIframe.spec.tsx` to assert
      the posted message includes the passed `general` payload (and omits it when not
      passed).

## 4. SettingsStep

- [x] 4.1 In `apps/chat/src/pages/AppsEditor/SettingsStep.tsx`, change
      `SettingsStepHandle.triggerSave` to `(general?: TriggerSaveGeneralPayload) => void`
      and forward the argument to `iframeRef.current?.triggerSave(general)`.
- [x] 4.2 Update `apps/chat/src/pages/AppsEditor/tests/SettingsStep.spec.tsx` to assert
      the argument is forwarded to the iframe handle.

## 5. AppsEditor

- [x] 5.1 In `apps/chat/src/pages/AppsEditor/AppsEditor.tsx`, update `handleSave` to
      compute `general` (via `generalFormRef.current?.getValues()`) only when
      `hasExistingAppOnMountRef.current` is true, and pass it to
      `settingsStepRef.current?.triggerSave(general)`.
- [x] 5.2 Update `handlePreview` to call `settingsStepRef.current?.triggerSave()` with no
      `general` argument (Preview never persists General edits).
- [x] 5.3 Simplify `handleSaveSuccess`: remove the `completeSave` async wrapper's
      `generalFormRef.current?.persist()` call and its try/catch branch (the
      `ErrorSaveFailed` catch tied specifically to that persist call); keep
      `refetchDeployments()` + navigate/preview-mode logic, using
      `refetchDeployments().catch(() => undefined)` as the sole failure handling for what
      remains.
- [x] 5.4 Remove `pendingSaveAction`/`hasExistingAppOnMountRef` usage that only existed to
      gate the removed persist call, if any becomes dead after 5.1–5.3 — otherwise leave
      as-is (both are still needed for the `general` gating and preview/save
      distinction).

## 6. Tests and verification

- [x] 6.1 Update `apps/chat/src/pages/AppsEditor/tests/AppsEditor.spec.tsx`: replace
      assertions on a post-`SaveSuccess` `update-application` call with assertions that
      `triggerSave` (mocked `SettingsStepHandle`) is called with the expected `general`
      payload for Save & Exit on an existing app, with `undefined`/no `general` for
      Preview and for a session-created app.
- [x] 6.2 Run `npm exec nx test chat` and fix any failures.
- [x] 6.3 Run `npm exec nx lint chat` and fix any failures.
- [x] 6.4 Manually verify in the running app (per CLAUDE.md UI-change guidance): edit
      General fields on an existing Quick App, Save & Exit, and confirm the edited
      values persist after reload — this depends on the embedded QuickApps editor
      already consuming the new `general` payload (external coordination dependency
      noted in design.md); if it doesn't yet, note that as a follow-up rather than
      blocking this change's own tests.
