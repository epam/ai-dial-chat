## ADDED Requirements

### Requirement: Host-owned unsaved-changes handling for `PromptEditor`

`PromptEditor` from `@epam/ai-dial-prompt-editor` SHALL accept a new optional prop `onDirtyChange?: (isDirty: boolean) => void`. The lib SHALL call it with its existing `isDirty` value on mount and whenever that value changes.

When `onDirtyChange` is provided:

- the lib SHALL NOT render its built-in unsaved-changes `ConfirmationDialog`;
- the lib SHALL NOT register its own `beforeunload` listener;
- Back and Cancel SHALL call `onBack` / `onCancel` directly, so that the host owns the guard.

When `onDirtyChange` is omitted, the existing built-in guard and its `discard*` labels SHALL behave exactly as before, so other hosts keep their behaviour. The lib stays free of routing, i18n and app contexts.

The app page (`apps/chat/src/pages/PromptEditor/PromptEditor.tsx`) SHALL:

- pass `onDirtyChange` and feed the reported value to `useBuilderLeaveGuard`;
- stop passing the `discard*` labels;
- call `allowNextNavigation()` before its post-save `navigate(returnUrl)`.

#### Scenario: Host opt-in disables the built-in guard
- **WHEN** the host passes `onDirtyChange`, the user edits the name, and activates Cancel
- **THEN** `onCancel` is called immediately, the lib renders no confirmation, and `onDirtyChange` was last called with `true`

#### Scenario: Reverting reports clean
- **WHEN** the host passes `onDirtyChange` and the user edits the name and then restores it
- **THEN** `onDirtyChange` is called with `true` and then with `false`

#### Scenario: Default behaviour unchanged
- **WHEN** the host omits `onDirtyChange` and the user activates Cancel after editing
- **THEN** the lib's built-in "Discard unsaved changes?" confirmation opens as before
