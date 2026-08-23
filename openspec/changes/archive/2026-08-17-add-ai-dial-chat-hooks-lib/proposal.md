## Why

External and partner teams building custom chat frontends against the AI DIAL backend currently have no way to reuse our chat UI logic — the only place it lives is inside `apps/chat`, entangled with our Redux-less-but-still-app-specific contexts (`ClientChannelContext`, `GenerationContext`, `OverlayContext`), our `server-api` layer, and our UI-kit components. To reuse anything, an external team must either fork `apps/chat` wholesale or reimplement chat-list behaviors (autoscroll, streaming-safe anchoring, scroll-to-bottom affordance) from scratch — behavior that is easy to get visibly wrong (jumpy scroll during streaming, lost scroll position on a new turn) and that we have already spent real effort tuning (spacer clamping, `ResizeObserver`-driven visibility, anchor tolerances).

We want to start publishing this kind of logic as small, dependency-light, headless React hooks in a new library, `libs/ai-dial-chat-hooks`, so other teams can adopt proven AI DIAL chat behavior without adopting our whole app. This change proposes the library itself plus its first extracted hook, `useConversationScroll`, chosen because it is chat-domain-specific (not a generic utility), already has almost no coupling to app infrastructure, and has a small, stable, self-contained API.

## What Changes

- Create a new publishable library `libs/ai-dial-chat-hooks`, following the existing `libs/chat-shared` package/build/test conventions (Vite lib build, `dist/index.js` + `.d.ts`, Vitest, ESLint flat config, `nx` `publishable` tag).
- Extract `useConversationScroll` from `apps/chat/src/hooks/conversation/useConversationScroll.ts` into `libs/ai-dial-chat-hooks/src/useConversationScroll/useConversationScroll.ts`, generalizing its single app-specific type dependency (`Message` from `@epam/ai-dial-chat-shared`) into a minimal generic constraint so the hook has zero dependencies on any AI DIAL app or library type.
- Re-point `apps/chat`'s existing call site at the new library export instead of the local file, preserving current scroll/anchor behavior exactly (no behavior change for the shipped app).
- Move the existing test coverage (`apps/chat/src/hooks/conversation/tests/useConversationScroll.spec.tsx`) into the new library and adapt it to the generic message shape.
- Publish a library `README.md` documenting the hook's contract and a minimal usage example against a bare message array (no AI DIAL backend or app required to use it).
- **BREAKING**: none — this is a net-new library; the `apps/chat` internal import path changes but its public/user-facing behavior does not.

## Capabilities

### New Capabilities

- `chat-hooks-scroll-anchoring`: A framework-level, headless React hook (`useConversationScroll`) that owns chat message-list autoscroll: anchoring a newly sent/regenerated turn near the top of the viewport, holding scroll position stable while a response streams in, revealing a "scroll to bottom" affordance when the user has scrolled away from the latest content, and returning to the bottom on request. Consumed by wiring its returned refs and callbacks onto a host-owned scrollable message list; carries no knowledge of AI DIAL's backend, Redux-equivalent state, or UI components.

### Modified Capabilities

_(none — no existing spec's requirements change; `apps/chat`'s runtime behavior is preserved, only its internal hook import path moves)_

## Impact

- **New code**: `libs/ai-dial-chat-hooks/` (new Nx project: `package.json`, `tsconfig*.json`, `vite.config.mts`, `eslint.config.mjs`, `src/index.ts`, `src/useConversationScroll/*`, `README.md`).
- **Changed code**: `apps/chat/src/hooks/conversation/useConversationScroll.ts` (deleted, replaced by an import from the new lib), any call sites importing it (e.g. the conversation/message-list container in `apps/chat`), `tsconfig.base.json` (new path alias `@epam/ai-dial-chat-hooks/*`), root `package.json`/workspace config if the lib needs registering the same way other publishable libs are (mirror `chat-shared`).
- **Dependencies**: the new lib depends only on `react` (peer dependency); no Redux, no `@epam/ai-dial-ui-kit`, no `@epam/chat-api-client`, no `@epam/ai-dial-chat-shared` at runtime.
- **No API/backend changes**: this is a frontend-only, library-only change.
- **No user-facing behavior change** in the shipped `apps/chat` product.
