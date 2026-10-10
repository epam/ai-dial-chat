Slicing strategy: **vertical, one kind per slice.**
- Slice 1 adds the shared constant.
- Slice 2 is the quick and schema apps, the only kinds whose visible default changes for Version.
- Slice 3 is the custom app, which only switches to the constant and keeps its behaviour.
- Slice 4 is the toolset Name and the API cleanup.
- Slice 5 is docs.

Each slice is green on its own.

## 1. Shared default version (`libs/builder-form`)

- [x] 1.1 Add `DEFAULT_DEPLOYMENT_VERSION = '1.0.0'` with a JSDoc line next to `SEMVER_VERSION_PATTERN` in `libs/builder-form/src/utils/validate-deployment-creation-fields.ts`, and export it from `libs/builder-form/src/index.ts`.
- [x] 1.2 Add unit tests to `libs/builder-form/src/utils/validate-deployment-creation-fields.spec.ts`:
  - the constant equals `'1.0.0'`;
  - it passes `validateVersionPattern: SEMVER_VERSION_PATTERN` with no version error.
- [x] 1.3 Architecture guard: confirm the new export is a plain value with no REST, BFF, env or i18n knowledge, and that `useMetadataForm` and `MetadataForm` do not apply it on their own.
- Verification:
  - `npm run test:file -- libs/builder-form/src/utils/validate-deployment-creation-fields.spec.ts`

## 2. Quick app and schema app open with Version `1.0.0`

- [x] 2.1 In `apps/chat/src/pages/ApplicationEditor/definitions/schemaDefinitionHelpers.ts`:
  - rename `SCHEMA_APP_EMPTY_METADATA` to `SCHEMA_APP_DEFAULT_METADATA`;
  - set `version: DEFAULT_DEPLOYMENT_VERSION`;
  - update the imports in `quickAppDefinition.tsx` and `schemaAppDefinition.tsx`.
- [x] 2.2 Add tests to `apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx`:
  - the create form shows Version `1.0.0` and an empty Name;
  - an untouched create sends `version: '1.0.0'`.
- [x] 2.3 Add tests to `apps/chat/src/pages/ApplicationEditor/tests/schemaAppDefinition.spec.tsx`:
  - the create form shows Version `1.0.0`;
  - an untouched create sends `version: '1.0.0'`;
  - a cleared Version omits `version` from the request.
- Verification:
  - `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx`
  - `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/schemaAppDefinition.spec.tsx`
  - `npm run verify:changed`

## 3. Custom app uses the shared constant

- [x] 3.1 Replace the `'1.0.0'` literal in `DEFAULT_CUSTOM_APP_GENERAL_FORM` (`apps/chat/src/constants/custom-apps.ts`) with `DEFAULT_DEPLOYMENT_VERSION`.
- [x] 3.2 Add a test to `apps/chat/src/pages/ApplicationEditor/tests/customAppDefinition.spec.tsx`: the create form shows Version `1.0.0` and an empty Name.
- [x] 3.3 Add a registry-level test to `apps/chat/src/pages/ApplicationEditor/tests/ApplicationEditorPage.spec.tsx`: `defaultMetadata` of `custom-app`, `quick-app` and `schema-app` all have `name: ''` and `version: '1.0.0'`.
- Verification:
  - `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/customAppDefinition.spec.tsx`
  - `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/ApplicationEditorPage.spec.tsx`

## 4. Toolset opens with an empty Name (`libs/toolset-editor` + app adapter)

- [x] 4.1 In `libs/toolset-editor/src/constants/toolsets.ts`:
  - remove `DEFAULT_TOOLSET_NAME`;
  - define `DEFAULT_TOOLSET_VERSION = DEFAULT_DEPLOYMENT_VERSION`, imported from `@epam/ai-dial-builder-form`.
- [x] 4.2 In `libs/toolset-editor/src/utils/toolsets.ts`:
  - remove `getStorageSafeUniqueToolsetName`;
  - make `getDefaultToolsetForm()` take no parameters and return `name: ''`.
- [x] 4.3 Remove both names from `libs/toolset-editor/src/index.ts`.
- [x] 4.4 Update `libs/toolset-editor/src/utils/tests/toolsets.spec.ts`:
  - drop the `getStorageSafeUniqueToolsetName` suite and the collision case;
  - assert that `getDefaultToolsetForm()` returns `name: ''` and `version: '1.0.0'` with the existing protocol and auth defaults.
- [x] 4.5 In `apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx`:
  - in create mode, seed `getDefaultToolsetForm()` directly, without calling `listToolsets`;
  - drop the now-unused `listToolsets`, `resolveLocalizedText` and `PRIMARY_LOCALE` imports if nothing else in the file uses them;
  - keep the cancelled flag for the edit-mode load.
- [x] 4.6 Update `apps/chat/src/pages/ApplicationEditor/tests/toolsetDefinition.spec.tsx`:
  - replace the "New toolset" / "New toolset 1" collision tests and the `name: 'New toolset'` create assertions;
  - new tests: create mode shows an empty Name and Version `1.0.0`; issues no list-toolsets request; sends the typed name.
  - The "Create stays disabled until a name is typed" case lives in `libs/toolset-editor/src/components/ToolsetEditor/tests/ToolsetEditor.spec.tsx`, because the app spec stubs the lib editor.
- [x] 4.7 Architecture guard: confirm `libs/toolset-editor` still has no `/api` paths, server-api or generated-client imports, i18n or routing, and that its new builder-form import is an existing declared dependency.
- Verification:
  - `npm run test:file -- libs/toolset-editor/src/utils/tests/toolsets.spec.ts`
  - `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/toolsetDefinition.spec.tsx`
  - `npm run test:file -- apps/chat/src/utils/tests/toolsets.spec.ts`
  - `npm run verify:changed`

## 5. Docs and spec references

- [x] 5.1 Update `libs/toolset-editor/README.md`:
  - `getDefaultToolsetForm` takes no arguments and returns an empty name;
  - remove the `getStorageSafeUniqueToolsetName` section and the `DEFAULT_TOOLSET_NAME` bullet;
  - describe `DEFAULT_TOOLSET_VERSION` as an alias of `DEFAULT_DEPLOYMENT_VERSION`;
  - fix the host example at the top so it no longer passes existing names.
- [x] 5.2 Document `DEFAULT_DEPLOYMENT_VERSION` in `libs/builder-form/README.md`, next to `SEMVER_VERSION_PATTERN`.
- [x] 5.3 Search `docs/` and `openspec/specs/` for "New toolset", `DEFAULT_TOOLSET_NAME` and `getStorageSafeUniqueToolsetName`, and update any live reference that the delta specs do not already cover.
- Verification:
  - `npm run validate:docs`
  - `npm run validate:specs`

## 6. Close-out

- [x] 6.1 Run `npm run verify:full` once.
- [ ] 6.2 Follow-up, not in scope: file an issue to unify the edit-mode fallback for a missing `displayVersion`. Toolset uses `1.0.0` (`toolsetDtoToForm` in `apps/chat/src/utils/toolsets.ts`); apps use `''` (`deploymentToMetadata` in `apps/chat/src/utils/application-editor.ts`).
