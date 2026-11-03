## Context and decisions

This change records the implemented behavior requested in the current session. Existing name lookup in `apps/chat/src/hooks/scheduled-tasks/useScheduledTaskSkillDisplayNames.ts` is preserved as a compatibility wrapper around selection-scoped details. The new resolver follows its existing abort-on-selection-change pattern, preserving catalog names and querying only references absent from current listings.

The app classifies metadata HTTP 400/403/404 as unavailable, based on the observed deleted/revoked resource responses. Other failures retain fallback references. Deployment availability uses the existing context's successful catalog snapshot and `findDeploymentByIdOrReference`, including normalized encoding. No network endpoint, request schema, generated client or cache TTL is changed.

Preview hooks own localized display values. The full detail page and conversation summary forward `renderSkillName` and `renderModelName`; the run's model source remains the conversation, not the current task. Preview values remain hidden during lookup. The repeated short-name formatting is intentionally limited to app adapters; it does not introduce resource parsing into libraries.

The edit page resolves skills once and passes the same result into the field and its submit guard. `isSubmitDisabled` prevents Save during pending checks; `prepareUpdateBody` independently prevents updates. Availability errors are derived from current selection and recover when corrected. The reusable selector uses the kit's custom tag renderer only when unavailable selections exist. Error fill and border use overridable CSS variables; ordinary tags remain normal. The model field uses a host display override and tooltip without preventing replacement.

## Boundaries and accessibility

Libraries receive names, callbacks, flags and labels only. They perform no availability requests and import no app contexts or API clients. Existing responsive selector branches, logical layout and kit keyboard behavior remain. Preview unavailable text is focusable; editor state is described by suffixes/tooltips and model errors, not only color. No new icons, feature gates, telemetry or storage are introduced.

## Risks and verification

- Availability is based on current catalogs, not a realtime subscription. Remote changes may remain unnoticed until catalog refresh or a later metadata read; backend validation remains authoritative.
- HTTP 400 is treated as unusable for this metadata endpoint, including paths resolving to a grouping folder; it is not a global HTTP policy.
- A temporary lookup failure is not mislabeled deleted and does not add a new permanent save block.
- Tests cover metadata statuses, pending/stale resolution, unavailable presentation, removal, model replacement, loading/error catalogs, direct submit blocking and recovery. Existing mobile selector and RTL keyboard tests cover interaction branches; no new browser screenshot sweep was performed during review.
- Previous validation passed scoped tests, library builds/typechecks, app TypeScript and documentation checks. A pre-existing static `BottomSheetShell` import triggers the current lazy-library boundary lint rule; this change does not introduce that import.

## Rollback

Revert the app wiring and optional props together; saved model/skill references and backend payloads remain unchanged.
