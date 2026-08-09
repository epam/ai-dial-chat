# Proposal: conversation-input-spec

## What

Add a formal specification for the `@epam/ai-dial-conversation-input` library — a React component that provides the chat message input interface for the chat application. The specification covers the component's public API, behavior contract, styling, and testing expectations.

## Why

The library currently has a working implementation and unit tests, but no specification document to serve as the authoritative reference for:

- What the component is responsible for and what it is not
- The contract of its public props interface
- Interaction behaviors (send on Enter, newline on Shift+Enter, empty message guard)
- Welcome text display logic
- Integration points with `@epam/ai-dial-ui-kit`

Without a spec, future changes risk drifting from the intended behavior, and contributors lack a single source of truth to validate against.

## Goals

1. Document the component's public props interface with types, defaults, and invariants
2. Define the interaction behavior contract (keyboard shortcuts, send guards, state management)
3. Describe the welcome text visibility logic
4. Specify the styling approach (Tailwind CSS + ai-dial-ui-kit tokens)
5. Define the testing strategy and coverage expectations

## Non-Goals

- Redesigning the component API
- Adding new features to the component
- Changing the underlying `Textarea` integration

## Success Criteria

- A `design.md` that fully describes how the component works
- A `tasks.md` that captures any spec-driven improvements (e.g., missing test coverage, undocumented behavior)
- The spec is accurate against the current implementation in `libs/conversation-input/src/components/ConversationInput/ConversationInput.tsx`
