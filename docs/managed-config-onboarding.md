# Onboarding a deployment to managed configuration

This guide connects one Chat deployment to a DIAL Config Studio instance: the
instance in DIAL Admin, the reader key, the schema upload and first
publication, the deployment values, and the checks. The contract behind each
step is in [managed-config-schema.md](managed-config-schema.md#runtime-reading-and-activation);
every variable is in [`apps/chat-api/README.md`](../apps/chat-api/README.md#environment-variables).

Nothing changes for users until `MANAGED_CONFIG_MODE=active` lists keys in
`MANAGED_CONFIG_ACTIVE_KEYS`. The steps were run on the development
environment in November 2026.

| Part                                 | Where it lives                         | Set up by                  |
| ------------------------------------ | -------------------------------------- | -------------------------- |
| Config Studio runner                 | DIAL Admin, application runners        | Once per environment       |
| Instance, for example `ai-dial-chat` | DIAL Admin, applications               | Operator                   |
| Reader API key with a dedicated role | Core keys, the Chat deployment secret  | Whoever manages secrets    |
| Chat schema and published revision   | The instance's Core bucket, via Studio | Operator, in Studio        |
| Managed reader in `chat-api`         | Chat deployment values                 | Operator, in deploy values |

Order matters: instance and key first, then a publication, then the Chat
values. A pod whose mode is not `off` and has no key fails at startup, and the
previous pod keeps serving.

## Prerequisites

- Config Studio is deployed, and its runner is registered in DIAL Admin. The
  Studio backend's `CORE_RUNNER_SCHEMA_ID` equals the runner's `$id`.
- The Chat build contains the managed reader and the `ai-dial-chat` application
  identifier.
- The operator can create applications in DIAL Admin and holds a role in the
  instance's `schemaManagerRoles` and `publisherRoles`.

## 1. Create the instance in DIAL Admin

1. Open the Config Studio runner in DIAL Admin and create an application on
   the **Platform** tab. Use a single-segment ID such as `ai-dial-chat`. A
   Public-tab application opens in Studio as "Configuration not found".
2. On the **Parameters** tab set every property; Core rejects empty values as
   "Custom application validation failed".
3. On the **Roles** tab set `user_roles` to the union of the four role lists,
   including the reader role.
4. Save, reopen the instance, and check that both role fields kept the reader
   role.

| Field                    | Example                | Meaning                                                |
| ------------------------ | ---------------------- | ------------------------------------------------------ |
| `appId`                  | `ai-dial-chat`         | Chat's identifier; the legacy `chat-ui` is rejected    |
| `environment`            | `dev`                  | Label recorded in every published revision             |
| `viewerRoles`            | `admin`                | May open the instance and draft                        |
| `publisherRoles`         | `admin`                | May publish and roll back                              |
| `schemaManagerRoles`     | `admin`                | May upload schema versions                             |
| `readerRoles`            | `admin`, `chat-config` | Roles of API keys that may read the published snapshot |
| `user_roles` (Roles tab) | `admin`, `chat-config` | Roles Core admits to the instance at all               |

The reader role must be in **both** `readerRoles` and `user_roles`:

- Missing from `user_roles`: Core refuses the key before Studio. Core reports
  that refusal on a deployment route as 500 "Error occurred on processing
  route request", so Chat logs `state unavailable, reason unavailable`.
- Missing from `readerRoles`: Studio answers 404, and Chat logs
  `reason denied`.

Re-creating an instance, for example after a runner `$id` change, resets its
roles to what is entered, so repeat this step.

## 2. Get a reader API key

Chat needs its own Core API key, separate from `DIAL_API_KEY` and
`MODEL_CATALOG_API_KEY`, with a role used for nothing else.

1. Create a Core project key with a dedicated role, one key per Chat
   deployment (for example `config-reader-chat-prod`).
2. Store it in the Chat deployment secret as `MANAGED_CONFIG_API_KEY`.
3. Confirm the key's role: `GET {DIAL_CORE_URL}/v1/user/info` with the header
   `Api-Key: <key>` returns it in `roles`.
4. Put exactly that role into the instance's `readerRoles` and `user_roles`.

## 3. Upload the schema and publish

Upload the schema version you publish against (see
[Verifying an upload](managed-config-schema.md#verifying-an-upload)): `1.2.0`
adds the welcome text, the File Manager tabs, the usage values and the
usage-limits control to `1.1.0`, which manages the tour, the announcements and
the celebrations; `1.0.0` manages only the tour, and this build accepts all
three. Upload it as a user
with a role in `schemaManagerRoles`. Studio's UI has no upload screen, and an
API key is refused with 403, so call the instance route with the user's token:

```sh
BODY=$(jq --arg op "$(uuidgen | tr A-Z a-z)" '. + {operationId: $op}' \
  apps/chat-api/managed-config-schema/ai-dial-chat-1.2.0.json)
ROUTE="$DIAL_CORE_URL/v1/deployments/ai-dial-chat/route/v1"
curl -sS -X POST "$ROUTE/schema-validations" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d "$BODY"   # {"valid":true,"errors":[]}
curl -sS -X POST "$ROUTE/schemas" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d "$BODY"   # sha256 = schemaSha256 in index.json
```

Then publish in Studio (standalone, or on the instance's Parameters tab in
DIAL Admin): fill in the **Edit** form, or import an export file from another
environment; select **Validate**, then **Review and publish**, enter a reason,
and **Publish**. The **Configuration** tab shows the new revision. What each
field means for editors is in [managed-content.md](managed-content.md).

## 4. Configure the deployment

```yaml
env:
  MANAGED_CONFIG_MODE: 'active' # off | shadow | active
  MANAGED_CONFIG_INSTANCES: 'ai-dial-chat=ai-dial-chat' # <appId>=<instance ID>
  MANAGED_CONFIG_MAX_STALENESS_SECONDS: '900'
  MANAGED_CONFIG_ACTIVE_KEYS: 'onboarding.hints'
  # With schema 1.1.0, for example:
  # 'onboarding.hints,announcement.title,announcement.description,announcement.items,ui.activeEventId,ui.celebrationsEnabledByDefault,ui.celebrationDelivery.mode,ui.celebrationDelivery.revision,ui.celebrationDelivery.externalScenes,ui.celebrationDelivery.externalEvents'
  # With schema 1.2.0, add for example:
  # 'welcomeScreen.description,fileManager.availableTabs,usageLimits.warningThresholdPercent,usageLimits.spendingLimitsMode,features.usageLimitsControl'
# secret: MANAGED_CONFIG_API_KEY
```

1. Deploy with `off` and check that the pod starts with the key.
2. Optionally switch to `shadow` and watch the shadow comparisons.
3. Remove the environment variable of every key you activate (for
   `onboarding.hints`, `ONBOARDING_HINTS`; for `ui.activeEventId`, `UI_EVENT`):
   an explicit environment value always wins over the managed one.
   Activate the four `ui.celebrationDelivery.*` keys together: in `active`
   mode a list with only some of them fails startup.
4. Switch to `active` with the keys in `MANAGED_CONFIG_ACTIVE_KEYS`.

## 5. Verify

1. The new pod logs its settings once at startup:

   ```text
   Managed configuration: mode active, instances ai-dial-chat=ai-dial-chat, active keys onboarding.hints, refresh 60s, max staleness 900s, reader key set
   ```

2. The first successful read logs
   `Managed configuration of instance ai-dial-chat: state fresh, revision <revisionId>`.
3. `GET /api/v1/client-config?appId=ai-dial-chat` returns the managed values
   and `metadata.managed` with `state: "fresh"` and Studio's `revisionId`.
4. Reload the browser tab. An open tab refetches client config every
   `MANAGED_CONFIG_CLIENT_REFRESH_SECONDS` and on focus. The onboarding tour
   shows only when its `target` is on screen and its `id` was not seen before.

To test the read without Chat, send Chat's request; 200 with the snapshot
means DIAL Admin and Studio are set up correctly:

```sh
curl -sS "$DIAL_CORE_URL/v1/deployments/ai-dial-chat/route/v1/published" \
  -H "Api-Key: $MANAGED_CONFIG_API_KEY"
```

## Troubleshooting

| Symptom                                                                                      | Cause                                                                       | Fix                                                      |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| No `Managed configuration: mode …` line; the previous pod keeps serving                      | `MANAGED_CONFIG_API_KEY is required when MANAGED_CONFIG_MODE is not off`    | Add the key to the secret, or set the mode to `off`      |
| `reason unavailable`; the read test answers 500 "Error occurred on processing route request" | The key's role is missing from the instance's `user_roles`                  | Add it on the Roles tab                                  |
| `reason denied`; the read test answers 404                                                   | The role is missing from `readerRoles`                                      | Add it to `readerRoles`                                  |
| `state not_published`                                                                        | Nothing is published                                                        | Publish in Studio                                        |
| `reason unsupported_schema`                                                                  | The revision uses a schema version or hash this build does not pin          | Upload and publish against the pinned version            |
| `reason identity_mismatch`                                                                   | The snapshot's `instanceId`, `appId` or `environment` differs               | Fix the instance's `appId` or `MANAGED_CONFIG_INSTANCES` |
| `state fresh`, but the value is unchanged                                                    | Its environment variable is still set, or the key is not active             | Remove the variable; add the key                         |
| The server returns the value, the page does not                                              | The browser holds an older client config, or the tour was already seen      | Reload; open the tour's target; try a private window     |
| Fixed in DIAL Admin, still `unavailable` minutes later                                       | Failed reads back off up to five refresh intervals, plus the response cache | Wait about six minutes, or restart the pod               |

To stop applying managed values, set `MANAGED_CONFIG_MODE=off` or remove the
key from `MANAGED_CONFIG_ACTIVE_KEYS` (the four delivery keys only together). To roll back the values themselves, roll
back to an earlier revision in Studio's History. To rotate the reader key,
deploy the new key with the same role, confirm `state fresh`, then revoke the
old one.
