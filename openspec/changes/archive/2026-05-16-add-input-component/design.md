## Context

`libs/conversation-input` is a public UI library exposing the `ConversationInput` component. That component bundles a textarea, send button, and optional welcome-text overlay into one unit. A simpler primitive was needed — a textarea + send button with no welcome-text logic — so that consumers (e.g. `apps/chat`) can embed just the input field. This change introduces `Input` as a peer component in the same library.

The implementation is complete on branch `feat/input`. This document records the design decisions made during that implementation.

## Goals / Non-Goals

**Goals:**

- Provide a standalone, composable `Input` primitive in `libs/conversation-input`
- Support runtime theming via `colors` and `typography` props mapped to CSS custom variables
- Keep internal message state inside the component; expose `onSend` / `onChange` callbacks for the caller
- Send button appears only when the trimmed message is non-empty
- Enter submits; Shift+Enter inserts a newline

**Non-Goals:**

- Replacing or modifying `ConversationInput`
- Adding welcome-text rendering to `Input`
- Connecting `Input` to any React Context or global state
- i18n — `placeholder` is a prop; no user-facing string is hardcoded

## Decisions

### 1. Internal state, not controlled

`Input` owns `message` state via `useState(initialMessage)`. Callers receive values through `onSend` and `onChange` callbacks.

**Why over fully controlled (`value` + `onChange` only):** Most consumers in this app are fire-and-forget chat prompts; they want to send a message and get a blank field back without managing state themselves. Internal state enables `setMessage('')` on send without requiring the parent to wire a reset.

**Alternative considered:** Fully controlled (no internal state). Rejected because every consumer would need to track and reset the message value — more boilerplate for no benefit in the common case.

### 2. CSS custom variables (`--ci-*`) for theming, not prop drilling into child

`Input.module.scss` reads `--ci-bg`, `--ci-text`, `--ci-border`, etc., set on the wrapper `div`. 
**Why:** CSS variables cascade naturally — child elements inherit them without any extra prop interface. This avoids threading `colors.sendBackground` down into `SendButton`.

**Alternative considered:** Pass color props explicitly to `SendButton`. Rejected — `SendButton` would need its own props interface and `Input` would become coupled to `SendButton`'s theming shape.

### 3. `SendButton` as a co-located sub-component, not exported

`SendButton` lives in `libs/conversation-input/src/components/Input/SendButton.tsx` and is not re-exported from `index.ts`.

**Why:** It has no standalone use case outside of `Input`. Exporting it would expand the public API surface unnecessarily.

### 4. SCSS module for component-specific styles, Tailwind for layout

Layout (flex, gap, padding, rounded, border) uses Tailwind utility classes. Visual state (hover, focus ring, placeholder color, CSS variable reads) lives in `Input.module.scss` because Tailwind cannot read arbitrary CSS variables at runtime.

**Why:** Consistent with `openspec/lib-styling-guide.md` — Tailwind handles structure, SCSS handles dynamic variable-driven visuals.

### 5. `mergeClasses` (from `@epam/ai-dial-chat-shared`) for class composition

Used instead of `clsx` because `mergeClasses` is already the shared utility in this library.

**Note:** The design rule prefers `clsx`; `mergeClasses` is the current library convention. If `mergeClasses` is a thin wrapper around `clsx` semantics, no change is needed. If it is not, a follow-up to align with `clsx` may be warranted.

## Risks / Trade-offs

- **Fixed dimensions (`w-[748px]`, `h-[56px]`)** → The wrapper uses fixed pixel values rather than responsive units. On narrow viewports the input may overflow. Mitigation: a follow-up task can replace with `w-full max-w-[748px]` and `min-h-[56px]`.
- **No `aria-label` on textarea** → The textarea relies on `placeholder` for labelling, which is not sufficient for screen readers when the field is empty. Mitigation: add `aria-label` prop or a visually-hidden `<label>` in a follow-up.
- **`initialMessage` is not reactive** → Changes to `initialMessage` after mount are ignored (standard React uncontrolled pattern). Callers must not expect re-initialization. Mitigation: document this in the spec and prop JSDoc.
- **`placeholder` default is English-only** → `"Type a message..."` is hardcoded as the default. Callers must pass a translated string. Mitigation: callers using `react-i18next` should always pass a translated `placeholder`; no i18n key exists inside the component itself.
