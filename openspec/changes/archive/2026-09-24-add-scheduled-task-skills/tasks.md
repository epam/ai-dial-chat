## 1. API and persistence

- [x] 1.1 Add optional nullable `skillUrl` to create/update requests and optional `skillUrl` to responses. Keep `prompt` a required string; accept empty instructions only with an effective skill. Validate DIAL resource references, including the 1024-character decoded path limit and raw-path safety checks.
- [x] 1.2 Serialize the skill into `properties.payload.messages[0].custom_content.skills` using `encodeDialResourcePath`, and read it back from the same field. Preserve fixed Scheduler properties and sparse list responses.
- [x] 1.3 Read authoritative detail on PUT: preserve the skill on omission, replace it on a string, and remove it on null. Validate the effective model/skill configuration through the deployments facade before writing. Keep typed errors, distinguish unavailable deployments from missing tasks, and invalidate list cache only after successful writes.
- [x] 1.4 Expose the contract through Swagger and the generated client. Preserve the configured `scheduledTasksApi` singleton and existing `chat-hooks` transport adapters; propagate domain error codes without constructing clients inside libraries.

## 2. Reusable libraries

- [x] 2.1 Export `isSkillSelectionUnsupported` from `chat-shared` and use it in the chat skill overlay, controlled field, and scheduler validation. Base compatibility on the selected reference and explicit support, independently of catalog metadata.
- [x] 2.2 Export controlled `SkillSelectorField` from `skills` using the model/agent input style, searchable host-supplied favorites, Browse catalog action, trailing clear button, and optional mobile overlay. Preserve raw-reference fallback, disabled/invalid states, accessible IDs, focus management, and style overrides.
- [x] 2.3 Extend `ScheduledTaskCreateForm` with an opaque Skill slot above Instructions, optional values/errors/labels/IDs, and a save guard accepting instructions, a skill, or both. Add shared content/capability error codes and support options.
- [x] 2.4 Extend checked preparation and reverse mapping in `chat-hooks` for skill-only tasks, preserved references, and explicit null removal. Keep recurrence conversions and root/subpath exports consistent.

## 3. Application integration

- [x] 3.1 Compose the reusable field with the skills catalog, favorites, and app-resolved metadata in `ScheduledTaskSkillField`. Use a dropdown on desktop and the existing bottom-sheet shell on mobile. Wire create/edit pages to their local drafts, deployment support, translations, and unique field IDs.
- [x] 3.2 Revalidate on model, skill, and capability changes. Preserve the draft on server errors, clear stale capability errors when support changes, and allow retry when support recovers.
- [x] 3.3 Gate selection with `skillUsageEnabled`. Preserve hidden saved references and show incompatible hidden data as a visible form-level error. Keep existing scheduled-task route, role, session, and CSRF policies.
- [x] 3.4 Display Skill before Instructions in Configuration and conversation summaries, using resolved names or full-reference fallback. Preserve Model placement, hide empty Instructions for skill-only tasks, and keep read-only metadata visible when selection is disabled.
- [x] 3.5 Add translated labels/messages and support keyboard interaction, focus return, live errors, touch removal, AAA contrast, RTL, and 360px/container-responsive layout. Keep shared search highlighting.

## 4. Tests and public contracts

- [x] 4.1 Cover API validation, capability rejection, persistence mapping, omission/null semantics, sparse lists, Unicode/encoded path round-trips, and failure paths with controller and unit tests.
- [x] 4.2 Cover shared validation/preparation, controlled selection, skill-only create/edit, support changes, retry without draft loss, feature-disabled editing, metadata fallback, and read-only rendering with component/page tests.
- [x] 4.3 Extend the packed consumer fixture for selection/removal, validation, preparation/hydration, and detail rendering without app providers or source aliases. Cover keyboard focus and narrow LTR/RTL layouts in browser tests.
- [x] 4.4 Document public library contracts, application composition, and the message-level execution contract in affected READMEs and `docs/architecture.md`. Preserve library isolation, dependency boundaries, stylesheet exports, and JSDoc.
