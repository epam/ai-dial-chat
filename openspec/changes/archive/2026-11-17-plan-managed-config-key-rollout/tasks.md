Slicing strategy: one vertical slice of registry classification, tests and documentation. Waves 0–3 are follow-up changes, recorded at the end and not implemented here.

## 1. Classification

- [x] 1.1 In `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`, set `management: localOnlyKey(LocalOnlyReason.Capability)` on `features.scheduledTasksEnabled`, `features.orgUnitsEnabled`, `features.liveChatInteraction` and `publish.publicationFilterSources`. Change no other field. Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`, which fails on the old counts until 1.2.
- [x] 1.2 In `apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`:
  - change the count test to 7 managed, 31 local-only and 12 eligible, and rename it to match;
  - add the four keys to the "marks %s local-only as %s" table with `LocalOnlyReason.Capability`;
  - replace the "excluded candidate" list with the spec's prerequisite invariants: `footer.html` managed only while `features.footer` is not `derived`, and the default-deployment pair managed together.

  Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`.
- [x] 1.3 Add a case to the "managed classification" test in `apps/chat-api/src/app-config/tests/app-config.service.spec.ts`. That test strips `management` from every entry and compares client config and feature flags. The new case sets the variables of the four reclassified keys and expects identical resolution. Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts`.
- [x] 1.4 Run `npm run managed-config-schema` and check that `git status` shows no change under `apps/chat-api/managed-config-schema/`. Verify with `npm run test:file -- apps/chat-api/src/app-config/tests/managed-config/managed-config-artifact.spec.ts`.

## 2. Documentation

- [x] 2.1 In `docs/managed-config-schema.md`, "Classifying a registry key":
  - correct the counts to 31 local-only and 12 eligible;
  - state that safe degradation does not make a dependent key manageable;
  - add reclassified keys as examples in the `capability` row;
  - replace the "next candidates" sentence with a "Rollout" subsection that has the waves and "not planned" keys from `design.md` D1, the tested prerequisites, and why scheduled tasks are local-only.

  Verify with `npm run validate:docs`.
- [x] 2.2 Run `npm run validate:specs` and `npm run verify:changed`, then once `npm run verify:full`. Record the results here, including any failure that already exists on `development`.
  - Result: (2026-11-17, after the review fixes) `validate:specs` reported 0 errors (177 warnings, all in existing specs); `validate:docs` passed; the five focused specs passed (384 tests); `verify:full` passed typecheck, lint, format and tests. A temporary one-sided opt-in of `features.defaultDeploymentPinned` made the pair invariant fail as intended.

## Follow-up changes (out of scope; not tracked here)

- Wave 0: announcement `severity` and schema 1.1.0 (#9715).
- Wave 1: `ui.celebrationsEnabledByDefault`, `ui.activeEventId`, `mcpApps.theme` and `onboarding.hints`, with the D2 value schemas.
- Wave 2: `features.projectsEnabled`, after `features.usageLimitsControl` is active on a deployment.
- Wave 3: `footer.html` (D4), `uiFeatures.enabledUiFeatures` (D5) and the default-deployment pair (D6). Each depends on `epam/ai-dial-ui-kit#1028`, and the deployment pair also on Config Studio work.
- Separate decisions: whether a service-dependent feature with a capability check may be managed (D3), and a scheduler capability check for ENV-only deployments.
