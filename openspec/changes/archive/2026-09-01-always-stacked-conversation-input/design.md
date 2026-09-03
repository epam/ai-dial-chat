## Context

`Input` (`libs/conversation-input/src/components/Input/Input.tsx`) computes

```ts
const isStackedLayout =
  isStacked || message.includes('\n') || isMultiLine || hasTools;
```

and uses it in six places to flip flex ordering and wrapping. `isMultiLine` comes from `useMessageState`, which measures the textarea's `offsetHeight` on mount, stores it as the single-row baseline, and re-compares it in a `useLayoutEffect` on every message change. That hook already carries a guard comment for a real defect the two-layout design creates: switching layouts changes the textarea width, which can re-trigger wrapping and oscillate, so the flag is only allowed to fall back to `false` when the message is empty.

`useMessageState` is internal (not exported from `libs/conversation-input/src/index.ts`), so removing `isMultiLine` is not a public API change. `isStacked` is part of the exported `InputProps` and is therefore a breaking change for external consumers; inside this repo the only caller is `EditMessageInput`.

Constraints: `libs/conversation-input` is a `type:ui` lib (no host knowledge), Tailwind-first with `Input.module.scss` for token overrides, and the project's only named breakpoints are `mobile`/`desktop`. RTL rules mean the row uses logical `ms-auto`, which stays as is.

## Goals / Non-Goals

**Goals:**

- One layout for `Input`: textarea row, then the action row — on every viewport, for every message length, with or without tools and attachments.
- Delete the machinery that only existed to choose between two layouts: `isStacked`, `isMultiLine`, the height baseline, the `useLayoutEffect` comparison, and the `desktop:*` order/wrap overrides.
- Keep every non-layout behaviour byte-identical: send/stop, model selector, voice bar, attachment tray, tools chips, history navigation, paste handling, `hideAddButton`/`hideAttachFile`/`hideActionBar`, focus and caret behaviour on newline insertion.

**Non-Goals:**

- Redesigning spacing, the wrapper's border/shadow, the send-button exit animation, or the attachment tray.
- Changing `max-h-[272px]`, `[field-sizing:content]` textarea growth, or the mobile bottom-sheet flows.
- Touching `EditMessageInput`'s own out-of-box action row.

## Decisions

**Delete `isStacked` rather than default it to `true`.** A prop whose only legal value is `true` is dead surface that invites the branch back. Deleting it makes TypeScript (`strict`, `noUnusedLocals`) point at every leftover call site and unused local, which is the cheapest possible migration signal. Alternative considered: keep `isStacked?: boolean` as a deprecated no-op for one release. Rejected — the lib is versioned with the app, the only in-repo caller is `EditMessageInput`, and a no-op prop that silently ignores `false` is worse for an external caller than a compile error that says exactly what to remove.

**Remove `isMultiLine` from `useMessageState` instead of leaving it unused.** With the branch gone the flag has no consumer, and the measurement is not free: it is a mount-time `offsetHeight` read plus a `useLayoutEffect` on every keystroke, i.e. a forced layout per change. Keeping it "in case" would also keep the oscillation guard and the comment explaining a problem that no longer exists. Alternative considered: keep the hook's return shape and mark the field deprecated. Rejected — the hook is not exported, so nothing outside the lib can observe the shape.

**Keep `hasTools`, drop its layout role.** `hasTools` still decides whether the chips row renders and whether the trailing action group needs its own row position; it no longer participates in choosing a layout. The chips row keeps `flex-1 min-w-0` so long chip lists wrap inside their own row instead of pushing the buttons out.

**Fixed order instead of `order-*` utilities.** Once nothing reorders per breakpoint, the DOM order is the visual order: textarea container, `+` button, chips, trailing actions. Emitting the elements in that order and deleting all `order-*` classes keeps the reading order and the tab order aligned, which the previous `desktop:order-1`/`order-2` swap actively broke (the `+` button rendered before the textarea in the DOM but after it visually on desktop). This is an a11y improvement that falls out of the change; it is the reason to reorder the JSX rather than keep `order-*` classes with fixed values.

**`hideActionBar` renders the textarea unconditionally.** Today it renders `isStackedLayout && textarea`, so a caller that sets `hideActionBar` without `isStacked` gets an empty box until the message wraps. No caller does that (`EditMessageInput` sets both), so this is a latent bug being removed, not a behaviour change to any existing usage.

**Wrapper drops `min-h-[64px]`.** The floor existed to hold the collapsed single-row box open. The stacked box is taller than it by construction (≈100 px: 24 px padding + ~24 px textarea + 12 px gap + 40 px action row), so the declaration can never take effect — and a min-height that is always smaller than the content is exactly the kind of stale rule a future padding or control-size change turns into a silent contradiction. The wrapper height becomes content-driven. Alternative considered: keep it as an inert safety floor. Rejected — an inert rule is indistinguishable from an intentional one to the next reader, and there is no scenario in which the stacked box renders shorter than its own padding plus a 40 px action row.

## Risks / Trade-offs

- **The collapsed input is taller, so the message list gets ~36 px less height on every screen** → this is the intended design change, not a regression; verify the chat view and the overlay at a mobile viewport so nothing that positions against the input's height (scroll-to-bottom button, drag-and-drop overlay) overlaps.
- **Tests asserting the inline layout (class names, ordering) fail** → those assertions encode the removed behaviour; rewrite them as the always-stacked assertion rather than patching them to pass. Prefer role/structure queries over class assertions so the replacements do not re-freeze Tailwind strings.
- **An external consumer passes `isStacked`** → compile error with an obvious fix; call it out in the change's release notes.
- **Removing the layout `useLayoutEffect` changes nothing observable but is easy to over-trim** → keep the `messageProp`/`messageRevision` resync effect exactly as is; only the height-measurement effect and its ref go.

## Migration Plan

Single slice, no flag: remove the branch and the prop, update `EditMessageInput`, update the three affected specs and the lib README if it documents `isStacked`, then run `npm run verify:changed`. Rollback is a revert of one commit — there is no persisted state, stored preference, or server contract involved.

## Open Questions

None.
