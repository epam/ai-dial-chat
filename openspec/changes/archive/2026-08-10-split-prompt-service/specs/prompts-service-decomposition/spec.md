## ADDED Requirements

### Requirement: Prompts domain service ownership map
The prompts domain SHALL be decomposed into four focused injectable services plus a facade, each owning a disjoint set of responsibilities.

- `PromptsResourceService` SHALL own low-level DIAL Core prompt-resource I/O: `getPromptMetadataItem`, `savePromptResource`, `readPromptByPath`, and `listPromptMetadataItems`. These four methods SHALL be `public`, since `PromptsPersonalService`, `PromptsPublicService`, and `PromptsFolderService` each depend on `PromptsResourceService` and call them directly.
- `PromptsPersonalService` SHALL own personal-bucket prompt CRUD and listing: `listPrompts`, `getSharedPrompts`, `getPrompt`, `createPrompt`, `updatePrompt`, `deletePrompt`.
- `PromptsPublicService` SHALL own organisation/public-bucket reads: `listPublicPrompts`, `getPublicPrompt`.
- `PromptsFolderService` SHALL own folder lifecycle and single-prompt moves: `createFolder`, `renameFolder`, `deleteFolder`, `movePrompt`.
- `PromptService` SHALL act as a facade that delegates every public method to exactly one of the four services above, and SHALL NOT contain business logic beyond delegation.

#### Scenario: Facade delegates a personal-prompt call
- **WHEN** `PromptController` calls `PromptService.listPrompts(...)`
- **THEN** the facade delegates to `PromptsPersonalService.listPrompts(...)` and returns its result unchanged

#### Scenario: Facade delegates a public-prompt call
- **WHEN** `PromptController` calls `PromptService.listPublicPrompts(...)`
- **THEN** the facade delegates to `PromptsPublicService.listPublicPrompts(...)` and returns its result unchanged

#### Scenario: Facade delegates a folder call
- **WHEN** `PromptController` calls `PromptService.createFolder(...)`
- **THEN** the facade delegates to `PromptsFolderService.createFolder(...)` and returns its result unchanged

#### Scenario: Personal, public, and folder services share resource I/O through one dependency
- **WHEN** `PromptsPersonalService.listPrompts`, `PromptsPublicService.listPublicPrompts`, and `PromptsFolderService.deleteFolder` each need to list prompt metadata items
- **THEN** all three call the same injected `PromptsResourceService.listPromptMetadataItems` rather than each maintaining an independent copy of the DIAL Core pagination logic

### Requirement: Behavior equivalence across the split
The decomposition SHALL NOT change any observable REST contract: request/response shapes, status codes, error mapping, and structured log fields SHALL remain identical to the pre-split `PromptService` behavior.

#### Scenario: Identical REST response after extraction
- **WHEN** a client calls `GET /api/v1/prompts`, `GET /api/v1/prompts/public`, or any other prompts endpoint before and after the service split
- **THEN** the response body, status code, and headers are identical for the same underlying data

#### Scenario: Folder rename sequencing preserved
- **WHEN** `PromptsFolderService.renameFolder` is called with a target folder path that already has items
- **THEN** it throws `ConflictException` before making any write, matching the pre-split `PromptService.renameFolder`'s check-before-write order

#### Scenario: Move-then-delete sequencing preserved
- **WHEN** `PromptsFolderService.movePrompt` successfully writes the prompt at its new location
- **THEN** it deletes the prompt at its original location afterward, and surfaces a `handleDialSdkError`-mapped failure if that delete fails, matching the pre-split `PromptService.movePrompt`'s write-then-delete order
