## Strategy

Vertical slices, completed from the app-side data contract through isolated
library integration and final behavior.

## 1. Monthly usage data

- [x] Add the monthly deployment-limits mapper and focused tests under
  `apps/chat/src/utils/`.
- [x] Add `useDeploymentUsageLimits` and tests under `apps/chat/src/hooks/`,
  including refresh, error, and stale-request behavior.

## 2. Conversation Input slot

- [x] Add the optional `usageLimitsSlot` contract to
  `libs/conversation-input/src/models/`.
- [x] Render the slot in `libs/conversation-input/src/components/Input/Input.tsx`
  and cover provided/omitted behavior.
- [x] Verify that the library contains no app, API, deployment, or i18n
  knowledge.

## 3. Usage control and integration

- [x] Add `UsageLimitsControl` with the monthly trigger, 90% threshold,
  unlimited state, accessible popover, one `DialProgressBar`, and silent
  refresh.
- [x] Integrate the control in `NewConversationComposer` and
  `ConversationView`.
- [x] Add app-owned i18n strings and component tests for finite, unlimited,
  error, keyboard, focus, and RTL behavior.

## 4. Documentation and verification

- [x] Update `docs/technical-requirements.md`.
- [x] Run targeted tests, lint, typecheck, and formatting checks for
  `@epam/chat` and `@epam/ai-dial-conversation-input`.
