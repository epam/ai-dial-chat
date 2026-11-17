## Context

See proposal.md (Why). The facts this plan relies on, as of `origin/development` at `d263e4e34`:

- Before this change the registry had 50 keys: 7 managed, 27 local-only and 16 eligible but unmanaged. `config-registry.constants.spec.ts` asserts the counts; after it they are 7, 31 and 12.
- Each new managed key needs a new schema version. Pinned versions are frozen, and every committed version needs its own fixtures (see `docs/managed-config-schema.md`, "Opting a key in" and "Versioning").
- A managed key does nothing at runtime until a deployment lists it in `MANAGED_CONFIG_ACTIVE_KEYS` with `MANAGED_CONFIG_MODE=active`. The runbook already orders the 1.0.0 keys, and it holds back `announcement.items` until a schema with announcement `severity` exists.
- The `severity` work (`origin/feat/9715-announcement-severity`, Issue #9715) is not merged and adds no schema version.
- Config Studio renders the exported schema with the DIAL UI Kit `SchemaRenderer` 0.16.0-dev.45. That renderer has no multiline string control, no enum labels, no array reordering, no multi-select for unique enum arrays and no tag input (`epam/ai-dial-ui-kit#1028`). Studio already has a feature-policy editor for managed features.

## Goals / Non-Goals

**Goals:** a recorded order for the remaining eligible keys, with what each wave needs first; registry classification that matches the dependencies we already know.

**Non-Goals:** the contents of any later schema version beyond the decisions below. Each wave's own change writes its value schemas, bounds and fixtures.

## Decisions

### D1. Rollout waves

| Wave | Schema | Keys | Why this position | Needs first |
| --- | --- | --- | --- | --- |
| 0 | 1.1.0 (MINOR) | `severity` on `announcement.items` entries | Already planned; unblocks activation of `announcement.items` | #9715 merged with a 1.1.0 export |
| 1 | next MINOR | `ui.celebrationsEnabledByDefault`, `ui.activeEventId`, `mcpApps.theme`, `onboarding.hints` | Content and presentation keys with no local dependency, and the Studio form already renders their types | see D2 |
| 2 | next MINOR | `features.projectsEnabled` | Feature with no capability dependency; Studio's policy editor is ready | `features.usageLimitsControl` active on at least one deployment, which proves the managed feature path end to end |
| 3 | one MINOR each | `footer.html`; `uiFeatures.enabledUiFeatures`; `deployments.defaultDeploymentId` + `features.defaultDeploymentPinned` | Each needs design work in Chat, and good editing needs DIAL UI Kit controls | D4–D6 |

Keys outside the waves:
- Local-only from this change: `features.scheduledTasksEnabled`, `features.orgUnitsEnabled`, `features.liveChatInteraction`, `publish.publicationFilterSources` (D3, D7).
- Not planned, left eligible: `mcpApps.hostName`, `mcpApps.userAgent` (D8) and `content.additionalLocales` (no operator request; revisit on demand).

Alternatives considered:
- **Following the "next candidates" list from the doc, unchanged.** Rejected: `features.scheduledTasksEnabled` contradicts the local-only rule, and `footer.html` has an unmet prerequisite (proposal.md).
- **Ordering by operator value alone** (footer first). Rejected: the footer is the most valuable key but the one with the most design work.

### D2. Wave 1 value schemas (direction, fixed in the wave 1 change)

- `ui.activeEventId`: a bounded non-blank string, not an enum. The frontend owns the celebration registry (`libs/celebrations`) and ignores IDs it does not support. A backend enum would reintroduce the coupling the registry description rules out. Turning celebrations off means omitting the key. The ENV-only `none` sentinel is not part of the managed contract.
- `onboarding.hints`: an array of `{ id, target, title, description? }` with `target` as an enum from `OnboardingHintTarget` (`apps/chat-api/src/app-config/types/onboarding-hint-target.ts`). This follows the way `FILE_MANAGER_ALLOWED_TABS` feeds `fileManager.availableTabs`. Ids are unique, and `maxItems` is set.
- `mcpApps.theme`: enum `light` | `dark`. `ui.celebrationsEnabledByDefault`: boolean.

### D3. Scheduled tasks are local-only

The contract's `capability` reason covers a key that needs a local service, and `features.llmConversationNaming` is local-only even though it has an operator opt-in combined with a capability check. `features.scheduledTasksEnabled` needs the DIAL Scheduler, so it is local-only by the same rule, and the contract now says a capability check alone does not make such a key manageable.

Alternative considered: keep it eligible and add a scheduler capability check, relying on the runtime to AND the managed value with the capability. Rejected here, because the same reasoning would reopen `features.llmConversationNaming` and `features.asrEnabled`. Changing the rule is a separate proposal.

A deployment with `SCHEDULED_TASKS_ENABLED=true` and no scheduler still shows a page whose endpoints fail. That is existing ENV behavior and is unchanged here; a capability check for it is a separate fix.

### D4. Footer (wave 3)

Two questions have to be decided together:
1. Can the footer and announcement HTML be managed under the client sanitizers, or do both stay `security-policy` local-only?
2. If they are managed, `features.footer` derives from the effective `footer.html`, which may be managed, instead of from `FOOTER_HTML_MESSAGE` only.

The `%%VERSION%%` token stays a server-side substitution. Editing up to the bound needs a multiline control in the UI kit (#1028, item 2).

### D5. `uiFeatures.enabledUiFeatures` (wave 3)

The value replaces the whole compiled baseline. It includes `Hide*` modifiers and deprecated aliases that the normalizer rewrites. The managed schema would be a unique-value enum array of the current `OverlayFeature` values, without aliases. The operator also needs to see the baseline they replace. The Studio form needs an ordered multi-select (#1028, item 4). A new overlay feature in Chat would then mean a new schema version.

### D6. Default deployment pair (wave 3)

`features.defaultDeploymentPinned` has no meaning without `deployments.defaultDeploymentId`, so both are exported in one version, as the spec requires. A free-text deployment ID is a poor editor: operators need a picker over deployments the Core instance knows. That means a `dial:resource` annotation plus a deployment listing in Config Studio, which is Studio work.

### D7. Reclassifying three Core- and IdP-dependent keys

- Org units: Core answers 404 while org units are off (`OrgUnitsService`).
- Live chat interaction: needs the Core client channel.
- Publication filter sources: must name claim and category sources the Core and IdP deployment provides.

Each needs a Core or IdP feature only the deployment knows, which is the `capability` reason. Org units degrade safely (Core 404 becomes `enabled: false`), but under D3 safe degradation does not make a key manageable. ENV resolution does not change.

Alternative considered: a new local-only reason such as `platform-capability`. Rejected: `capability` already covers "Core feature".

### D8. MCP host identity stays eligible

`mcpApps.hostName` and `mcpApps.userAgent` identify the host to MCP apps. No existing reason fits, and there is no operator need to change them. Adding a reason only to close them is not worth a contract change. They are listed as "not planned" in the doc.

## Risks / Trade-offs

- [Each wave costs a schema version and a Studio upload per instance] → Waves are grouped so that keys with the same readiness ship together.
- [Wave 2 waits on an activation outside Chat's control] → The dependency is recorded. If it slips, wave 2 can ship export-only, because export is not activation.
- [The four reclassifications are judgments] → They are reversible: moving a key back to eligible is a registry edit with no schema impact.
- [Scheduled tasks cannot be managed under this rule] → Recorded in the doc. Making it manageable is a contract change to the `capability` rule, proposed separately.
- [A prerequisite enforced only by review drifts] → The footer and default-deployment prerequisites are registry invariants that fail the build, not a list of keys that must stay unmanaged.
- [Kit gaps make waves 3 hard to edit even after export] → Those waves wait for #1028, or ship with documented editing limits.

## Migration Plan

Merge the registry, test and doc change. Nothing to deploy, and no Studio action is needed. Rollback is a revert.
