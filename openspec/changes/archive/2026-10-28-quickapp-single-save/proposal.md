## Why

A Quick App Save currently causes two writes: the embedded editor PATCHes the application on `TriggerSave`, then chat sends a second `updateApplication` (`reassertSkillsSupport`) with the same metadata. chat-api already forces `features.skills_supported: true` on every Quick App update, so the second call is redundant. Worse, Preview triggered the save without `general`, so the second PATCH was the only writer of the metadata, leaving the editor's held General stale (its auto-save could revert name/description/icon/topics).

Related to epam/ai-dial-quickapps-frontend#146.

## What Changes

- `QuickAppSetup.startPreview` posts `TriggerSave` with the `general` payload, as `save` does.
- Remove `reassertSkillsSupport` and its calls; the embedded editor is the single writer.
- Remove the requirement that a Settings-step save reasserts `features.skills_supported`; update the dependent preview, authoring and write-API specs.
