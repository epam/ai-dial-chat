## MODIFIED Requirements

### Requirement: Local-only keys are classified with a reason and never exported

A key that depends on a local capability, credential, deployment topology, security policy, backend-enforced limit, build metadata, a derivation from another local value, or opaque client-owned JSON SHALL be classified with `localOnlyKey` and one of the reasons `capability`, `deployment-topology`, `security-policy`, `backend-enforced-limit`, `build-metadata`, `derived` or `opaque`. Local-only keys SHALL never appear in the exported schema, so a payload that contains one is rejected as an unknown key. Every current registry key SHALL be classified, and at least the following SHALL be local-only: `asr.modelId`, `features.asrEnabled`, `utility.modelId`, `features.llmConversationNaming`, `features.orgUnitsEnabled` (DIAL Core org units), `features.liveChatInteraction` (the DIAL Core client channel) and `features.scheduledTasksEnabled` (the DIAL Scheduler) as `capability`; `dialCore.externalUrl` and `mcpApps.sandboxUrl` as `deployment-topology`; `overlay.allowedOrigins`, `documents.allowedConnectOrigins`, `customVisualizers`, `applicationVisualizers` and `announcement.html` as `security-policy`; `attachments.maxFileSizeBytes` and the project context limits as `backend-enforced-limit`; `app.version` as `build-metadata`; `features.footer` as `derived`; and `customVariables` as `opaque`. A key that needs a local service or Core feature SHALL be local-only even when the deployment degrades safely without it; a capability check alone does not make such a key manageable. Reclassifying an eligible key as local-only SHALL NOT change its environment resolution or its client-config field.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Local-only key in a payload

- **WHEN** a payload contains `config["asr.modelId"]`
- **THEN** validation against the exported schema fails with an `additionalProperties` error at `/config`

#### Scenario: Server-internal URL is never manageable

- **WHEN** the exported schema is inspected
- **THEN** it contains no property for `dialCore.externalUrl`, `mcpApps.sandboxUrl` or any key whose definition references `DIAL_CORE_URL`

#### Scenario: Keys that depend on Core or identity-provider features are local-only

- **WHEN** the registry is inspected
- **THEN** `features.orgUnitsEnabled`, `features.liveChatInteraction` and `features.scheduledTasksEnabled` are local-only with reason `capability`

#### Scenario: Reclassification keeps the environment value

- **WHEN** `ORG_UNITS_ENABLED=true`, `LIVE_CHAT_INTERACTION_ENABLED=true` and `SCHEDULED_TASKS_ENABLED=true` are set
- **THEN** `GET /api/v1/client-config` returns the same `features` and `config` values as before the reclassification

#### Scenario: Reclassification leaves the 1.0.0 artifact unchanged

- **WHEN** the schema generator runs after the reclassification
- **THEN** `apps/chat-api/managed-config-schema/ai-dial-chat-1.0.0.json` and `index.json` are unchanged and the pinned 1.0.0 hash still matches
