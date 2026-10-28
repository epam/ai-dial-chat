## ADDED Requirements

### Requirement: The toast stack is anchored to the bottom-end corner on desktop

The app-level toast stack rendered by `NotificationContainer` (`apps/chat/src/components/Notification/NotificationContainer.tsx`) SHALL be the only placement owner for every notification queued through `useNotification()` (`apps/chat/src/context/NotificationContext.tsx`), whatever its variant (`Info`, `Success`, `Warning`, `Error`, `Loading`). Call sites SHALL NOT add placement of their own.

From the `desktop` breakpoint (`tools/tailwind/theme.css`) up, the stack SHALL be fixed to the **bottom-end** corner of the viewport, with each toast aligned to the inline-end edge. The anchor SHALL use logical inset utilities only (releasing the inline-start inset at `desktop`, with `items-end`), never physical `right-*` / `left-*`, so the corner is bottom-right in LTR and bottom-left in RTL. On desktop the stack SHALL have a definite width (at most 600px and never wider than the viewport minus its gutters) rather than shrink-to-fit, so each entry's percentage max-width resolves against a fixed box.

Placement SHALL be pure CSS through the `desktop:` variant. The container SHALL NOT branch in JS on `useBreakpoint` / `useIsMobile` or read `window.innerWidth`.

State ownership is unchanged: the queue stays in `NotificationProvider`. This requirement adds no context, hook, or memoisation requirement beyond the existing `memo(NotificationContainer)` and memoised `NotificationEntry`.

**Feature flag:** none — always active.
**i18n:** none — no new user-visible strings.
**Telemetry:** none.

#### Scenario: Desktop LTR toast appears bottom-right

- **WHEN** the viewport is at or above the `desktop` breakpoint, the document is `dir="ltr"`, and any caller invokes `showSuccessNotification`
- **THEN** the toast renders fixed in the bottom-right corner, aligned to the right edge of the stack

#### Scenario: Desktop RTL toast appears bottom-left

- **WHEN** the viewport is at or above the `desktop` breakpoint and the document is `dir="rtl"` (for example Arabic)
- **THEN** the same toast renders in the bottom-left corner, without any `rtl:`-specific class, because the anchor is the logical inline end

#### Scenario: Every variant shares the placement

- **WHEN** an `Error`, `Warning`, `Info` and `Loading` notification are raised in turn
- **THEN** all of them render in the same bottom-end stack

### Requirement: On phones the stack spans the bottom edge

Below the `desktop` breakpoint, the stack SHALL be fixed to the bottom edge and span the viewport width minus a 16px side gutter (`px-4`), and each toast SHALL take the full stack width (`w-full`), so a short message is not shown as a narrow pill. A toast SHALL NOT be wider than the viewport; the existing `max-w-[min(600px,100%)]` cap on each entry stays. The bottom offset SHALL include `env(safe-area-inset-bottom)` so a toast never sits under the iOS home indicator.

#### Scenario: Phone toast fills the width above the bottom edge

- **WHEN** the viewport is narrower than the `desktop` breakpoint and a notification is raised
- **THEN** the toast renders at the bottom of the screen, spanning the width inset 16px from both side edges, above the device safe-area inset, with no horizontal page scroll

### Requirement: Stacking order, overflow and click-through

Toasts SHALL render in arrival order, so the newest toast is last in the DOM and nearest the bottom edge, and older toasts are pushed upward. The stack SHALL cap its height to the viewport minus its vertical offsets (`max-h-[calc(100dvh-3rem)]` or equivalent) and scroll vertically past that. Because a scroll container starts at its top, an overflowing bottom-anchored stack would otherwise hide the newest toast below the fold, so whenever a notification is added the container SHALL scroll to its end, which brings the newest toast into view. Dismissing a toast SHALL NOT force a scroll. The container SHALL keep `pointer-events-none`, with `pointer-events-auto` only on each toast, so the gaps between and around toasts stay click-through.

Accessibility is unchanged and SHALL be preserved: each toast keeps the kit `Notification` live-region role (`alert` for error/warning, `status` otherwise), its close button, and keyboard reachability. DOM order (oldest → newest) is also the reading and tab order.

#### Scenario: Newest toast sits nearest the bottom edge

- **WHEN** three notifications are raised one after another
- **THEN** they are rendered oldest-to-newest in DOM order, with the newest closest to the bottom of the viewport

#### Scenario: Many toasts scroll instead of overflowing

- **WHEN** enough manually-dismissed notifications (with `requestId` or `action`) accumulate to exceed the viewport height
- **THEN** the stack stays within the viewport and becomes vertically scrollable, every toast's close button remains reachable, and the newest toast is scrolled into view, not hidden below the visible area

#### Scenario: Empty space stays click-through

- **WHEN** a toast is visible and the user clicks a control on the page beside or above it, outside the toast's own box
- **THEN** the click reaches that control

### Requirement: Toasts draw above the bottom-end transfer queues

The stack SHALL keep `z-70`, above the `TransferQueue` wrappers (`z-51`, `fixed inset-e-4 bottom-4`) in `apps/chat/src/components/ConversationPanel/ConversationPanelView.tsx` and `libs/chat-shared/src/file-manager/DialFileManagerShell/DialFileManagerShell.tsx`, and above the kit's portalled popups, dropdowns and tooltips. A visible toast MAY cover a transfer queue. Neither surface SHALL measure or offset the other.

#### Scenario: Export success toast over the export queue

- **WHEN** an export finishes while the export `TransferQueue` is open and the `Success` toast appears
- **THEN** the toast draws on top of the queue, and once the toast auto-dismisses after 5s or is closed, the queue is fully visible and interactive again
