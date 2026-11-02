## Context

All toasts reach the screen through one portal: `NotificationContainer` (`apps/chat/src/components/Notification/NotificationContainer.tsx`). It is mounted once, above `Routes`, in `apps/chat/src/AppRoot.tsx`. Today its root is:

```
pointer-events-none fixed inset-x-0 top-6 z-70 flex max-h-[calc(100dvh-3rem)]
flex-col items-center gap-2 overflow-y-auto px-4
```

Each `NotificationEntry` renders the kit `Notification` with `pointer-events-auto max-w-[min(600px,100%)]`. The kit's `Notification` ships no positioning or enter/exit animation of its own (checked in `node_modules/@epam/ai-dial-ui-kit/dist/index.css`), so the container classes are the whole placement.

Other fixed bottom-end surfaces exist: the `TransferQueue` wrappers (`fixed inset-e-4 bottom-4 z-51`) in `ConversationPanelView.tsx` and `libs/chat-shared/.../DialFileManagerShell.tsx`. The requester accepted that toasts cover them.

## Goals / Non-Goals

**Goals:** bottom-end corner on desktop, full-width bottom on phones, RTL mirroring for free, newest toast always visible, unchanged click-through/a11y.

**Non-Goals:** inline `Notification` banners; enter/exit animation; avoiding the overlap with `TransferQueue`; on-screen-keyboard avoidance; changing `NotificationContext`, timing, or content.

## Decisions

1. **Mobile-first CSS, one class string, no JS breakpoint.** The target root is approximately:

   ```
   pointer-events-none fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom))]
   z-70 flex max-h-[calc(100dvh-3rem)] flex-col items-center gap-2 overflow-y-auto px-4
   desktop:inset-s-auto desktop:w-[min(600px,calc(100vw-3rem))] desktop:items-end desktop:px-0 desktop:me-6
   ```

   and each entry gets `w-full desktop:w-auto` next to its existing `max-w-[min(600px,100%)]`.
   - On phones, `inset-x-0 px-4` plus `w-full` entries span the width with a 16px gutter, which keeps today's "never wider than the screen" guarantee. `env(safe-area-inset-bottom)` clears the iOS home indicator.
   - On desktop, `inset-s-auto` releases the start edge, and the container gets a **definite** width so each entry's `max-w-[…100%]` resolves against a fixed box, not a shrink-to-fit one (where a percentage would be cyclic). `items-end` aligns narrower toasts to the end edge.
   - The exact gutters are a visual detail to confirm in the browser, and the spec does not fix them. *Alternative:* `useIsMobile` + two class sets, rejected because AGENTS.md reserves JS branching for cases CSS cannot express.
   - Verify that Tailwind v4 generates `inset-s-auto` (the repo already uses `inset-e-4`/`inset-s-3`). If it does not, use `desktop:start-auto`.
2. **Logical anchor only.** Inline-start/end insets, `me-*` and `items-end` follow `dir`, so RTL gets bottom-left with no `rtl:` class (`.claude/rules/rtl.md`).
3. **Keep DOM order oldest → newest, and scroll to the end on add.** In a bottom-anchored column, the last child sits nearest the edge, which is the conventional "newest at the corner". A scroll container still opens at `scrollTop = 0`, though, so once the stack overflows `max-h`, the newest toast would sit below the fold. The container therefore keeps a ref and, in an effect keyed on `notifications.length` growing (tracked by a previous-length ref), sets `scrollTop = scrollHeight`. Dismissals do not scroll. *Alternatives:* `flex-col-reverse` with a reversed array, rejected because it inverts reading/tab order for screen-reader users; `justify-content: flex-end`, rejected because it does not change where an overflowing scroll box starts.
4. **Keep `z-70`; accept overlap with `TransferQueue` (z-51).** This was decided with the requester. Toasts are transient, and the action/request-ID ones are closable.

## Risks / Trade-offs

- [On phones, bottom toasts cover the message composer for up to 5s] → toasts stay closable and empty space is click-through. If this proves annoying, a follow-up can offset the stack by the composer height.
- [iOS Safari with the on-screen keyboard open: a `position: fixed; bottom` element stays on the layout viewport, so a toast raised while typing (e.g. "File too large" on paste) can render behind the keyboard. The old top position did not have this problem.] → accepted for this change. It is visible again as soon as the keyboard closes, and error toasts stay on screen for 5s or until closed. Follow-up if needed: offset by `window.visualViewport` (which needs JS, so it is kept out of this change).
- [A toast covers the TransferQueue row that triggered it, including a sticky `requestId` error over the cancel buttons] → accepted by the requester. Close the toast to reach the queue. Revisit (stack above the queue, or move the queue) if users report it.
- [Scroll-to-end can pull the user away from an older toast they were reading in an overflowing stack] → this only happens when a new toast arrives, which is the moment the user should see it.

## Migration Plan

This is a single-file style + small effect change, with no data or API impact. Ship it directly. To roll back, revert the commit.

## Open Questions

None. The overlap and mobile layout were resolved with the requester before the proposal.
