## Context
See proposal.md. The existing backend mapper emits a one-entry skills array and reads only its first entry.

## Goals / Non-Goals
Support full array round trips and preserve the separate live-chat skill-selection workflow. No new context, attachments, execution worker, or parallel single-value `SkillSelectorField` mode.

## Decisions
Use optional skillUrls arrays in DTOs/form values. PUT omission preserves and [] clears; null fails validation. Deduplicate in stable order. Preserve full saved references independently of metadata. Make SkillSelectorField array-only and accept host-resolved names. Page-local form values own selection. Libraries remain host-agnostic.

Use existing API paths as a coordinated breaking replacement explicitly requested by the user; no v2 compatibility controller or legacy aliases. `SkillSelectorField` uses the UI kit's multiple `Select`: every skill the host passes is an option (no favorites, Browse or catalog dialog), and selected values use its built-in tags. The library adds no custom tag composition or parallel single-value component. Detail props carry display-name arrays. Existing support predicate is applied to selected entries.

## Risks / Trade-offs
External Scheduler/agent support cannot be established by local tests → verify an actual two-skill run before release. Sparse upstream lists lack payload → leave skillUrls undefined. Unavailable metadata → show saved URLs. The UI-kit Select currently owns its built-in tag-removal accessible text and exposes no host localization prop; keep the built-in renderer requested for this change and track localization in the UI kit rather than recreating tag layout here.

## Migration Plan
Regenerate Swagger client, update hosts to skillUrls and array display props, deploy app/BFF together. Existing saved upstream arrays need no rewrite. Revert code and callers together for rollback.
