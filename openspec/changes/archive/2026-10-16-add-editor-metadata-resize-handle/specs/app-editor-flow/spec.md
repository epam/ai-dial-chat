## ADDED Requirements

### Requirement: Application editor Metadata column is resizable
`ApplicationFormEditor` (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`) SHALL enable the `EntityEditor` resizable left column (see `builder-form` "EditorLayout — resizable left column") so users can drag the boundary between Metadata and Setup on desktop. The page SHALL own the width with the existing `useLocalStorage` hook (`apps/chat/src/hooks/useLocalStorage.ts`), so the chosen width persists across editor opens; an absent, non-numeric or storage-unavailable value SHALL fall back to the 400 px default. The width is a view preference only: it SHALL NOT enter the form values, the create/update payloads or the preview flow, and no additional chat-api request SHALL be made.

The page SHALL pass localized strings through `EntityEditor` labels using new keys under `editor` in `apps/chat/src/i18n/locales/en.json` and `EditorI18nKeys` (`apps/chat/src/constants/translation-keys.ts`): `editor.resizeHandleTooltip` ("Drag to resize") and `editor.resizeHandleAriaLabel`. The setting applies to every definition rendered by `ApplicationFormEditor`; the Prompt, Skill and Toolset editors are unchanged. Direction is inherited from `<html dir>`, so the handle works in Arabic and other RTL locales.

#### Scenario: Width persists
- **WHEN** a user drags the handle to 520 px and reopens the editor
- **THEN** the Metadata column opens at 520 px

#### Scenario: Corrupt stored value
- **WHEN** the stored width is not a number or `localStorage` throws
- **THEN** the editor opens at 400 px and still resizes in memory

#### Scenario: Save behaviour unchanged
- **WHEN** a user resizes the column and then saves
- **THEN** the create/update request payload is identical to one made without resizing
