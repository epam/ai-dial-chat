# Proposal: conversation-messages-spec

## What

Add a formal specification and unit test coverage for the `@epam/ai-dial-conversation-messages` library — a React component library that provides `MessageBubble` and `MessageActions` components used to render individual chat messages in the DIAL chat application.

## Why

The library has working implementations for both components but no specification or test files. Without specs:

- There is no authoritative reference for the components' public API contracts, visual variants, and behavior
- `MessageActions` is implemented but not exported from the public entry point (`src/index.ts`)
- Future contributors have no single source of truth for what each component is responsible for, what props it accepts, and what behavior is expected
- Regressions cannot be caught automatically — no tests exist for either component

## Goals

1. Document the public API of `MessageBubble` (props, `BubblePosition` enum, rendering contract)
2. Document the public API of `MessageActions` (props, `MessageSource` type, icon mapping per source variant)
3. Export `MessageActions` and its `MessageSource` type from `src/index.ts`
4. Add unit tests for all observable behaviors of both components
5. Verify that the spec matches the existing implementation in `libs/conversation-messages/src/`

## Non-Goals

- Redesigning the component APIs
- Adding new features to either component
- Changing the visual design or Tailwind classes

## Success Criteria

- A `design.md` that fully describes how both components work
- A `tasks.md` that captures all spec-driven improvements
- Spec files (`MessageBubble.spec.tsx`, `MessageActions.spec.tsx`) exist co-located with the components
- `MessageActions` and `MessageSource` are exported from `src/index.ts`
