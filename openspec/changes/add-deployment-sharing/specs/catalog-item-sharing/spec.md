## ADDED Requirements

### Requirement: libs/share library
A new Nx library `libs/share` (tag `type:ui`) SHALL contain `SharePopover`, `QrCode`, share types (`ShareLinkAccess`, `SharePopoverView`, `ShareLinkData`), and SCSS for the popover. It SHALL be host-agnostic: no imports from `apps/*`, server-api wrappers, generated API clients, i18n config, app contexts, or environment variables.

Allowed imports: `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-catalog`, `@tabler/icons-react`, `react-qr-code`, React, CSS Modules.

`index.ts` SHALL export: `SharePopover`, `QrCode`, `ShareLinkAccess`, `SharePopoverView`, `ShareLinkData`.

RTL impact: all internal spacing uses logical Tailwind classes (`ms-*`, `me-*`, `ps-*`, `pe-*`). Directional icons (chevron) use `rtl:scale-x-[-1]`.

Feature flag: none.

#### Scenario: Library builds cleanly
- **WHEN** `npm exec nx build @epam/ai-dial-share` is run
- **THEN** the build succeeds with no type errors

#### Scenario: Module boundary enforced
- **WHEN** ESLint runs with `@nx/enforce-module-boundaries`
- **THEN** no import from `libs/share` into any `apps/*` server-api path or vice-versa is flagged

### Requirement: SharePopover accepts flat data props
`SharePopover` in `libs/share` SHALL declare the following props interface and receive all runtime data from the host — no internal API calls or hook calls:

```ts
interface SharePopoverProps {
  /** Resolved share URL; undefined while loading */
  url: string | undefined;
  isLoading: boolean;
  error: Error | null;
  /** Number of days the link is active; undefined while loading */
  expiresInDays: number | undefined;
  /** Current access level */
  access: ShareLinkAccess;
  /** True for editable entity types (Agent, Application, Skill, Toolset); false for Model */
  canEditAccess: boolean;
  /** Called when the user changes the access level */
  onAccessChange: (access: ShareLinkAccess) => void;
  /** Called when the popover should close */
  onClose: () => void;
}
```

#### Scenario: SharePopover renders with resolved data
- **WHEN** `SharePopover` receives `url`, `expiresInDays`, and `access` with `isLoading: false` and `error: null`
- **THEN** the URL appears in the link input and the expiry note is visible

#### Scenario: SharePopover renders loading state
- **WHEN** `SharePopover` receives `isLoading: true` and `url: undefined`
- **THEN** skeleton loaders are visible and the Copy button is disabled

#### Scenario: SharePopover renders error state
- **WHEN** `SharePopover` receives `error` set to a non-null Error
- **THEN** the error title is shown and the Copy button is disabled

### Requirement: Share popover opens from catalog detail header
The catalog detail header SHALL render a Share button only for items the current user owns (`item.isMyApp === true`) of a shareable entity type (i.e. not Guardrail or Mcp). When a `shareOverlay` render-prop is provided by the host, clicking Share SHALL open a popover anchored to the button instead of calling `onShare`.

i18n key: `share.title` ("Share")

RTL impact: the popover is anchored via `DialDropdown` with `placement="bottom-end"`; end-alignment respects writing direction automatically.

#### Scenario: Share button present for owned, shareable entity types
- **WHEN** the detail header renders an item with `isMyApp: true` and type Agent, Application, Skill, Toolset, or Model
- **THEN** a Share button is visible

#### Scenario: Share button hidden for Guardrail and MCP
- **WHEN** the detail header renders an item with type Guardrail or Mcp
- **THEN** no Share button is rendered, regardless of `isMyApp`

#### Scenario: Share button hidden for items not owned by the current user
- **WHEN** the detail header renders an item with `isMyApp` `false` or unset, of an otherwise shareable type
- **THEN** no Share button is rendered

#### Scenario: Share popover opens on button click
- **WHEN** the user clicks Share and `shareOverlay` is provided
- **THEN** the popover renders the content returned by `shareOverlay(item, onClose)` and `onShare` is NOT called

#### Scenario: Share popover closes via onClose callback
- **WHEN** the `onClose` callback passed to `shareOverlay` is called
- **THEN** the popover unmounts

#### Scenario: Share button toggles popover closed on second click
- **WHEN** the popover is open and the user clicks the Share button again
- **THEN** the popover closes

### Requirement: SharePopoverContainer wires the hook to the lib
`apps/chat/src/components/SharePopoverContainer/SharePopoverContainer.tsx` SHALL be the only component that calls `useShareLink`. It SHALL derive `canEditAccess` from `item.type`, then render `<SharePopover>` from `@epam/ai-dial-share` with all flat props.

`CatalogView`'s `shareOverlay` SHALL render `<SharePopoverContainer item={item} onClose={onClose} />`.

#### Scenario: Container wires useShareLink to SharePopover
- **WHEN** `SharePopoverContainer` mounts with a given item
- **THEN** it calls `useShareLink(item.id)` and passes `url`, `isLoading`, `error`, `expiresInDays`, `access`, `canEditAccess`, and `onAccessChange` to `SharePopover`

#### Scenario: canEditAccess is false for Model
- **WHEN** `SharePopoverContainer` receives an item with type Model
- **THEN** `canEditAccess` passed to `SharePopover` is `false`

#### Scenario: canEditAccess is true for Application
- **WHEN** `SharePopoverContainer` receives an item with type Application
- **THEN** `canEditAccess` passed to `SharePopover` is `true`

### Requirement: Share popover link view
The `SharePopover` component SHALL display a link view showing the share URL in a read-only input with a Copy button, an access-level control, a visibility note, and a link expiry note.

i18n keys (passed by the host via the translated string props, OR used directly inside the lib via `useTranslation` if the lib bundles its own i18n namespace):
- `share.linkLabel` — label above the URL field
- `share.copyButtonLabel` — "Copy"
- `share.copiedButtonLabel` — "Copied"
- `share.linkAriaLabel` — accessible label for the URL input
- `share.anyoneWithLinkTitle` — "Anyone with the link"
- `share.anyoneWithLinkSubtitle` — "in your organization"
- `share.accessAriaLabel` — aria-label for the access selector
- `share.visibilityNote` — "This deployment and its updates will be visible to users with the link." (shown when access is View)
- `share.visibilityNoteEdit` — "Anyone with the link will be able to view and edit this deployment." (shown when access is Edit)
- `share.expiryNote` — "This link is active for {{days}} days."
- `share.loadingLabel` — shown while loading
- `share.errorTitle` — shown on error

#### Scenario: Share link displayed after load
- **WHEN** `url` and `expiresInDays` are set with `isLoading: false`
- **THEN** the URL is shown in a read-only input and the expiry note reads "This link is active for N days."

#### Scenario: Copy button copies URL to clipboard
- **WHEN** the user clicks Copy
- **THEN** the URL is written to the clipboard, the button label changes to "Copied" with an `aria-live="polite"` announcement, and it reverts after the copy state resets

### Requirement: Access-level selector for editable entity types
When `canEditAccess` is `true`, `SharePopover` SHALL show a dropdown to switch between "Can view" and "Can edit". When `canEditAccess` is `false`, a static label showing "Can view" SHALL be shown with no dropdown.

i18n keys: `share.accessViewLabel` ("Can view"), `share.accessEditLabel` ("Can edit")

Accessibility: trigger button has `aria-haspopup="true"` and `aria-expanded` reflecting open state; menu items use `role="menuitemradio"` with `aria-checked`; arrow keys cycle between options; Escape closes the menu and returns focus to the trigger.

#### Scenario: Editable access dropdown shown when canEditAccess is true
- **WHEN** `canEditAccess` is `true`
- **THEN** an interactive dropdown trigger is rendered showing the current access level with a chevron

#### Scenario: Static view label shown when canEditAccess is false
- **WHEN** `canEditAccess` is `false`
- **THEN** a non-interactive label reading "Can view" is shown with no chevron

#### Scenario: Selecting "Can edit" calls onAccessChange
- **WHEN** the user selects "Can edit" from the access dropdown
- **THEN** `onAccessChange(ShareLinkAccess.Edit)` is called

#### Scenario: Arrow-key navigation in access menu
- **WHEN** the access menu is open and the user presses ArrowDown or ArrowUp
- **THEN** focus moves between the two menu items cyclically

#### Scenario: Escape in access menu closes menu without closing popover
- **WHEN** the access menu is open and the user presses Escape
- **THEN** the menu closes and focus returns to the trigger; the popover remains open

### Requirement: QR view swap
`SharePopover` SHALL have a QR tab button. Clicking it replaces the link body with a `QrCode` component rendering a scannable QR code that encodes the share URL. A back-to-link button returns to the link view.

i18n keys: `share.qrButtonLabel` ("QR"), `share.linkButtonLabel` ("Link"), `share.qrCodeAriaLabel` — aria-label on the QR code

#### Scenario: QR tab opens QR view
- **WHEN** the user clicks the QR button
- **THEN** the link body is replaced by a QR code encoding the share URL and the back-to-link button becomes the active tab

#### Scenario: Escape in QR view returns to link view
- **WHEN** the popover is in QR view and the user presses Escape
- **THEN** the view returns to Link; a second Escape closes the popover

#### Scenario: Access section visible in QR view
- **WHEN** the QR view is active
- **THEN** the access-level control remains visible

### Requirement: Keyboard focus management in the share popover
`SharePopover` SHALL trap Tab within its visible controls. Focus SHALL move into the popover on open. Switching view tabs SHALL move focus to the newly-active tab button.

#### Scenario: Focus moves into popover on open
- **WHEN** the Share popover opens
- **THEN** the popover container receives focus

#### Scenario: Tab cycles within popover
- **WHEN** focus is on the last focusable control and the user presses Tab
- **THEN** focus wraps to the first focusable control

#### Scenario: Shift+Tab cycles backwards
- **WHEN** focus is on the first focusable control and the user presses Shift+Tab
- **THEN** focus wraps to the last focusable control

### Requirement: useShareLink hook
`apps/chat/src/hooks/useShareLink/useShareLink.ts` SHALL fetch share-link data for a given `itemId` via the `getShareLink` seam, expose `url`, `isLoading`, `error`, `expiresInDays`, `access` state, and provide a stable `setAccess` callback for optimistic access-level updates.

Memoisation: `setAccess` wrapped in `useCallback`; `data` state updated immutably.

#### Scenario: Fetch on mount
- **WHEN** `useShareLink` mounts with an `itemId`
- **THEN** `isLoading` is `true` until `getShareLink` resolves, then `data` is set and `isLoading` becomes `false`

#### Scenario: Error state on fetch failure
- **WHEN** `getShareLink` rejects
- **THEN** `error` is set and `isLoading` becomes `false`

#### Scenario: Refetch on itemId change
- **WHEN** `itemId` prop changes
- **THEN** a new fetch is triggered and the previous result is cleared

#### Scenario: setAccess updates data immutably
- **WHEN** `setAccess(ShareLinkAccess.Edit)` is called with data loaded
- **THEN** `data.access` updates to `Edit` without re-fetching

#### Scenario: No setState after unmount
- **WHEN** the component unmounts before `getShareLink` resolves
- **THEN** no state update is attempted (cancelled flag pattern)
