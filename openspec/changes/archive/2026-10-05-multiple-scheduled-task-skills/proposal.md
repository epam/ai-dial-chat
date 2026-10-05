## Why

Scheduled tasks currently expose one skill despite the completion wire format already supporting an array. Users need several existing skills in one task.

## What Changes

- Replace scheduled-task `skillUrl` with `skillUrls` everywhere (BREAKING, coordinated host/API upgrade).
- Replace the single-value skill field with the UI kit's `Select` multiple variant, with every host-supplied skill as a checkbox option and built-in removable tags.
- Round-trip every reference through `custom_content.skills[]`.

## Capabilities

### New Capabilities
- `scheduled-task-multiple-skills`: Array configuration, selection, and hydration for tasks.

### Modified Capabilities

- `scheduled-task-create-form`: Replace single scheduled-task skill configuration and display contracts with arrays.
- `scheduled-task-detail-page`: Replace single scheduled-task skill configuration and display contracts with arrays.
- `scheduled-tasks-api`: Replace single scheduled-task skill configuration and display contracts with arrays.
- `scheduled-tasks-reuse-contract`: Replace single scheduled-task skill configuration and display contracts with arrays.
- `skill-input-attachment`: Replace the reusable selector's single-value favorites/catalog contract with an array-only UI-kit Select contract.

## Impact

Libraries skills, scheduled-tasks, chat-hooks and generated API client; chat app and BFF. Catalog/transport/i18n stay in app adapters. Follow `apps/chat-api/src/scheduled-tasks/scheduled-tasks.mapper.ts:151` and `apps/chat/src/components/ScheduledTaskSkillField/ScheduledTaskSkillField.tsx`.

### Problem and Solution
Replace the single-reference bottleneck with ordered deduplicated arrays. Use the UI kit's multiple `Select` with a flat checkbox list of all skills instead of favorites and a Browse catalog.

### Non-goals
Ordinary attachments, live-chat behavior changes, execution worker changes, reordering, selection limits.

### Acceptance criteria
Multiple references survive create/edit/detail; empty arrays clear, omitted PUT arrays preserve; existing saved single-skill tasks hydrate; unsupported models block saving; mobile and RTL selection/removal work.

### Compatibility and rollback
User explicitly chose removal of legacy single fields and coordinated migration on the existing API paths. No aliases or deprecation period. Revert this change together with host updates to roll back; upstream saved arrays need no migration.

### i18n
The host translates the plural field, search, empty-state, validation, and capability copy. Selected-tag removal text is currently owned by the UI-kit `Select`.
