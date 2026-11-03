## MODIFIED Requirements

### Requirement: Host-owned `apps/chat/src/utils/` files are unaffected

`conversation-id-match.ts`, `conversation-stream-transport.ts`, `entity-notification.ts`, `favorites.ts`, `icon-path.ts`, `local-storage.ts`, `apply-theme-colors.ts`, `scheduled-task-form-validation.ts`, `signin-interrupt.ts`, `toolsets.ts`, and `attachment-network-error-notification.tsx` SHALL NOT be modified by this change, since each either touches host-owned integration state directly or has its translated output as its entire purpose with nothing left to extract. `map-deployment-limits-to-catalog.ts`, `map-usage-data-to-dashboard.ts`, and `map-user-usage-to-model-limits.ts` are not host-owned: they live in `libs/chat-hooks/src/catalog/map-deployment-limits-to-catalog.ts` and `libs/chat-hooks/src/usage/` (under the `AGENTS.md` fourth library-isolation exception) and are exported from `@epam/ai-dial-chat-hooks`. `apps/chat/src/utils/map-scheduled-task-dto.ts` and `apps/chat/src/utils/map-scheduled-task-run-dto.ts` SHALL remain in the app only as translated adapters over `libs/chat-hooks/src/scheduled-task/scheduled-task-display.ts` (see `chat-hooks-scheduled-task-display`): they build formatter objects from `t()` and `ScheduledTasksI18nKeys`, map the lib's delete-error kind to a key, and supply the app's `conversationIdsMatch`, while every DTO-driven rule lives in the lib.

#### Scenario: No host-owned file is imported by `@epam/ai-dial-chat-hooks`
- **WHEN** `libs/chat-hooks/src/**` is inspected
- **THEN** it contains no import of any of the listed host-owned files, nor of `apps/chat/src/utils/map-scheduled-task-dto.ts` or `apps/chat/src/utils/map-scheduled-task-run-dto.ts`

#### Scenario: The scheduled-task adapters hold no DTO-driven rule
- **WHEN** `apps/chat/src/utils/map-scheduled-task-dto.ts` and `apps/chat/src/utils/map-scheduled-task-run-dto.ts` are inspected
- **THEN** neither switches on a trigger description kind, maps an upstream run status, splits a duration into units, compares calendar days, or classifies an HTTP status — each delegates to an export of `@epam/ai-dial-chat-hooks`
