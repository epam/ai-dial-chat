# Design

## Context

See `proposal.md` for motivation. Facts the approach rests on, all read on `development` (024ed5445):

- `PublishService.publish` derives the target inline (`getPublicTargetFolder`, `getVersionedTargetResourceName`, `getPublishedTargetUrl` in `apps/chat-api/src/publish/publish-target.util.ts`) and, on a failed `createPublication`, calls `mapDialHttpStatus`, which turns Core's `400` into a `BadRequestException` carrying Core's raw text. The error has no `code`.
- The same "Core says 400, then check the destination exists, then answer 409" conversion already exists three times, always with the caller's token and with 404 meaning "absent": `transferDialResource` (`apps/chat-api/src/common/utils/dial-resource-transfer.ts`), the project rename in `projects-update.service.ts`, and the files batch move.
- A `409` with a domain `code` already exists for own-bucket duplicates (`ResourceNameConflictDto`, `ResourceNameConflictCode`, mapped in `libs/chat-hooks/src/catalog/resource-name-conflict.ts`).
- The publish panel already has a precedent for "this item is already in that folder": `derivePublishState` returns `ReplaceWarning`, shown as a warning callout under the destination row with Publish disabled (`allowReplace` is `false` for catalog, project and conversation panels).
- The panel has no version field. The version is the entity's saved version (`item.version`).
- `libs/*` must not know REST paths or the generated client; behaviour reaches them through props and callbacks. `libs/chat-hooks` may call the generated client with an injected instance.

## Goals / Non-Goals

**Goals:**
- One target derivation shared by publish and the check.
- A `409 target-exists` that also covers copies the caller cannot see.
- A pre-check that reuses the existing callout slot and disabled-Publish behaviour.

**Non-Goals:**
- Any new way to reach DIAL Core: only the caller's token, only read-only metadata reads that the code already performs elsewhere.
- Conversations, org-unit copy, unique published paths.
- Verifying Core's real status/text during design. Core's actual reply is read from the existing warn log line (`DIAL Core returned … for publish …` plus the error body) during manual verification of the finished feature; if it differs, one condition changes.

## Decisions

**1. Extract `resolvePublishTarget` from `publish`.**
It takes `entityId`, `folderPath`, `version` and returns the encoded `sourceUrl`, the type prefix, the target resource name and the `targetUrl`. `publish` and the new check both call it. Alternative: re-derive in the check service. Rejected: the issue requires the two to address the same path, and a copy would drift (the `{name}__{version}` rule in `getVersionedTargetResourceName` already did change once, #9428).

**2. Reuse the existing existence helper; do not write a fourth one.**
`existsQuietly` in `dial-resource-transfer.ts` already reads applications, toolsets, prompts and skills metadata; the project update has its own private copy for projects. The change exports one helper from `dial-resource-transfer.ts` (`200` taken, `404` free, other statuses mapped through `mapDialHttpStatus`), makes its type switch explicit, and adds `Projects` (`listProjectMetadata`) to it; `existsQuietly` becomes a thin wrapper over it. The check endpoint uses the throwing form, the `409` conversion the quiet form. Alternative: a new read inside the publish module. Rejected: a fourth copy of the same call. Alternative: leave projects out of the shared helper. Rejected: it keeps the duplicate and the project target would need its own read. The project update's private copy is left alone (out of scope); a follow-up can switch it to the helper.

**3. How `409 target-exists` is decided.**
After `createPublication` fails with `400` or `409`: if the quiet metadata read finds the target, or Core's message matches "already exists", throw `ConflictException` with `{ message, error: 'Conflict', code: 'target-exists' }` (a new `PublishConflictCode` enum and a DTO documented on the `409` response); otherwise keep `mapDialHttpStatus`. The text signal is the only way to report a copy the caller's token cannot read, which the issue promises the `409` covers. Alternative: metadata read only. Rejected: leaves hidden and pending copies on the generic error. Alternative: text only. Rejected: it hardcodes on one string with no second signal. The text match is case-insensitive and anchored on "already exists" so a rewording that keeps those words still works.

**4. Target-check endpoint is a GET on the publish controller.**
`GET /catalog/:entityType/:entityId/publish-target?folderPath&version` answers `{ taken }`, beside the existing `GET unpublish-access`. It is read-only, needs no body and carries no side effects. Alternative: POST. Rejected: not a mutation. Alternative: a boolean flag on the publish endpoint ("dry run"). Rejected: it would push validation and rules DTO into a call that only needs three fields.

**5. `usePublishFlow` gets `onCheckTargetExists`, `isTargetTakenError`, and returns `isTargetTaken`, `isTargetChecking`.**
It follows `onFetchExistingRules`: an effect keyed on the selected folder and `item.version`, with a cancelled flag for stale answers. It skips folders created in the session (they cannot collide) and folders where the item's own history already holds this version (the existing warning already blocks). The panel keeps one callout slot, so precedence is `NoAccess` > check in flight > `SubmitError` > `ReplaceWarning` > `TargetTaken`, following the order the panel already used for its other callouts (a failed submit stays on top until the next one clears it). A target-taken submit rejection is converted to `isTargetTaken` instead of `hasSubmitError`, so the pre-check and the safety net show the same text. Alternative: a second callout slot. Rejected: two stacked warnings for one cause.

**6. The logic lives in `libs/chat-hooks`; the apps only wire and translate.**
`libs/chat-hooks` already owns the publish request surface (`createPublishApiClient`), the publish hooks (`usePublishHistory`, `usePublishDependencies`) and a precedent for reading a domain `409` code (`resource-name-conflict.ts`, built on `getApiErrorDetails`). The change adds there: `checkPublishTarget` on `PublishApiClient`; `PublishTargetTakenError` with a reader of the `target-exists` code that reuses `getApiErrorDetails`; and one hook, `usePublishTargetGuard`, that takes the `PublishApiClient` and a `getEntity` lookup (an item's entity type and id, so one hook serves the catalog, where the item changes, and a project panel, where it is fixed) and returns `onCheckTargetExists`, `isTargetTakenError` and a `wrapPublish` that rethrows the `409` as `PublishTargetTakenError`. It returns plain callbacks and imports nothing from `libs/publish-panel` but types, so the isolation rules for `chat-hooks` hold. The catalog host and the project container both consume it, so the wiring is not written twice. What stays in `apps/chat` cannot move: `t()` texts and translation keys, `usePublishErrorNotification` (it needs i18n and the notification context), and threading the callbacks through `CatalogView` props the way `onFetchExistingRules` already is. The `409` is turned into `PublishTargetTakenError` before `usePublishFlow` sees it because `getApiErrorDetails` is async and the hook's predicate is synchronous. Alternative: write the call and the conversion in each app container. Rejected: duplicated logic in the thin layer.

**7. Lib isolation and text.**
`libs/publish-panel` receives `onCheckTargetExists`, `isTargetTakenError` and two labels, `targetTakenLabel` and `targetTakenVersionedLabel` (English defaults, `{folder}` and `{version}` placeholders), and picks the versioned one when the item has a version. The "with or without version" choice is therefore made once, in the lib, not by each host. It knows no path or client. The app only supplies the translated strings.

**8. Loading and failure.**
While a check is in flight Publish is disabled with no callout; a rejected check clears the state and leaves Publish enabled, because the `409` on submit already covers it.

## Risks / Trade-offs

- [The check cannot see a copy hidden from the caller or pending approval] → The `409` on submit covers it through the text signal; the issue lists this limit explicitly.
- [Another publication lands between check and submit] → Same safety net.
- [Core's text or status for an existing target differs from the assumption] → The condition accepts `400` and `409` and a case-insensitive "already exists"; Core's real reply is read from the existing warn log during manual verification, and a mismatch is a one-line change.
- [The metadata read of a folder-shaped target (skills, projects) may answer differently from a file-shaped one] → Same read calls org-unit copy and project update already depend on; confirmed in manual verification, not by a probe.
- [A check per folder selection adds Core calls] → One cheap metadata read; skipped for own-history hits and new folders; no polling.
- [The target-check answer is advisory and can say `false` for a taken target] → The panel never treats `false` as a guarantee; documented in the spec and README.

## Migration Plan

Additive: a new endpoint, a new `409` body on an existing endpoint, new optional hook options and a new callout kind. Existing hosts that do not pass the new options keep the old behaviour. `libs/chat-api-client` is regenerated with `npm run openapi`; `npm run openapi:check` guards drift. No data migration.
