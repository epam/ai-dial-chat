## ADDED Requirements

### Requirement: App editor iframe reports dirty state

`AppsEditorEvent` (`apps/chat/src/types/apps-editor.ts`) SHALL gain the member `DirtyState = 'DIRTY_STATE'`.

`AppEditorIframe` (`apps/chat/src/pages/ApplicationEditor/setup/AppEditorIframe.tsx`) SHALL handle `DIRTY_STATE` messages whose payload carries a boolean `isDirty`. It SHALL accept such a message only from the embedded editor's own window, under the same origin and source checks as `VALIDITY_STATE`, and SHALL report the value to its parent through a new optional `onDirtyChange?: (isDirty: boolean) => void` prop. The Setup section forwards that value to `ApplicationFormEditor`. Messages with a non-boolean `isDirty` SHALL be ignored.

The iframe's dirty state SHALL be treated as `false`:

- until the first `DIRTY_STATE` message arrives;
- after `SAVE_SUCCESS`;
- when the iframe reloads for a different app or schema.

`ApplicationFormEditor` OR's this value into its `isDirty` for `useBuilderLeaveGuard` (see `builder-unsaved-changes-guard`).

#### Scenario: Iframe reports unsaved edits
- **WHEN** the embedded editor posts `{ type: 'DIRTY_STATE', isDirty: true }` from its own window
- **THEN** `onDirtyChange(true)` is called

#### Scenario: Message from another window is ignored
- **WHEN** a `DIRTY_STATE` message arrives from a window other than the embedded editor
- **THEN** `onDirtyChange` is not called

#### Scenario: Save success clears dirtiness
- **WHEN** the iframe was dirty and `SAVE_SUCCESS` arrives
- **THEN** `onDirtyChange(false)` is called

#### Scenario: Reload for another app resets dirtiness
- **WHEN** the iframe reloads for a different app id or schema
- **THEN** the reported dirty state is `false` until the new editor posts `DIRTY_STATE`
