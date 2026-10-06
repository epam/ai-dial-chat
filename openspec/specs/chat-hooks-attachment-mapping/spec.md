# chat-hooks-attachment-mapping Specification

## Purpose

Host-agnostic DIAL-file-to-`Attachment` mapping
(`dialFileToAttachment`/`dialFilesToAttachments`/`dialFolderPathToAttachment`)
and MIME/accept-type helpers
(`mimeTypesToFileAccept`/`isDialFileAcceptType`/`mimeTypesToDialFileAcceptTypes`/`mimeTypesToAttachmentExtensionLabels`),
published from `@epam/ai-dial-chat-hooks` with the icon/preview-URL
resolution injected by the host.

## Requirements

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

`apps/chat/src/components/ConversationView/ConversationView.tsx` and `apps/chat/src/hooks/files/useDialFileManagerState.ts` SHALL call the `@epam/ai-dial-chat-hooks` exports with `{ resolvePreviewUrl: resolveCatalogIconUrl }` (other callers — `apps/chat/src/hooks/application-editor/useApplicationAvatarPicker.ts` and `libs/toolset-editor`'s `GeneralForm` — pass their own injected `resolveIconUrl`), where `resolveCatalogIconUrl` remains defined in `apps/chat/src/utils/icon-path.ts` and continues to construct the app's `/api/v1/files/download` and `/api/themes/icon` paths. `apps/chat/src/utils/dial-file-to-attachment.ts` and its test SHALL be removed once the migration is verified.

#### Scenario: App-owned URL construction never enters the library
- **WHEN** the repository is inspected
- **THEN** no non-test source file under `libs/chat-hooks/src/**` contains a reference to `ApiEndpoints`, `/api/v1/files/download`, or `/api/themes/icon` (spec fixtures under `tests/` may use such URLs as stub resolver return values), and `apps/chat/src/utils/icon-path.ts` still owns `resolveCatalogIconUrl`

### Requirement: MIME/accept-type helpers are host-agnostic public exports with consistent filtering semantics

`@epam/ai-dial-chat-hooks` SHALL export, from `libs/chat-hooks/src/files/attachment-types.ts`, `isDialFileAcceptType(type: string): type is DialFileAcceptType` (true for a dotted extension or any value containing `/`), `mimeTypesToDialFileAcceptTypes(types?: string[]): DialFileAcceptType[] | undefined`, `mimeTypesToFileAccept(types?: string[]): string | undefined`, and `mimeTypesToAttachmentExtensionLabels(types: string[]): string`. `mimeTypesToFileAccept` SHALL derive its output by filtering `types` through `isDialFileAcceptType` (via `mimeTypesToDialFileAcceptTypes`) before joining, so it never includes a value `mimeTypesToDialFileAcceptTypes` would reject. `mimeTypesToDialFileAcceptTypes` maps `*` to `*/*` and canonicalizes MIME aliases with `normalizeMimeType` (dotted extensions pass through untouched); `mimeTypesToFileAccept` returns `undefined` when `types` is omitted, when no accept type survives filtering, or when any surviving type is `*/*`.

#### Scenario: `mimeTypesToFileAccept` filters out non-accept-type values
- **WHEN** `mimeTypesToFileAccept` is called with a list containing at least one value that is not a valid `DialFileAcceptType`
- **THEN** the returned comma-joined accept string does not contain that value

#### Scenario: `mimeTypesToFileAccept` and `mimeTypesToDialFileAcceptTypes` never disagree
- **WHEN** `mimeTypesToFileAccept(types)` and `mimeTypesToDialFileAcceptTypes(types)` are both called with the same `types` input
- **THEN** whenever `mimeTypesToFileAccept` returns a string, every value in its joined output corresponds to a value present in `mimeTypesToDialFileAcceptTypes`'s returned array, and vice versa

#### Scenario: Wildcard type short-circuits filtering
- **WHEN** `types` includes a wildcard accept value
- **THEN** `mimeTypesToDialFileAcceptTypes` returns an array containing `*/*` and `mimeTypesToFileAccept` returns `undefined` (accept everything), unaffected by the filtering fix

#### Scenario: `mimeTypesToAttachmentExtensionLabels` is unaffected by the filtering fix
- **WHEN** `mimeTypesToAttachmentExtensionLabels` is called with any `types` input
- **THEN** it returns the same dotted-extension label string it returned before this change, independent of `mimeTypesToFileAccept`'s fix

### Requirement: `useAttachmentValidation` and `DialFileManagerModal` consume one shared implementation

`libs/chat-hooks/src/attachment/useAttachmentValidation/useAttachmentValidation.ts` SHALL import `mimeTypesToFileAccept` from the shared module `libs/chat-hooks/src/files/attachment-types.ts` (the only one of the three helpers it uses) instead of defining its own private copies; `libs/chat-hooks/src/files/useFileAttachmentPicker/useFileAttachmentPicker.ts` likewise imports `mimeTypesToDialFileAcceptTypes` from that module. `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx` SHALL import `mimeTypesToAttachmentExtensionLabels` and `useFileAttachmentPicker` from `@epam/ai-dial-chat-hooks`, getting its accept types through `useFileAttachmentPicker` rather than calling `mimeTypesToDialFileAcceptTypes` itself. `apps/chat/src/utils/attachment-types.ts` and its test SHALL be removed once both consumers are migrated.

#### Scenario: No private duplicate remains inside `useAttachmentValidation`
- **WHEN** `libs/chat-hooks/src/attachment/useAttachmentValidation/useAttachmentValidation.ts` is inspected
- **THEN** it contains no locally-defined `mimeTypesToFileAccept`/`isDialFileAcceptType`/`mimeTypesToDialFileAcceptTypes` implementation
