## MODIFIED Requirements

### Requirement: Public package surface
`libs/toolset-editor/src/index.ts` SHALL export the composed `ToolsetEditor` component, the shared `GeneralForm` component (also consumed by the Custom App editor), and every TypeScript type reachable through their props (`ToolsetEditorProps`/`ToolsetEditorLabels` with its nested `layout`/`general`/`settings`/`validation` label groups and their `ToolsetEditorLayoutLabels`/`ToolsetEditorValidationLabels` types, `GeneralFormProps`/`GeneralFormLabels`, `SettingsFormLabels`, `AuthSectionLabels`, `ConnectMcpUrlContentLabels`, the form models `ToolsetFormData`/`ToolsetAuthFormData`/`DeploymentGeneralFormData`/`ToolsetFormErrors`, the injected-auth request shapes `ToolsetLoginRequest`/`ToolsetLogoutRequest`/`ToolsetAuthActions`, the host OAuth handoff `ToolsetOAuthLoginStatus` enum with the `ToolsetOAuthLoginHandler`/`ToolsetOAuthLoginRequest`/`ToolsetOAuthLoginResult` types, the `ToolsetTransportType` enum, the `AUTH_TYPE_ICONS`/`DEFAULT_TOOLSET_VERSION` constants (`DEFAULT_TOOLSET_VERSION` is an alias of `@epam/ai-dial-builder-form`'s `DEFAULT_DEPLOYMENT_VERSION`), the `TOOLSET_EDITOR_CLASS` public class-name map, and the pure utils `getDefaultToolsetForm` (no parameters; returns an empty `name` and `version: DEFAULT_TOOLSET_VERSION`), `isValidEndpointUrl`, `normalizeReturnedEndpointUrl`, `isToolsetAuthValid`, `isToolsetFormValid`). The internal `SettingsForm`, `AuthSection`, and `ConnectMcpUrlContent` components SHALL NOT be re-exported from the barrel — only `ToolsetEditor` and `GeneralForm` render them. The barrel SHALL NOT export a default toolset name constant or a unique-name helper (the former `DEFAULT_TOOLSET_NAME` and `getStorageSafeUniqueToolsetName` were removed).

The package `libs/toolset-editor/package.json` SHALL declare `name: "@epam/ai-dial-toolset-editor"`, `description`, `license: "Apache-2.0"`, an `exports` map matching `libs/skill-editor/package.json`'s shape (`@epam/source`/types/import/default for `.`, plus `./package.json` and `./styles.css`), `dependencies` on `@epam/ai-dial-builder-form` and `@tabler/icons-react`, and peer dependencies on `react`, `@epam/ai-dial-ui-kit`, `@epam/ai-dial-chat-shared`, and `@epam/ai-dial-chat-hooks`.

#### Scenario: Consumer imports the library's public surface
- **WHEN** `apps/chat/src/pages/ApplicationEditor/toolset/ToolsetApplicationEditor.tsx` writes `import { ToolsetEditor, getDefaultToolsetForm } from '@epam/ai-dial-toolset-editor'` and `import type { ToolsetEditorLabels, ToolsetFormData, ToolsetAuthActions } from '@epam/ai-dial-toolset-editor'`
- **THEN** the import resolves successfully and every named export is defined

#### Scenario: GeneralForm stays importable for external consumers
- **WHEN** a consumer writes `import { GeneralForm } from '@epam/ai-dial-toolset-editor'`
- **THEN** the import resolves; inside this repo only `ToolsetEditor` renders it, while the Custom App editor (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`) renders `MetadataForm` from `@epam/ai-dial-builder-form` directly

#### Scenario: Internal component is not part of the public surface
- **WHEN** code outside `libs/toolset-editor` attempts to import `SettingsForm`, `AuthSection`, or `ConnectMcpUrlContent` from `@epam/ai-dial-toolset-editor`
- **THEN** the import fails to resolve, since the barrel does not re-export them

#### Scenario: Default form carries no generated name
- **WHEN** a consumer calls `getDefaultToolsetForm()`
- **THEN** the result has `name: ''`, `version: '1.0.0'`, protocol `HTTP`, and auth `None` / `WithoutLogin` / not logged in

#### Scenario: Removed name helpers are not exported
- **WHEN** a consumer attempts to import `DEFAULT_TOOLSET_NAME` or `getStorageSafeUniqueToolsetName` from `@epam/ai-dial-toolset-editor`
- **THEN** the import fails to resolve
