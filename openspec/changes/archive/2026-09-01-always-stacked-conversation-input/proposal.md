## Why

The conversation input currently has two layouts: a compact single-row layout (placeholder, `+`, model selector, and send all on one line) and a stacked two-row layout (textarea on its own row above the action bar). The input silently switches between them by measuring the textarea's rendered height, so the box jumps as soon as the user's text wraps, tools appear, or the viewport crosses the `desktop` breakpoint. The design now calls for the two-row layout unconditionally, which also removes the measurement loop and the ordering/wrapping class matrix that exist only to support the collapsed variant.

## What Changes

- The `Input` component always renders the textarea on its own full-width row above the action bar. The compact single-row layout is removed — there is no state, prop, viewport, or content that produces it.
- **BREAKING** The `isStacked` prop is removed from `InputProps`. It was an opt-in for behaviour that is now the only behaviour; callers (`EditMessageInput`) drop it.
- The `isMultiLine` measurement is removed from `useMessageState`: the hook no longer records a single-row height, no longer runs the `useLayoutEffect` that compares heights, and no longer returns `isMultiLine`. `UseMessageStateResult` loses that field.
- `isStackedLayout` and every class it gated go away from `Input.tsx`: `desktop:flex-nowrap`, `desktop:order-1`/`desktop:order-2`, `desktop:w-auto desktop:flex-1`, `desktop:ms-0`, and the conditional `order-3`/`order-4` on the trailing action group. The remaining order is fixed: textarea row, then `+` / tools chips / trailing actions.
- With `hideActionBar`, the textarea renders unconditionally (previously it rendered only when the stacked layout happened to be active).
- The wrapper drops its `min-h-[64px]` floor. It existed to hold the collapsed single-row box open; the stacked box is taller than 64 px by construction, so the floor is dead weight that can only ever contradict the real content height.
- Tools chips no longer influence layout selection — `hasTools` keeps its meaning only for deciding whether the chips row renders.

## Capabilities

### New Capabilities

None. The layout contract already lives in `conversation-input-attachments`.

### Modified Capabilities

- `conversation-input-attachments`: replaces the "Action bar stays inline when attachments are present" requirement with an always-stacked layout requirement, and removes `isStacked` from the documented `Input` API.
- `keyboard-shortcut-preference`: the focus/cursor-retention requirement is restated without the single-line-to-stacked transition framing; focus and caret guarantees stay unchanged.
- `voice-recording-ui`: the canvas-height requirement's rationale no longer refers to fitting "the single-row layout"; the `h-8` mobile / `h-6` desktop values stay unchanged.

## Impact

- `libs/conversation-input/src/components/Input/Input.tsx` — layout branching removed.
- `libs/conversation-input/src/models/Input.ts` — `isStacked` prop deleted.
- `libs/conversation-input/src/hooks/useMessageState.ts` — height measurement and `isMultiLine` deleted.
- `libs/conversation-input/src/components/EditMessageInput/EditMessageInput.tsx` — stops passing `isStacked`.
- Tests: `libs/conversation-input/src/components/Input/tests/*`, `hooks/tests/*`, `EditMessageInput/tests/*`.
- Visual: the collapsed input grows from 64 px to roughly 100 px because the action bar now always sits on its own row, and its height is content-driven rather than floored; no host-side layout code depends on the old height.
- No API, backend, dependency, or i18n changes. `@epam/ai-dial-conversation-input` consumers passing `isStacked` get a type error and must delete the prop.
