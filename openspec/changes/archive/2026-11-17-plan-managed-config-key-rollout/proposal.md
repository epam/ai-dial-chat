## Why

Schema `chat-ui` 1.0.0 manages 7 of the registry's 50 keys. The other 16 were "eligible but unmanaged" with no recorded plan. `docs/managed-config-schema.md` named four next candidates and said 14 keys were eligible; the registry test ("declares exactly the 50 known keys") has 16.

Two of those candidates cannot simply be opted in:

- `features.scheduledTasksEnabled` needs the DIAL Scheduler (`SchedulerConsentService` in `apps/chat-api/src/external-services/scheduler-consent.service.ts`). The contract already requires a key that needs a local service to be local-only, so listing it as a candidate contradicted the contract.
- `footer.html` would be exported but never shown: `features.footer` is `derived` from the local `FOOTER_HTML_MESSAGE` only (`isCapabilityAvailable` in `apps/chat-api/src/app-config/feature-capabilities.ts`).

Config Studio now renders the 1.0.0 schema on dev, and the runtime reader has merged, so the order and preconditions for the next keys need to be written down.

## What Changes

- Classify four eligible keys as local-only with reason `capability`, under the existing rule "needs a local model, credential, service or Core feature":
  - `features.scheduledTasksEnabled`: DIAL Scheduler;
  - `features.orgUnitsEnabled`: Core org units;
  - `features.liveChatInteraction`: Core client channel;
  - `publish.publicationFilterSources`: claim and category sources of the Core and IdP deployment.
- State in the contract that a capability check alone does not make such a key manageable, even when the deployment degrades safely without the dependency. Org units do degrade safely (Core 404 becomes `enabled: false`).
- Replace the "excluded candidates stay unmanaged" list with one prerequisite requirement that registry tests check as invariants:
  - `footer.html` is managed only once `features.footer` no longer derives from the local value;
  - the default-deployment pair is managed together.
- Record the rollout waves in `docs/managed-config-schema.md` and correct the counts (31 local-only, 12 eligible).

Not breaking. Local-only and unmanaged keys are both excluded from the exported schema, so `chat-ui-1.0.0.json` and its pin are unchanged, and ENV resolution of the reclassified keys is unchanged. Rollback is a revert.

## Non-goals

- Opting any key in, bumping `MANAGED_CONFIG_SCHEMA_VERSION`, or regenerating the artifact. The waves are separate changes.
- Changing the `capability` rule so that a service-dependent feature with a capability check can be managed. That would also reopen `features.llmConversationNaming`, and it needs its own decision.
- Changing `announcement.html` or `footer.html` classification or the HTML sanitizers.
- Activating keys in any deployment, or any Config Studio or UI-kit change.

## Alternatives considered

1. **Plan in documentation only.** The registry would still let a contributor opt in a key the contract forbids. Rejected.
2. **Allow service-dependent features once a capability check exists.** This matches the runtime, which ANDs a managed feature with its capability, but it contradicts the existing local-only classification of `features.llmConversationNaming` and `features.asrEnabled`. Rejected here; it can be proposed separately.
3. **Keep the existing rule and apply it consistently (chosen).** Smallest contract change, and no existing classification is reversed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `managed-config-contract`:
  - four more keys are required to be local-only, and the rule says a capability check alone does not make such a key manageable;
  - the excluded-candidates scenario is removed;
  - a new requirement lists the opt-in prerequisites that tests check.

## Impact

- `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`: `management` on four entries.
- `apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`: counts, the local-only table, and the prerequisite invariants in place of the excluded-candidate list.
- `apps/chat-api/src/app-config/tests/app-config.service.spec.ts`: one more ENV case in the classification-neutrality test.
- `docs/managed-config-schema.md`: counts, classification wording and the rollout section.
- No API, client-config response, OpenAPI, frontend, lib, i18n string or feature-flag change. Config Studio is unaffected.
