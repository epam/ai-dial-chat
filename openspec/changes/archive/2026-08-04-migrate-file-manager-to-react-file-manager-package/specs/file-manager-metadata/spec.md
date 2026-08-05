## MODIFIED Requirements

### Requirement: fileMetadataPopupOptions carries data and translated labels

`DialFileManagerShell` SHALL pass `fileMetadataPopupOptions={{ fileMetadata, loading: isFileMetadataLoading, clearMetadata, header, nameLabel, pathLabel, modifiedDateLabel, sizeLabel, authorLabel }}` to `DialFileManager`, matching the installed `@epam/ai-dial-react-file-manager`'s `FileMetadataPopupOptions` shape (`fileMetadata?: DialFile; loading?: boolean; clearMetadata?: () => void; header?: ReactNode; nameLabel?: string; pathLabel?: string; modifiedDateLabel?: string; sizeLabel?: string; authorLabel?: string`). The six label fields SHALL each be sourced from a translated `DialFileManagerShellLabels` field (`metadataHeader`, `metadataNameLabel`, `metadataPathLabel`, `metadataModifiedDateLabel`, `metadataSizeLabel`, `metadataAuthorLabel`), resolved by the host via `t()` — never a raw string literal and never left unset to fall back on the package's hardcoded English defaults.

#### Scenario: Popup options contain data and label fields

- **WHEN** `DialFileManagerShell` builds `fileMetadataPopupOptions`
- **THEN** the object contains `fileMetadata`, `loading`, `clearMetadata`, `header`, `nameLabel`, `pathLabel`, `modifiedDateLabel`, `sizeLabel`, and `authorLabel`, with the six label fields populated from translated strings
