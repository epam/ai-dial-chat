## ADDED Requirements

### Requirement: Input component accepts initial attachments
The `Input` component SHALL accept an optional `initialAttachments` prop that pre-populates the attachment tray on mount.

#### Scenario: Pre-populated attachments on mount
- **WHEN** `Input` is rendered with `initialAttachments` containing one or more attachments
- **THEN** those attachments are displayed in the attachment tray immediately on mount

#### Scenario: No initial attachments (default behaviour unchanged)
- **WHEN** `Input` is rendered without `initialAttachments`
- **THEN** the attachment tray is empty on mount (existing behaviour preserved)

### Requirement: Input component accepts a footer actions render prop
The `Input` component SHALL accept an optional `renderFooterActions` render prop that, when provided, replaces the default send/stop/model-selector area with custom content.

The render prop signature is:
```ts
renderFooterActions?: (helpers: { canSend: boolean; onSend: () => void }) => ReactNode
```

- `canSend` — `true` when the textarea has non-empty trimmed content
- `onSend` — triggers the same internal send flow as the default send button

#### Scenario: Custom footer replaces default actions
- **WHEN** `renderFooterActions` is provided
- **THEN** the default Send/Stop buttons and model selector are not rendered
- **THEN** the return value of `renderFooterActions` is rendered in their place

#### Scenario: Default footer rendered when prop is absent
- **WHEN** `renderFooterActions` is not provided
- **THEN** the existing Send/Stop/model-selector area is rendered (existing behaviour preserved)

#### Scenario: canSend reflects textarea content
- **WHEN** the textarea is empty or contains only whitespace
- **THEN** `canSend` passed to `renderFooterActions` is `false`

- **WHEN** the textarea contains at least one non-whitespace character
- **THEN** `canSend` passed to `renderFooterActions` is `true`

### Requirement: Input component supports stacked layout
The `Input` component SHALL accept an optional `isStacked` boolean prop. When `true`, the textarea always occupies its own full-width row above the action bar, regardless of whether attachments are present.

#### Scenario: Stacked layout forced by prop
- **WHEN** `Input` is rendered with `isStacked={true}` and no attachments present
- **THEN** the textarea renders on its own row above the action bar (same layout as when attachments are present)

#### Scenario: Default compact layout preserved
- **WHEN** `isStacked` is absent or `false` and no attachments are present
- **THEN** the textarea renders inline within the action bar row (existing behaviour preserved)

### Requirement: Input component supports hiding the action bar
The `Input` component SHALL accept an optional `hideActionBar` boolean prop. When `true`, the entire action bar row (attach button, send/stop, model selector, and any `renderFooterActions` content) is not rendered. Only the attachment tray and textarea remain inside the bordered box.

#### Scenario: Action bar hidden
- **WHEN** `hideActionBar={true}`
- **THEN** no action bar row is rendered inside the bordered box
- **THEN** the textarea (and attachment tray if attachments are present) is the sole content of the bordered box

#### Scenario: Default action bar rendered
- **WHEN** `hideActionBar` is absent or `false`
- **THEN** the action bar row is rendered (existing behaviour preserved)

### Requirement: Input component supports hiding the add button
The `Input` component SHALL accept an optional `hideAddButton` boolean prop. When `true`, the attach (+) button and its hidden `<input type="file">` are not rendered inside the component.

#### Scenario: Add button hidden
- **WHEN** `hideAddButton={true}`
- **THEN** the attach (+) button is not rendered inside the `Input` component
- **THEN** the action bar footer actions are right-aligned (no left element to justify against)

#### Scenario: Default add button rendered
- **WHEN** `hideAddButton` is absent or `false`
- **THEN** the attach (+) button is rendered on the left of the action bar (existing behaviour preserved)
