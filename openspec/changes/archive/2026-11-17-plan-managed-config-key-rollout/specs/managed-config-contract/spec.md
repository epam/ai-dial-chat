## MODIFIED Requirements

### Requirement: Local-only keys are classified with a reason and never exported

A key that depends on a local capability, credential, deployment topology, security policy, backend-enforced limit, build metadata, a derivation from another local value, or opaque client-owned JSON SHALL be classified with `localOnlyKey` and one of the reasons `capability`, `deployment-topology`, `security-policy`, `backend-enforced-limit`, `build-metadata`, `derived` or `opaque`. Local-only keys SHALL never appear in the exported schema, so a payload that contains one is rejected as an unknown key. Every current registry key SHALL be classified, and at least the following SHALL be local-only: `asr.modelId`, `features.asrEnabled`, `utility.modelId`, `features.llmConversationNaming`, `features.orgUnitsEnabled` (DIAL Core org units), `features.liveChatInteraction` (the DIAL Core client channel), `features.scheduledTasksEnabled` (the DIAL Scheduler) and `publish.publicationFilterSources` (claim and category sources the Core and identity-provider deployment defines) as `capability`; `dialCore.externalUrl` and `mcpApps.sandboxUrl` as `deployment-topology`; `overlay.allowedOrigins`, `documents.allowedConnectOrigins`, `customVisualizers`, `applicationVisualizers` and `announcement.html` as `security-policy`; `attachments.maxFileSizeBytes` and the project context limits as `backend-enforced-limit`; `app.version` as `build-metadata`; `features.footer` as `derived`; and `customVariables` as `opaque`. A key that needs a local service or Core feature SHALL be local-only even when the deployment degrades safely without it; a capability check alone does not make such a key manageable. Reclassifying an eligible key as local-only SHALL NOT change its environment resolution or its client-config field.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Local-only key in a payload

- **WHEN** a payload contains `config["asr.modelId"]`
- **THEN** validation against the exported schema fails with an `additionalProperties` error at `/config`

#### Scenario: Server-internal URL is never manageable

- **WHEN** the exported schema is inspected
- **THEN** it contains no property for `dialCore.externalUrl`, `mcpApps.sandboxUrl` or any key whose definition references `DIAL_CORE_URL`

#### Scenario: Keys that depend on Core or identity-provider features are local-only

- **WHEN** the registry is inspected
- **THEN** `features.orgUnitsEnabled`, `features.liveChatInteraction`, `features.scheduledTasksEnabled` and `publish.publicationFilterSources` are local-only with reason `capability`

#### Scenario: Reclassification keeps the environment value

- **WHEN** `ORG_UNITS_ENABLED=true`, `LIVE_CHAT_INTERACTION_ENABLED=true` and `SCHEDULED_TASKS_ENABLED=true` are set and `PUBLICATION_FILTER_SOURCES` is `title,role`
- **THEN** `GET /api/v1/client-config` returns the same `features` and `config` values as before the reclassification

#### Scenario: Reclassification leaves the 1.0.0 artifact unchanged

- **WHEN** the schema generator runs after the reclassification
- **THEN** `apps/chat-api/managed-config-schema/chat-ui-1.0.0.json` and `index.json` are unchanged and the pinned 1.0.0 hash still matches

### Requirement: Initial managed set

Schema version 1.0.0 SHALL contain exactly these managed keys: `announcement.title` (1–200 characters), `announcement.description` (1–2,000 characters), `announcement.items` (at most 10 items of `{ title, description?, link? }` with link `{ label, href }` and an `http`/`https` `href` of at most 2,048 characters), `welcomeScreen.description` (1–1,000 characters), `fileManager.availableTabs` (1–4 unique values of `all`, `my_files`, `shared`, `organization`), `usageLimits.warningThresholdPercent` (integer 1–99), and the feature `features.usageLimitsControl`. Including a key in this set SHALL NOT be treated as approval to activate it in any deployment. Each key's safe fallback for missing, rejected or stale managed state SHALL be its registry default, and a managed feature SHALL fail closed to `false`.

**RTL impact:** None. **i18n impact:** None.

#### Scenario: Exported key set

- **WHEN** the 1.0.0 schema is generated
- **THEN** `properties.config.properties` has exactly the six config keys above and `properties.features.properties` has exactly `features.usageLimitsControl`

## ADDED Requirements

### Requirement: Managed opt-in prerequisites

An eligible key SHALL become managed only in a schema version that also meets its prerequisite below. Each prerequisite SHALL be checked by a registry test, so a version that breaks it fails the build.

| Key | Prerequisite |
| --- | --- |
| `footer.html` | `features.footer` is no longer derived only from the local footer value, and the classification of `footer.html` and `announcement.html` is decided together |
| `deployments.defaultDeploymentId`, `features.defaultDeploymentPinned` | both are managed in the same schema version |

**Feature flag:** Not gated. **RTL impact:** None. **i18n impact:** None.

#### Scenario: Footer copy managed while its visibility is still local

- **WHEN** `footer.html` is managed while `features.footer` is still local-only with reason `derived`
- **THEN** the registry test fails

#### Scenario: Default deployment keys move together

- **WHEN** exactly one of `deployments.defaultDeploymentId` and `features.defaultDeploymentPinned` is managed
- **THEN** the registry test fails
