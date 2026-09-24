## Why

Scheduled tasks need to reuse chat skills alongside custom instructions. This change adds one optional skill to task creation, editing, read-only views, and the scheduled completion payload while preserving instruction-only usage and reusable library boundaries.

## What Changes

### Solution

- Add a controlled `SkillSelectorField` in `libs/skills`, composed into the scheduled-task form through an opaque slot above Instructions. Match the model/agent input with searchable favorites, Browse catalog access, a trailing clear button, and mobile sheet presentation. Selection belongs to the local form draft.
- Accept instructions only, one skill only, or both. Require explicit model/agent skill support in shared client validation and authoritative BFF validation.
- Extend existing create/update/read contracts with `skillUrl`. PUT omission preserves the saved reference; explicit null removes it.
- Serialize skills at `properties.payload.messages[0].custom_content.skills`, matching chat's user-message payload and resource-path encoding. Apply the path-length limit to decoded characters.
- Preserve form values on errors and clear stale capability errors when deployment support changes.
- Render a resolved skill name or its full reference above Instructions in Configuration and conversation summaries.
- Gate selection with `skillUsageEnabled` while preserving saved references and read-only metadata when selection is disabled.

### Non-goals

Multiple skills, skill authoring, new routes/providers, Scheduler implementation changes, changes to recurrence/offline credentials, execution retries, and broad chat-selector refactoring are outside this change.

### Alternatives considered

An app-only selector and validator would duplicate behavior for embedding applications. Catalog or deployment integration inside `scheduled-tasks` would break library isolation. Reusable presentation and validation belong in libraries; app adapters supply integration details.

## Capabilities

### New Capabilities

None; this extends existing capabilities.

### Modified Capabilities

- `scheduled-task-create-form`: optional Skill slot, content validation, immediate errors, edit hydration, and feature-flag behavior.
- `scheduled-tasks-reuse-contract`: shared validation/preparation and installed-package use of the controlled field.
- `scheduled-tasks-api`: skill persistence, safe update semantics, server validation, generated client, and execution payload.
- `scheduled-task-detail-page`: Skill in Configuration and reusable summaries, including missing-metadata fallback.
- `skill-input-attachment`: controlled field and capability validation based on the selected reference.

## Impact

The change spans `libs/scheduled-tasks`, `libs/skills`, `libs/chat-shared`, `libs/chat-hooks`, generated `libs/chat-api-client`, and the frontend/BFF scheduled-task adapters. Libraries receive values, labels, booleans, nodes, and callbacks. Application code owns catalogs, feature flags, translations, deployment lookups, routing, and configured clients. Generated-client operation signatures remain within the existing `chat-hooks` exception.

The form follows the existing `modelSelector` composition in `libs/scheduled-tasks/src/models/scheduled-task-create-form-props.ts`. Catalog injection follows `apps/chat/src/components/SkillSelector/useSkillSelectorOverlay.tsx`. Public APIs and integration behavior are documented in affected READMEs and `docs/architecture.md`.

### Acceptance criteria

- Create and edit accept instructions only, skill only, or both; an empty configuration is rejected.
- Unsupported or unresolved deployment capability blocks skill-bearing writes in the form and BFF, including when skill metadata is missing.
- A skill survives create/read/edit; omission preserves it and null removes it. Sparse lists never erase saved detail or draft data.
- A scheduled run forwards the same message-level skill extension as chat, including empty content for skill-only tasks, using the existing offline-credentials identity.
- Valid Unicode, spaces, and encoded paths remain usable after read/edit without double encoding or encoding-dependent length rejection.
- Detail and summary show the skill name or full-reference fallback; absent skills and empty instructions add no empty fields.
- Supporting capability recovery permits retry without losing draft values, including with a hidden selector.
- Built-package consumers can use selection, validation, preparation, and display without app imports or duplicated policy. Public exports, styles, translations, accessibility, and responsive behavior remain consistent.

### Compatibility and rollback

Public additions are optional. `prompt` remains a required string on the wire but may be empty with a skill. Existing instruction-only hosts remain supported. Deploy the compatible BFF before updated clients. Disabling selection preserves saved data; rolling back to a BFF that drops skill payloads requires preventing edits of skill-bearing tasks first.
