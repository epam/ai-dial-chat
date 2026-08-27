## ADDED Requirements

### Requirement: DIAL-file-to-`Attachment` mapping is a host-agnostic public export with an injected preview-URL resolver

`@epam/ai-dial-chat-hooks` SHALL export `dialFileToAttachment(file: DialFile, bucket: string, options?: { resolvePreviewUrl?: (url: string) => string | undefined }): Attachment | null`, `dialFilesToAttachments(files: DialFile[], bucket: string, options?): Attachment[]`, and `dialFolderPathToAttachment(folderPath: string): Attachment`, reproducing the field-mapping behavior of the former `apps/chat/src/utils/dial-file-to-attachment.ts` exactly, except that image preview-URL resolution SHALL go through the injected `options.resolvePreviewUrl` callback instead of a direct call to any app-owned URL-construction function. When `resolvePreviewUrl` is omitted, `previewUrl` SHALL be left unset rather than defaulting to any app-specific URL.

#### Scenario: Non-image DIAL file maps to an Attachment without calling the resolver
- **WHEN** `dialFileToAttachment` is called with a non-image `DialFile` and any `options`
- **THEN** it returns an `Attachment` with `id`, `name`, `contentType`, `type`, `status`, `url`, and `file` populated exactly as before the move, and `options.resolvePreviewUrl` is not invoked

#### Scenario: Image DIAL file's preview URL comes from the injected resolver
- **WHEN** `dialFileToAttachment` is called with an image `DialFile` and `options.resolvePreviewUrl` set to a function
- **THEN** the returned `Attachment.previewUrl` equals that function's return value for the file's resolved URL, and no app-owned bucket/icon-path logic runs inside `@epam/ai-dial-chat-hooks`

#### Scenario: Image DIAL file without a resolver has no preview URL
- **WHEN** `dialFileToAttachment` is called with an image `DialFile` and `options` omitted or `resolvePreviewUrl` omitted
- **THEN** the returned `Attachment.previewUrl` is `undefined`

#### Scenario: Batch mapping preserves per-file resolver behavior
- **WHEN** `dialFilesToAttachments` is called with a mixed list of image and non-image `DialFile`s and a `resolvePreviewUrl` callback
- **THEN** every returned `Attachment` matches what calling `dialFileToAttachment` individually on each input file would produce, in the same order

#### Scenario: Folder path maps to an Attachment with no host dependency
- **WHEN** `dialFolderPathToAttachment` is called with a folder path string
- **THEN** it returns the same `Attachment` shape as before the move, using no injected resolver and no host-owned logic

### Requirement: `apps/chat` supplies its bucket/icon-URL resolver as an injected callback

`apps/chat/src/components/ConversationView/ConversationView.tsx` and `apps/chat/src/hooks/files/useDialFileManagerState.ts` SHALL call the `@epam/ai-dial-chat-hooks` exports with `{ resolvePreviewUrl: resolveCatalogIconUrl }`, where `resolveCatalogIconUrl` remains defined in `apps/chat/src/utils/icon-path.ts` and continues to construct the app's `/api/v1/files/download` and `/api/themes/icon` paths. `apps/chat/src/utils/dial-file-to-attachment.ts` and its test SHALL be removed once the migration is verified.

#### Scenario: App-owned URL construction never enters the library
- **WHEN** the repository is inspected after this change
- **THEN** `libs/chat-hooks/src/**` contains no reference to `ApiEndpoints`, `/api/v1/files/download`, or `/api/themes/icon`, and `apps/chat/src/utils/icon-path.ts` still owns `resolveCatalogIconUrl`

### Requirement: MIME/accept-type helpers are host-agnostic public exports with consistent filtering semantics

`@epam/ai-dial-chat-hooks` SHALL export `isDialFileAcceptType(type: unknown): type is DialFileAcceptType`, `mimeTypesToDialFileAcceptTypes(types?: string[]): DialFileAcceptType[] | undefined`, `mimeTypesToFileAccept(types?: string[]): string | undefined`, and `mimeTypesToAttachmentExtensionLabels(types: string[]): string`. `mimeTypesToFileAccept` SHALL derive its output by filtering `types` through `isDialFileAcceptType` (via `mimeTypesToDialFileAcceptTypes`) before joining, so it never includes a value `mimeTypesToDialFileAcceptTypes` would reject.

#### Scenario: `mimeTypesToFileAccept` filters out non-accept-type values
- **WHEN** `mimeTypesToFileAccept` is called with a list containing at least one value that is not a valid `DialFileAcceptType`
- **THEN** the returned comma-joined accept string does not contain that value

#### Scenario: `mimeTypesToFileAccept` and `mimeTypesToDialFileAcceptTypes` never disagree
- **WHEN** `mimeTypesToFileAccept(types)` and `mimeTypesToDialFileAcceptTypes(types)` are both called with the same `types` input
- **THEN** every value present in `mimeTypesToFileAccept`'s joined output corresponds to a value present in `mimeTypesToDialFileAcceptTypes`'s returned array, and vice versa

#### Scenario: Wildcard type short-circuits filtering
- **WHEN** `types` includes a wildcard accept value
- **THEN** `mimeTypesToFileAccept` and `mimeTypesToDialFileAcceptTypes` both resolve to the wildcard behavior they had before this change, unaffected by the filtering fix

#### Scenario: `mimeTypesToAttachmentExtensionLabels` is unaffected by the filtering fix
- **WHEN** `mimeTypesToAttachmentExtensionLabels` is called with any `types` input
- **THEN** it returns the same dotted-extension label string it returned before this change, independent of `mimeTypesToFileAccept`'s fix

### Requirement: `useAttachmentValidation` and `DialFileManagerModal` consume one shared implementation

`libs/chat-hooks/src/attachment/useAttachmentValidation/useAttachmentValidation.ts` SHALL import `isDialFileAcceptType`/`mimeTypesToDialFileAcceptTypes`/`mimeTypesToFileAccept` from the new shared module instead of defining its own private copies. `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx` SHALL import `mimeTypesToDialFileAcceptTypes`/`mimeTypesToAttachmentExtensionLabels` from `@epam/ai-dial-chat-hooks`. `apps/chat/src/utils/attachment-types.ts` and its test SHALL be removed once both consumers are migrated.

#### Scenario: No private duplicate remains inside `useAttachmentValidation`
- **WHEN** `libs/chat-hooks/src/attachment/useAttachmentValidation/useAttachmentValidation.ts` is inspected after this change
- **THEN** it contains no locally-defined `mimeTypesToFileAccept`/`isDialFileAcceptType`/`mimeTypesToDialFileAcceptTypes` implementation
