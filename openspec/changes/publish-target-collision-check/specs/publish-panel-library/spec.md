# Spec Delta

## ADDED Requirements

### Requirement: usePublishFlow checks whether the target in the selected folder is taken

`usePublishFlow` SHALL accept an optional host callback `onCheckTargetExists(item, folderPath)` that resolves to a boolean, and SHALL call it whenever the selected folder changes to a defined folder, and whenever `item.version` changes while a folder is selected. The result SHALL be exposed as `isTargetTaken` and the in-flight state as `isTargetChecking`. The hook SHALL NOT know what the host sends: how the target is derived or checked stays with the host.

The check SHALL be skipped, with `isTargetTaken` `false` and `isTargetChecking` `false`, when no folder is selected, when `onCheckTargetExists` is omitted, when the selected folder was created in the current session, and when the item's own publication history already holds it in that folder (`hasExistingPublicationInFolder`). A result that arrives after the folder or version changed again SHALL be discarded. A rejected callback SHALL leave `isTargetTaken` `false`, `isTargetChecking` `false` and SHALL NOT set `hasSubmitError`.

When `onPublish` rejects and the host reports the rejection as a taken target, the hook SHALL expose `isTargetTaken` as `true` for the selected folder, so the panel shows the same callout as after the pre-check. The host reports this by an optional `isTargetTakenError(error)` predicate; without it the rejection keeps behaving as `hasSubmitError`.

`isTargetTaken` and `isTargetChecking` SHALL be reset by `reset`.

#### Scenario: Selecting a folder triggers one check
- **GIVEN** a host supplies `onCheckTargetExists` and the user has not selected a folder
- **WHEN** the user selects folder `A`
- **THEN** the callback is called once with the item and `["A"]`, and `isTargetChecking` is `true` until it resolves

#### Scenario: Changing the version re-checks
- **GIVEN** folder `A` is selected and the check resolved
- **WHEN** `item.version` changes
- **THEN** the callback is called again for `A` with the new item

#### Scenario: Stale result is discarded
- **GIVEN** a check for folder `A` is in flight
- **WHEN** the user selects folder `B` and `A`'s check resolves `true` afterwards
- **THEN** `isTargetTaken` stays for `B` and is not set by `A`'s result

#### Scenario: Own history short-circuits the check
- **GIVEN** the selected folder is in the item's own publish history for this version
- **WHEN** the folder is selected
- **THEN** the callback is not called

#### Scenario: Failed check does not block
- **WHEN** `onCheckTargetExists` rejects
- **THEN** `isTargetTaken` is `false`, `isTargetChecking` is `false` and `hasSubmitError` is unchanged

#### Scenario: Submit rejected as a taken target
- **GIVEN** the host's `isTargetTakenError` returns `true` for the rejection of `onPublish`
- **WHEN** the user submits
- **THEN** `isTargetTaken` is `true` and the generic submit-error callout is not shown

### Requirement: derivePublishState and PublishPanel show a target-taken callout and disable Publish

`derivePublishState` SHALL accept `isTargetTaken` and `isTargetChecking` and return a new callout kind for a taken target. The order of the outcomes SHALL be: submitting; no folder selected; no write access; the item's own publication already in the folder (`ReplaceWarning`); target taken (the new kind); submit error; then the informational callout. While `isTargetChecking` is `true` the submit button SHALL be disabled with no callout. A taken target SHALL disable submit regardless of `allowReplace`.

`PublishPanel` SHALL render the new kind in the same slot and warning style as `ReplaceWarning`, with the folder name emphasised the same way, using host-supplied labels `targetTakenLabel` and `targetTakenVersionedLabel`, each with an English default and a `{folder}` placeholder (the versioned one also `{version}`). The panel SHALL use the versioned label when the resource has a version and the plain one otherwise, so a host does not choose between them. The callout text SHALL reach assistive technology through the existing live-region mechanism of the panel's callouts. The label, like every other text of the library, SHALL come from the host. `README.md` SHALL list the new option, result fields and label.

#### Scenario: Taken target disables Publish
- **GIVEN** a folder is selected, the user has write access, and `isTargetTaken` is `true`
- **WHEN** the panel renders
- **THEN** the target-taken callout is shown under the destination row and the submit button is disabled

#### Scenario: Label follows the resource's version
- **WHEN** the callout is shown for a resource with a version
- **THEN** it uses `targetTakenVersionedLabel`; for a resource without a version it uses `targetTakenLabel`

#### Scenario: Own publication wins
- **GIVEN** `hasExistingPublicationInFolder` and `isTargetTaken` are both `true`
- **WHEN** the panel renders
- **THEN** only the `ReplaceWarning` callout is shown

#### Scenario: Checking disables Publish without a callout
- **WHEN** `isTargetChecking` is `true`
- **THEN** the submit button is disabled and no target-taken callout is shown

#### Scenario: No access wins over a taken target
- **GIVEN** the user has no write access to the folder
- **WHEN** `isTargetTaken` is `true`
- **THEN** the no-access callout is shown, not the target-taken one
