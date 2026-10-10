## Why

Issue [#9313](https://github.com/epam/ai-dial-chat/issues/9313): each deployment create form pre-fills fields differently.
- **Custom app** pre-fills Version `1.0.0` (`apps/chat/src/constants/custom-apps.ts:6-13`).
- **Quick app and schema app** leave Version empty (`apps/chat/src/pages/ApplicationEditor/definitions/schemaDefinitionHelpers.ts:18-25`). The BFF then saves `1.0.0` anyway (`apps/chat-api/src/applications/applications.service.ts:140`).
- **Toolset** pre-fills Version `1.0.0` and also a generated Name, "New toolset" / "New toolset N" (`libs/toolset-editor/src/utils/toolsets.ts:21-58`). That name is a hardcoded English string and is not translated.

As a result, a user sees a different starting state depending on what they create, and an empty Version on a quick app hides the value that will actually be saved.

## What Changes

The agreed target behaviour is: **Version starts at `1.0.0` and Name starts empty on every create form that shows those fields.**

- **Shared constant:** add `DEFAULT_DEPLOYMENT_VERSION = '1.0.0'` to `@epam/ai-dial-builder-form`, next to `SEMVER_VERSION_PATTERN`. This becomes the one frontend source for the default version.
- **Quick app and schema app:** create mode pre-fills Version with `DEFAULT_DEPLOYMENT_VERSION`. Today it is `''`.
- **Custom app:** reads its `1.0.0` from the shared constant instead of a literal. Behaviour does not change.
- **Toolset:** create mode opens with an empty Name.
  - Name is still required. The existing validation applies: Create stays disabled until a name is entered, and a required error appears once the field is touched.
  - The editor no longer lists the user's toolsets before showing the create form. That list was only used for the name-collision check.
  - `DEFAULT_TOOLSET_VERSION` stays exported as an alias of `DEFAULT_DEPLOYMENT_VERSION`.
- **BREAKING (`@epam/ai-dial-toolset-editor` public API):**
  - `DEFAULT_TOOLSET_NAME` and `getStorageSafeUniqueToolsetName` are removed.
  - `getDefaultToolsetForm()` no longer takes `existingNames`.
  - The only consumer in this repo is `apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx:134-146`, which is updated in this change. The lib's version stays `0.0.1`, per the repo convention.
- **No change for Skill and Prompt:** they have no Version field and already start with an empty Name.
- **No change for edit mode:** it keeps loading the stored values.

## Non-goals

- Changing the BFF fallback (`applications.service.ts:140`, `apps/chat-api/src/toolsets/utils/toolset-mapper.util.ts:25`). It already applies `1.0.0` when the request omits a version.
- Unifying the edit-mode fallback when a stored deployment has no `displayVersion`. Toolset falls back to `1.0.0` (`apps/chat/src/utils/toolsets.ts:103`) and apps fall back to `''` (`apps/chat/src/utils/application-editor.ts:108`). The issue covers creation forms only. I can file this as a follow-up.
- Making Version required, or changing the SemVer validation.
- Adding Version to Skill or Prompt.

## Alternatives considered

- **Leave Version empty on every form.** Rejected by the product decision for this issue: the form should show the value that will be saved.
- **Give every kind a unique default Name** ("New custom app", "New quick app", …). Rejected: it needs new i18n keys and a list request per kind, and the generated name is usually overwritten anyway. Apps, skills and prompts already start empty.
- **Keep the per-kind `'1.0.0'` literals and only patch `SCHEMA_APP_EMPTY_METADATA`.** This is the smallest diff, but it keeps three copies on the frontend. Rejected in favour of one shared constant.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `builder-form`: the library also exports `DEFAULT_DEPLOYMENT_VERSION`, the shared default version.
- `application-editor-registry`: every form-based kind's create-mode `defaultMetadata` starts with an empty name and `DEFAULT_DEPLOYMENT_VERSION`.
- `toolset-authoring`: create mode opens with an empty Name. The "Unique name generation" and "Name-uniqueness check compares against the primary locale" requirements are removed.
- `toolset-editor-library`: `DEFAULT_TOOLSET_NAME` and `getStorageSafeUniqueToolsetName` are removed from the public surface, and `getDefaultToolsetForm` takes no arguments.

## Impact

- **Frontend files:**
  - `apps/chat/src/constants/custom-apps.ts`
  - `apps/chat/src/pages/ApplicationEditor/definitions/schemaDefinitionHelpers.ts`
  - `apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx`
- **Libs:**
  - `libs/builder-form/src/utils/validate-deployment-creation-fields.ts` and `libs/builder-form/src/index.ts`
  - `libs/toolset-editor/src/constants/toolsets.ts`, `libs/toolset-editor/src/utils/toolsets.ts` and `libs/toolset-editor/src/index.ts`
- **READMEs:** `libs/builder-form/README.md` and `libs/toolset-editor/README.md` (they document the removed exports).
- **Tests:**
  - `libs/toolset-editor/src/utils/tests/toolsets.spec.ts`
  - `apps/chat/src/pages/ApplicationEditor/tests/toolsetDefinition.spec.tsx` (assertions on "New toolset" and the collision behaviour)
  - New assertions in the quick-app, schema-app and custom-app definition specs
- **Library isolation:** the new constant is a host-agnostic display default, the same kind of value as the existing `SEMVER_VERSION_PATTERN`. Hosts pass it in through `defaultMetadata`. The lib learns nothing about REST or the BFF.
- **i18n:** no new user-visible strings. An untranslated English default ("New toolset") is removed.
- **Backend/API:** no change. Requests now carry `version: '1.0.0'` explicitly where they used to omit it, and the BFF stores the same value either way.
- **Rollback and compatibility:** revert the commit. Existing deployments are unaffected because only create-mode initial values change. The only breaking change is to the toolset-editor lib API above, and it has no consumers outside `apps/chat`.

## Acceptance criteria

- Opening create for Custom app, Quick app (any embedded-editor schema), Schema app and Toolset shows Version `1.0.0` and an empty Name.
- On the toolset create form, Create stays disabled until a Name is entered. This is the existing `isToolsetFormValid` gate, and no request is sent while it is disabled.
- Toolset create mode no longer calls the list-toolsets endpoint.
- Skill and Prompt create forms are unchanged.
- `npm run validate:docs` and `npm run validate:specs` pass, and the affected unit tests pass.
