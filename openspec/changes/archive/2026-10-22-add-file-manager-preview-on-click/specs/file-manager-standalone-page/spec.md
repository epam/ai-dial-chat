# Spec Delta

## MODIFIED Requirements

### Requirement: The page wires Preview for files

`DialFileManagerPage` SHALL call `useDialFilePreview` with the composer's `items`, the user's `bucket` and the composer's search results, SHALL set `labels.previewLabel` to `t(BasicI18nKeys.Preview)` and SHALL pass `onPreview`, `onTableFileClick` and `previewExtensions` to `DialFileManagerShell`. The behavior behind those props is specified by the `file-manager-preview` capability. The page's exclusions are unchanged: it still renders no attach footer and passes no attach-only props.

#### Scenario: The page passes the preview props to the shell

- **WHEN** `DialFileManagerPage` is rendered
- **THEN** `DialFileManagerShell` receives `labels.previewLabel`, `onPreview`, `onTableFileClick` and `previewExtensions`
