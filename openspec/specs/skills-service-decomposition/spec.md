# skills-service-decomposition Specification

## Purpose
TBD - created by archiving change add-skills-bff-api. Update Purpose after archive.
## Requirements
### Requirement: Skills domain service ownership map
The skills domain SHALL be decomposed into focused injectable services plus a thin facade, each owning a disjoint set of responsibilities, mirroring `deployments-toolsets-service-decomposition`.

- `SkillsListingService` SHALL own `listSkills`, `listSkillFiles`, pagination forwarding, mapping DIAL Core `MetadataBase` into BFF DTOs, and normalization/rejection of malformed upstream metadata.
- `SkillsLookupService` SHALL own resolving one skill from a `skills/{bucket}/{path}` resource URL into a normalized single-skill DTO for the post-share-accept-invitation lookup path, mirroring `DeploymentsLookupService.resolveDeploymentItem`.
- `SkillsPackageService` SHALL own validating a create/update request's `filePaths`/`files` parity, per-path safety/reservation/duplicate/not-`SKILL.md` rules, file-count/per-file/total-size limits against real received byte lengths, and building the outbound per-file `FormData` (`skillManifest` → a `SKILL.md` part, each supporting file → its own part) DIAL Core's whole-skill write operation requires. It never constructs, receives, or forwards a ZIP. It has no controller-facing operation of its own and is not exported by `SkillsModule`.
- `SkillsUploadService` SHALL own `createSkill`, `updateSkill`, `uploadSkillFile`, delegating package validation/multipart construction to `SkillsPackageService`, choosing which conditional header to send (`If-None-Match: '*'` for create, the caller's concrete `If-Match` for update — never both), rejecting an update with no `If-Match` as `428` before calling DIAL Core, translating a create-attempt's upstream `412` to `409 Conflict`, and returning new aggregate ETags.
- `SkillsDownloadService` SHALL own `downloadSkill`, `downloadSkillFile`, upstream stream acquisition, safe response-header forwarding, cancellation on client disconnect, and grouping-folder-download rejection.
- `SkillsMutationService` SHALL own `deleteSkill`, `deleteSkillFile`, `createSkillGroupingFolder`, `deleteSkillGroupingFolder`, `If-Match` forwarding where supported, non-empty-folder conflict mapping, precondition-failure mapping, and mutation ETags.
- `SkillsService` SHALL act as a facade that delegates every public method to exactly one of the services above via bound-property delegation, contains no SDK calls, no DTO mapping, no validation/streaming/multipart/ETag/error-mapping logic, and stays under 150 lines.

#### Scenario: Facade delegates a listing call
- **WHEN** `SkillsController` calls `SkillsService.listSkills(...)`
- **THEN** the facade delegates to `SkillsListingService.listSkills(...)` and returns its result unchanged

#### Scenario: Facade delegates a create call
- **WHEN** `SkillsController` calls `SkillsService.createSkill(...)`
- **THEN** the facade delegates to `SkillsUploadService.createSkill(...)` and returns its result unchanged

#### Scenario: Facade delegates an update call
- **WHEN** `SkillsController` calls `SkillsService.updateSkill(...)`
- **THEN** the facade delegates to `SkillsUploadService.updateSkill(...)` and returns its result unchanged

#### Scenario: Facade delegates a download call
- **WHEN** `SkillsController` calls `SkillsService.downloadSkill(...)`
- **THEN** the facade delegates to `SkillsDownloadService.downloadSkill(...)` and returns its result unchanged

#### Scenario: Facade delegates a mutation call
- **WHEN** `SkillsController` calls `SkillsService.deleteSkill(...)` or `SkillsService.createSkillGroupingFolder(...)`
- **THEN** the facade delegates to `SkillsMutationService`'s matching method and returns its result unchanged

#### Scenario: Facade never exposes SkillsLookupService
- **WHEN** any code needs `SkillsLookupService.resolveSkillItem`
- **THEN** it injects `SkillsLookupService` directly rather than calling through the `SkillsService` facade, because `resolveSkillItem` is intentionally not one of the facade's bound properties

#### Scenario: SkillsPackageService is used only by SkillsUploadService
- **WHEN** any code needs `filePaths`/`files` validation or outbound multipart construction
- **THEN** only `SkillsUploadService` injects `SkillsPackageService` — it is not bound on the `SkillsService` facade and no other domain injects it

### Requirement: No dedicated grouping-folder service
Grouping-folder creation and deletion SHALL be owned by `SkillsMutationService`, not a separate service, because they share no state, cache, or additional dependency with the domain's other structural mutations.

#### Scenario: Grouping-folder mutations live in SkillsMutationService
- **WHEN** `createSkillGroupingFolder` or `deleteSkillGroupingFolder` is implemented
- **THEN** the implementation lives in `apps/chat-api/src/skills/mutation/skills-mutation.service.ts`, not a separate `skills/grouping-folder/` sub-service

### Requirement: Cross-domain dependencies use the narrowest exported service
Other domains that need a skills capability SHALL inject the narrowest focused skills service that satisfies their need, never the full `SkillsService` facade, mirroring `ToolsetsListingService`'s direct dependency on `DeploymentsDetailsService`.

`SkillsModule` SHALL export `SkillsService` and `SkillsLookupService` only — not `SkillsListingService`, `SkillsUploadService`, `SkillsDownloadService`, or `SkillsMutationService` — since no verified cross-domain consumer needs them directly.

No skills sub-service SHALL inject `ShareService` or `PublishService`. No `forwardRef` SHALL be introduced between the skills domain and any other domain.

#### Scenario: ShareService depends on SkillsLookupService directly
- **WHEN** `ShareService.acceptInvitation` needs to resolve a just-accepted shared skill into a summary DTO
- **THEN** `ShareModule` imports `SkillsModule` and `ShareService` injects `SkillsLookupService` directly, not `SkillsService`

#### Scenario: PublishService has no skills dependency
- **WHEN** `PublishService` is constructed
- **THEN** it does not inject any skills service — no verified consumer need exists for publish to look up skill details in this change

### Requirement: Module composition
`SkillsModule` SHALL explicitly register `SkillsController`, `SkillsService`, `SkillsListingService`, `SkillsLookupService`, `SkillsPackageService`, `SkillsUploadService`, `SkillsDownloadService`, and `SkillsMutationService` as providers, and SHALL be registered in `apps/chat-api/src/app/app.module.ts`.

#### Scenario: SkillsModule is registered in AppModule
- **WHEN** `AppModule`'s `imports` array is inspected
- **THEN** it includes `SkillsModule`, matching every other business domain module

#### Scenario: SkillsPackageService is registered but not exported
- **WHEN** `SkillsModule`'s provider/export lists are inspected
- **THEN** `SkillsPackageService` is a provider but is absent from `SkillsModule`'s `exports` array

### Requirement: Skills domain has no pre-split baseline to preserve
Unlike `deployments-toolsets-service-decomposition` (a refactor of an existing monolithic service with a pre-split baseline to preserve), the skills domain SHALL be authored directly as a facade-plus-focused-services domain with no pre-existing monolithic implementation to compare against.

#### Scenario: No pre-split baseline exists
- **WHEN** this change is implemented
- **THEN** `SkillsService` is authored directly as a facade from the first commit — there is no intermediate monolithic `SkillsService` that is later split

